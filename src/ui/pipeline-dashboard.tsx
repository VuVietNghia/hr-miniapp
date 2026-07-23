import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PipelineService, CVFile, ProcessingStatus } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';

// ─── Dependency Injection Interface ─────────────────────────────────────────────
// Swap implementation easily in the future (e.g. mock for testing)
export interface IPipelineService {
  fetchAvailableFiles(): Promise<CVFile[]>;
  uploadCV(file: File): Promise<CVFile>;
  processCV(
    cv: CVFile,
    updateStatus: (s: Partial<ProcessingStatus>) => void,
    jdContent: string,
    jdName: string,
    onLog?: (msg: string) => void
  ): Promise<void>;
  getMarkdownContent(normalizedName: string): Promise<string>;
  ensureTemplatesExist?(forceReset?: boolean): Promise<void>;
  fetchAvailableJDs?(onLog?: (msg: string) => void): Promise<CVFile[]>;
  sendMessageToRoom?(text: string): Promise<any>;
  waitForBotReply?(sinceTs: string, onLog?: (msg: string) => void): Promise<boolean>;
  askAI?(prompt: string, fileName?: string, fileId?: string, onLog?: (msg: string) => void): Promise<{ text: string }>;
}

interface PipelineDashboardProps {
  serviceFactory?: (app: ReturnType<typeof usePrivosApp>, roomId: string) => IPipelineService;
}


// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ category }: { category: string }) {
  const isPass = category === 'DAT' || category === 'ĐẠT';
  const isWarn = category === 'CAN NHAC' || category === 'CÂN NHẮC';
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: 'var(--radius-sm)',
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
    backgroundColor: isPass ? 'var(--success-bg)' : isWarn ? 'var(--status-warn-bg)' : 'var(--status-fail-bg)',
    color: isPass ? 'var(--status-pass)' : isWarn ? 'var(--status-warn)' : 'var(--status-fail)',
  };
  return <span style={style}>{isPass ? '✓' : isWarn ? '◐' : '✗'} {category}</span>;
}

function ProcessingBadge({ status }: { status: ProcessingStatus['status'] }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ xử lý', color: 'var(--text-faint)' },
    renaming: { label: 'Đang xử lý…', color: 'var(--accent)' },
    scoring: { label: 'Chấm điểm…', color: 'var(--accent-warm)' },
    completed: { label: 'Hoàn thành', color: 'var(--status-pass)' },
    error: { label: 'Lỗi', color: 'var(--status-fail)' },
  };
  const { label, color } = map[status] ?? { label: status, color: 'var(--text-muted)' };
  return <span style={{ fontSize: '12px', color, fontWeight: 500 }}>{label}</span>;
}

