import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PipelineService, CVFile, ProcessingStatus } from './pipeline-service';
import { MarkdownScreeningStrategy } from './screening-strategy';
import { MarkdownPathContextBuilder } from './cv-context-builder';

import chuanHoaData from './data/chuan_hoa_data.md?raw';
import sangLocCv from './data/sang_loc_cv.md?raw';

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
    pending:   { label: 'Chờ xử lý',  color: 'var(--text-faint)' },
    renaming:  { label: 'Đang xử lý…', color: 'var(--accent)' },
    scoring:   { label: 'Chấm điểm…', color: 'var(--accent-warm)' },
    completed: { label: 'Hoàn thành', color: 'var(--status-pass)' },
    error:     { label: 'Lỗi',        color: 'var(--status-fail)' },
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

  const [files, setFiles]             = useState<CVFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses]       = useState<Record<string, ProcessingStatus>>({});
  const [loading, setLoading]         = useState(false);
  const [processing, setProcessing]   = useState(false);
  const [jdContent, setJdContent]     = useState('');
  const [jdName, setJdName]           = useState('');
  const [logs, setLogs]               = useState<string[]>([]);
  const [logOpen, setLogOpen]         = useState(false);
  const logEndRef                     = useRef<HTMLDivElement>(null);
  const serviceRef                    = useRef<IPipelineService | null>(null);

  useEffect(() => {
    if (!app || !roomId) return;
    serviceRef.current = serviceFactory
      ? serviceFactory(app, roomId)
      : new PipelineService(app, roomId, new MarkdownScreeningStrategy(chuanHoaData, sangLocCv), new MarkdownPathContextBuilder());
    loadFiles();
  }, [app, roomId]);

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
    const file = e.target.files?.[0];
    if (!file || !serviceRef.current) return;
    setLoading(true);
    try {
      await serviceRef.current.uploadCV(file);
      const list = await serviceRef.current.fetchAvailableFiles();
      setFiles(list);
      const added = list.find(f => f.name === file.name);
      if (added) setSelectedIds(prev => new Set(prev).add(added._id));
      addLog(`Đã tải lên: ${file.name}`);
    } catch { addLog(`Lỗi tải lên: ${file.name}`); }
    finally { setLoading(false); e.target.value = ''; }
  };

  const handleUploadJD = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setJdContent(String(reader.result)); setJdName(file.name); addLog(`Đã nạp JD: ${file.name}`); };
    reader.readAsText(file);
    e.target.value = '';
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
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            CV Pipeline
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Xử lý & chấm điểm CV tự động
            {jdName && <span style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 500 }}>· {jdName}</span>}
          </p>
        </header>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: '18px', alignItems: 'start' }}>

          {/* Left col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* JD Card */}
            <div className="pl-card">
              <p className="pl-label">01 · Job Description</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="file" id="jd-upload" style={{ display: 'none' }} onChange={handleUploadJD} accept=".md,.txt" />
                <button className="pl-btn" onClick={() => document.getElementById('jd-upload')?.click()} disabled={processing}>
                  ↑ Tải lên JD
                </button>
                {jdContent
                  ? <span style={{ fontSize: '12px', color: 'var(--status-pass)', fontWeight: 500 }}>✓ Đã nạp</span>
                  : <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Chưa có JD</span>}
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
              <input type="file" id="cv-upload" style={{ display: 'none' }} onChange={handleUploadCV} accept=".pdf,.doc,.docx,.jpg,.png" />
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
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
                <button className="pl-btn pl-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={startPipeline} disabled={selectedIds.size === 0 || processing || !jdContent}>
                  {processing ? '⟳ Đang xử lý…' : `Chạy Pipeline (${selectedIds.size})`}
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
              {resultList.length > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resultList.length} CV</span>}
            </div>
            {resultList.length === 0
              ? (
                <div style={{ padding: '36px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-faint)' }}>
                    Chưa có kết quả — chọn CV và chạy pipeline
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