function CVResultCard({ s }: { s: ProcessingStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = !!(s.reason || s.errorMsg);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-card)',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{ flex: 1, minWidth: 0, cursor: hasDetails ? 'pointer' : 'default' }}
          onClick={() => hasDetails && setIsOpen(!isOpen)}
          title={hasDetails ? "Nhấn để xem chi tiết" : ""}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.normalizedName || s.originalName}
            </p>
            {hasDetails && (
              <span style={{
                fontSize: '9px', color: 'var(--text-faint)',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s', display: 'inline-block'
              }}>▼</span>
            )}
          </div>
          {s.normalizedName && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.originalName}
            </p>
          )}
        </div>
        <ProcessingBadge status={s.status} />
      </div>

      {s.category && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge category={s.category} />
          {s.score !== undefined && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.score}/100</span>
          )}
        </div>
      )}

      {isOpen && hasDetails && (
        <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', animation: 'pl-in 0.2s ease' }}>
          {s.reason && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {s.reason}
            </p>
          )}
          {s.errorMsg && (
            <p style={{ margin: s.reason ? '8px 0 0' : 0, fontSize: '12px', color: 'var(--status-fail)', lineHeight: 1.5 }}>
              ⚠ {s.errorMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function PipelineDashboard({ serviceFactory }: PipelineDashboardProps = {}) {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const [files, setFiles] = useState<CVFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, ProcessingStatus>>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [jdContent, setJdContent] = useState('');
  const [jdName, setJdName] = useState('');
  const [availableJDs, setAvailableJDs] = useState<CVFile[]>([]);
  const [jdPrompt, setJdPrompt] = useState('');
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<IPipelineService | null>(null);


  // Note: localStorage is forbidden in Privos sandboxed iframe without allow-same-origin.
  // So we only keep it in memory for the current session.
  useEffect(() => {
    // Cannot use localStorage here
  }, []);



  useEffect(() => {
    if (!app || !roomId) return;
    serviceRef.current = serviceFactory
      ? serviceFactory(app, roomId)
      : new PipelineService(app, roomId, new MarkdownPathContextBuilder());

    loadFiles();
    loadJDs();
  }, [app, roomId]);

  const loadJDs = async () => {
    if (!serviceRef.current?.fetchAvailableJDs) return;
    try {
      const jds = await serviceRef.current.fetchAvailableJDs(addLog);
      setAvailableJDs(jds);
    } catch (err) {
      console.error('Lỗi tải danh sách JD:', err);
    }
  };

  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, logOpen]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const loadFiles = async () => {
    if (!serviceRef.current) return;
    setLoading(true);
    try { setFiles(await serviceRef.current.fetchAvailableFiles()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleUploadCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0 || !serviceRef.current) return;

    setLoading(true);
    try {
      const uploadPromises = Array.from(uploadedFiles).map(async (file) => {
        try {
          await serviceRef.current!.uploadCV(file);
          addLog(`Đã tải lên: ${file.name}`);
          return file.name;
        } catch {
          addLog(`Lỗi tải lên: ${file.name}`);
          return null;
        }
      });

      const uploadedNames = (await Promise.all(uploadPromises)).filter(Boolean);

      const list = await serviceRef.current.fetchAvailableFiles();
      setFiles(list);

      const newIds = list
        .filter(f => uploadedNames.includes(f.name))
        .map(f => f._id);

      if (newIds.length > 0) {
        setSelectedIds(prev => {
          const s = new Set(prev);
          newIds.forEach(id => s.add(id));
          return s;
        });
      }
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleUploadJD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serviceRef.current?.uploadJD) return;

    setLoading(true);
    try {
      const res = await serviceRef.current.uploadJD(file);
      addLog(`Đã tải lên JD: ${res.name}`);
      await loadJDs(); // Refresh dropdown
      if (res._id) {
        await handleSelectJD(res._id); // Auto select new JD
      }
    } catch (err: any) {
      alert('Lỗi tải lên JD: ' + err.message);
      addLog(`Lỗi tải lên JD: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSelectJD = async (fileId: string) => {
    if (!fileId) {
      setJdContent('');
      setJdName('');
      return;
    }
    const jdFile = availableJDs.find(f => f._id === fileId);
    if (!jdFile) return;
    try {
      setJdName(jdFile.name);
      if (serviceRef.current) {
        const path = `hr-miniapp/jds/${jdFile.name}`;
        const content = await app.callServerTool({
          name: 'privos.files.getContent',
          arguments: { path }
        }).catch(async () => {
          return await serviceRef.current!.getMarkdownContent(jdFile.name);
        });

        if (typeof content === 'string' && content.trim()) {
          setJdContent(content);
        } else if (content?.data) {
          setJdContent(content.data);
        } else {
          setJdContent(`Selected JD: ${jdFile.name}`);
        }
      }
    } catch (err: any) {
      alert('Lỗi khi tải nội dung JD: ' + err.message);
    }
  };

  const handleGenerateJD = async () => {
    if (!jdPrompt.trim() || !serviceRef.current?.askAI) return;
    setIsGeneratingJD(true);
    addLog(`Đang gửi yêu cầu tạo JD cho AI...`);
    try {
      // Use askAI directly to interact with Privos AI engine, ensuring the AI creates and saves the file
      const fullPrompt = `Hãy viết một bản Job Description chuyên nghiệp và chi tiết nhất dựa vào yêu cầu ngắn gọn sau: ${jdPrompt}. Cuối cùng, BẮT BUỘC phải lưu JD này thành một file Markdown (.md) vào đúng thư mục hr-miniapp/jds/ để tôi sử dụng.`;

      addLog(`Đã gửi yêu cầu. Đang chờ AI phân tích và tạo JD (có thể mất 30-60s)...`);

      const res = await serviceRef.current.askAI(fullPrompt, undefined, undefined, addLog);

      if (res && res.text) {
        addLog(`✨ AI đã tạo xong JD! Đang tải lại danh sách...`);
        setJdPrompt('');
        await loadJDs();
        alert('AI đã tạo xong JD mới. Danh sách đã được cập nhật.');
      } else {
        addLog(`⚠️ AI đã xử lý nhưng không nhận được kết quả text.`);
        alert('AI phản hồi chậm hoặc có lỗi. Vui lòng kiểm tra lại.');
      }
    } catch (err: any) {
      alert('Lỗi gửi yêu cầu: ' + err.message);
    } finally {
      setIsGeneratingJD(false);
    }
  };

  const startPipeline = async () => {
    if (!serviceRef.current || selectedIds.size === 0) return;
    if (!jdContent) { alert('Vui lòng tải lên file JD trước khi bắt đầu.'); return; }
    setProcessing(true); setLogs([]); setLogOpen(true);
    addLog('— Pipeline bắt đầu —');
    const filesToProcess = files.filter(f => selectedIds.has(f._id));
    setStatuses(prev => ({
      ...prev,
      ...Object.fromEntries(filesToProcess.map(f => [f._id, { fileId: f._id, originalName: f.name, status: 'pending' as const }]))
    }));
    for (const cv of filesToProcess) {
      addLog(`Đang xử lý: ${cv.name}`);
      await serviceRef.current.processCV(
        cv,
        update => setStatuses(prev => ({ ...prev, [cv._id]: { ...prev[cv._id], ...update } })),
        jdContent, jdName, addLog
      );
      setSelectedIds(prev => { const n = new Set(prev); n.delete(cv._id); return n; });
      addLog(`Xong: ${cv.name}`);
    }
    setProcessing(false);
    addLog('— Pipeline kết thúc —');
    await loadFiles();
  };


  const resultList = Object.values(statuses);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

        .pl-root * { box-sizing: border-box; }
        .pl-root { font-family: 'DM Sans', system-ui, sans-serif; }

        .pl-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 20px;
          box-shadow: var(--shadow-card);
          animation: pl-in 0.2s ease;
        }
        .pl-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.07em;
          text-transform: uppercase; color: var(--text-muted); margin: 0 0 12px;
        }
        .pl-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border: 1px solid var(--border);
          border-radius: var(--radius-sm); background: var(--bg-card);
          color: var(--text); font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .pl-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--text-muted); }
        .pl-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .pl-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
        .pl-btn-primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); box-shadow: 0 0 0 3px rgba(21,111,245,.2); }

        .pl-file-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: var(--radius-sm);
          border: 1px solid var(--border); cursor: pointer;
          font-size: 13px; color: var(--text); margin-bottom: 6px;
          transition: background 0.15s, border-color 0.15s; user-select: none;
        }
        .pl-file-item:hover { background: var(--bg-hover); }
        .pl-file-item.sel { background: rgba(21,111,245,.06); border-color: var(--accent); color: var(--accent); }
        .pl-check { width: 14px; height: 14px; flex-shrink: 0; border: 1.5px solid var(--border); border-radius: 3px; transition: background 0.15s, border-color 0.15s; }
        .pl-file-item.sel .pl-check { background: var(--accent); border-color: var(--accent); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 6l3 3 5-5' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-size: 10px; background-position: center; background-repeat: no-repeat; }

        .pl-log { font-family: 'DM Mono', monospace; font-size: 12px; line-height: 1.65; color: var(--text-secondary); background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px 14px; max-height: 220px; overflow-y: auto; margin-top: 8px; }
        .pl-log-line { padding: 1px 0; }
        .pl-log-line:last-child { color: var(--accent); }
        .pl-log::-webkit-scrollbar { width: 6px; }
        .pl-log::-webkit-scrollbar-track { background: transparent; }
        .pl-log::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        @keyframes pl-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .pl-card { animation: none; } }
      `}</style>

      <div className="pl-root" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', padding: '28px 24px' }}>

        {/* Header */}
        <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              CV Pipeline
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Xử lý & chấm điểm CV tự động
              {jdName && <span style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 500 }}>· {jdName}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="pl-btn" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }} onClick={() => {
              if (window.confirm('Hành động này sẽ ghi đè các file hướng dẫn AI (Template & Guidelines) về trạng thái mặc định. Bạn có chắc chắn không?')) {
                serviceRef.current?.ensureTemplatesExist?.(true).then(() => alert('Đã khôi phục mặc định thành công!')).catch((e: any) => alert('Lỗi: ' + e));
              }
            }}>
              ↺ Reset Templates
            </button>
          </div>
        </header>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: '18px', alignItems: 'start' }}>

          {/* Left col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* JD Card */}
            <div className="pl-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p className="pl-label" style={{ margin: 0 }}>01 · Job Description</p>
                {jdContent && <span style={{ fontSize: '12px', color: 'var(--status-pass)', fontWeight: 500 }}>✓ Đã nạp</span>}
              </div>

              {/* JD Selection */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 6px 0' }}>Chọn JD có sẵn</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="pl-btn"
                    style={{ flex: 1, backgroundColor: 'var(--bg)', textAlign: 'left' }}
                    value={availableJDs.find(j => j.name === jdName)?._id || ''}
                    onChange={(e) => handleSelectJD(e.target.value)}
                  >
                    <option value="">-- Vui lòng chọn JD --</option>
                    {availableJDs.map(jd => (
                      <option key={jd._id} value={jd._id}>{jd.name}</option>
                    ))}
                  </select>
                  <button className="pl-btn" onClick={loadJDs} title="Làm mới danh sách JD">↻</button>
                </div>
              </div>

              {/* JD AI Generator */}
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✨</span> Tạo JD bằng AI
                </p>
                <textarea
                  value={jdPrompt}
                  onChange={(e) => setJdPrompt(e.target.value)}
                  placeholder="Nhập yêu cầu (VD: Tuyển Dev Backend, 3 năm kinh nghiệm Nodejs, lương up to 30 củ...)"
                  style={{
                    width: '100%', minHeight: '60px', padding: '8px',
                    borderRadius: '4px', border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)', color: 'var(--text)',
                    fontSize: '13px', marginBottom: '8px', resize: 'vertical'
                  }}
                />
                <button
                  className="pl-btn pl-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleGenerateJD}
                  disabled={isGeneratingJD || !jdPrompt.trim()}
                >
                  {isGeneratingJD ? 'Đang gửi yêu cầu...' : 'Nhờ AI viết JD'}
                </button>
              </div>

              {/* JD Upload Fallback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '12px', borderTop: '1px dashed var(--border-light)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hoặc tải file từ máy tính:</span>
                <input type="file" id="jd-upload" style={{ display: 'none' }} onChange={handleUploadJD} accept=".md,.txt" />
                <button className="pl-btn" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => document.getElementById('jd-upload')?.click()} disabled={processing}>
                  ↑ Upload
                </button>
              </div>
            </div>

            {/* CV Queue Card */}
            <div className="pl-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p className="pl-label" style={{ margin: 0 }}>02 · Hàng chờ CV</p>
                <button onClick={loadFiles} disabled={loading || processing}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                  Làm mới
                </button>
              </div>
              <input type="file" id="cv-upload" style={{ display: 'none' }} multiple onChange={handleUploadCV} accept=".pdf,.doc,.docx,.jpg,.png" />
              <button className="pl-btn" style={{ marginBottom: '12px' }} onClick={() => document.getElementById('cv-upload')?.click()} disabled={loading || processing}>
                + Thêm CV
              </button>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {loading
                  ? <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Đang tải…</p>
                  : files.length === 0
                    ? <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-faint)' }}>Không có file nào</p>
                    : files.map(f => (
                      <div key={f._id} className={`pl-file-item${selectedIds.has(f._id) ? ' sel' : ''}`}
                        onClick={() => !processing && handleToggleSelect(f._id)} title={f.name}>
                        <span className="pl-check" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                      </div>
                    ))
                }
              </div>
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '8px' }}>
                <button className="pl-btn pl-btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={startPipeline} disabled={selectedIds.size === 0 || processing || !jdContent}>
                  {processing ? '⟳ Đang xử lý…' : `Chấm điểm (${selectedIds.size})`}
                </button>
              </div>
            </div>

            {/* Log Toggle */}
            <button className="pl-btn" style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => setLogOpen(o => !o)}>
              <span>📋 Nhật ký hệ thống</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {logs.length > 0 ? `${logs.length} dòng` : 'Trống'} {logOpen ? '▲' : '▼'}
              </span>
            </button>
            {logOpen && (
              <div className="pl-log">
                {logs.length === 0
                  ? <span style={{ color: 'var(--text-faint)' }}>Chưa có log…</span>
                  : logs.map((l, i) => <div key={i} className="pl-log-line">{l}</div>)}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          {/* Right col — Results */}
          <div className="pl-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p className="pl-label" style={{ margin: 0 }}>03 · Kết quả chấm</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {resultList.length > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resultList.length} CV</span>}
              </div>
            </div>
            {resultList.length === 0
              ? (
                <div style={{ padding: '36px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-faint)' }}>
                    Chưa có kết quả — chọn CV và chạy chấm điểm
                  </p>
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {resultList.map(s => <CVResultCard key={s.fileId} s={s} />)}
                </div>
              )
            }
          </div>

        </div>


      </div>
    </>
  );
}
