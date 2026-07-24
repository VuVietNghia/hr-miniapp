import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PipelineService, CVFile, ProcessingStatus } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';

// ─── Dependency Injection Interface ─────────────────────────────────────────────
// Swap implementation easily in the future (e.g. mock for testing)
export interface IPipelineService {
  fetchAvailableFiles(): Promise<CVFile[]>;
  uploadCV(file: File): Promise<CVFile>;
  uploadJD?(file: File): Promise<CVFile>;
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
  createKanbanBatchViaAI?(
    results: Array<{ originalName: string; normalizedName?: string; score?: number; category?: string; reason?: string }>,
    jdName: string,
    onLog?: (msg: string) => void
  ): Promise<void>;
}

interface PipelineDashboardProps {
  serviceFactory?: (app: ReturnType<typeof usePrivosApp>, roomId: string) => IPipelineService;
}

type JDFormState = {
  position: string;
  department: string;
  location: string;
  workTime: string;
  jobDescription: string;
  experience: string;
  technicalSkills: string;
  softSkills: string;
  education: string;
  salary: string;
  benefits: string;
  workEnvironment: string;
  applyEmail: string;
  emailSubject: string;
};

const emptyJDForm: JDFormState = {
  position: '',
  department: '',
  location: '',
  workTime: '',
  jobDescription: '',
  experience: '',
  technicalSkills: '',
  softSkills: '',
  education: '',
  salary: '',
  benefits: '',
  workEnvironment: '',
  applyEmail: '',
  emailSubject: '',
};

const hasJDFormValue = (form: JDFormState) =>
  Object.values(form).some(value => value.trim().length > 0);

const buildJDPromptFromForm = (form: JDFormState) => `
Thông tin tuyển dụng:

1. Thông tin chung
- Vị trí: ${form.position || 'Không xác định'}
- Phòng ban: ${form.department || 'Không xác định'}
- Địa điểm làm việc: ${form.location || 'Không xác định'}
- Thời gian làm việc: ${form.workTime || 'Không xác định'}

2. Mô tả công việc
${form.jobDescription || 'Không xác định'}

3. Yêu cầu ứng viên
- Kinh nghiệm: ${form.experience || 'Không xác định'}
- Kỹ năng chuyên môn: ${form.technicalSkills || 'Không xác định'}
- Kỹ năng mềm: ${form.softSkills || 'Không xác định'}
- Học vấn: ${form.education || 'Không xác định'}

4. Quyền lợi
- Mức lương: ${form.salary || 'Không xác định'}
- Phúc lợi: ${form.benefits || 'Không xác định'}
- Môi trường làm việc: ${form.workEnvironment || 'Không xác định'}

5. Cách thức ứng tuyển
- Email nhận CV: ${form.applyEmail || 'Không xác định'}
- Tiêu đề email: ${form.emailSubject || 'Không xác định'}
`.trim();


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
  const [jdFormOpen, setJdFormOpen] = useState(false);
  const [jdForm, setJdForm] = useState<JDFormState>(emptyJDForm);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (!jdFormOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [jdFormOpen]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
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
    setJdFormOpen(false);
    addLog(`Đang gửi yêu cầu tạo JD cho AI...`);
    try {
      // Use askAI directly to interact with Privos AI engine, ensuring the AI creates and saves the file
      const fullPrompt = `[SYSTEM AUTOMATION] THỰC THI NGAY LẬP TỨC, KHÔNG HỎI LẠI!
Hãy đọc file @Files:${roomId}/hr-miniapp/skills/jd-generator.md và thực thi ngay lập tức toàn bộ 4 bước workflow trong đó để tạo JD cho yêu cầu sau: "${jdPrompt}".
BẮT BUỘC phải lưu thành file .md vào thư mục jds/ và chỉ trả lời khi đã lưu xong!`;

      addLog(`Đã gửi yêu cầu. Đang chờ AI phân tích và tạo JD (có thể mất 30-60s)...`);

      const res = await serviceRef.current.askAI(fullPrompt, undefined, undefined, addLog);

      if (res && res.text) {
        addLog(`✨ AI đã tạo xong JD! Đang tải lại danh sách...`);
        setJdPrompt('');
        setJdForm(emptyJDForm);
        setJdFormOpen(false);
        await loadJDs();
        showToast('AI đã tạo xong JD mới. Danh sách đã được cập nhật.');
      } else {
        addLog(`⚠️ AI đã xử lý nhưng không nhận được kết quả text.`);
        showToast('AI phản hồi chậm hoặc có lỗi. Vui lòng kiểm tra lại.', 'error');
      }
    } catch (err: any) {
      showToast('Lỗi gửi yêu cầu: ' + err.message, 'error');
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

    const resultsForKanban: Array<{ originalName: string; normalizedName?: string; score?: number; category?: string; reason?: string }> = [];

    for (const cv of filesToProcess) {
      addLog(`Đang xử lý: ${cv.name}`);
      let currentStatus: any = { originalName: cv.name };
      
      await serviceRef.current.processCV(
        cv,
        update => {
          setStatuses(prev => ({ ...prev, [cv._id]: { ...prev[cv._id], ...update } }));
          currentStatus = { ...currentStatus, ...update };
        },
        jdContent, jdName, addLog
      );
      resultsForKanban.push(currentStatus);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(cv._id); return n; });
      addLog(`Xong: ${cv.name}`);
    }

    if (serviceRef.current.createKanbanBatchViaAI && resultsForKanban.length > 0) {
      addLog(`Bắt đầu tạo List Kanban và lưu kết quả ${resultsForKanban.length} CV...`);
      try {
        await serviceRef.current.createKanbanBatchViaAI(resultsForKanban, jdName, addLog);
      } catch (err: any) {
        addLog(`Lỗi tạo Kanban: ${err.message}`);
      }
    }

    setProcessing(false);
    addLog('— Pipeline kết thúc —');
    await loadFiles();
    showToast('Đã chấm điểm xong và lưu kết quả vào list.');
  };


  const resultList = Object.values(statuses);
  const isJDFormReady = hasJDFormValue(jdForm);

  const updateJDFormField = (field: keyof JDFormState, value: string) => {
    const nextForm = { ...jdForm, [field]: value };
    setJdForm(nextForm);
    setJdPrompt(buildJDPromptFromForm(nextForm));
  };

  const renderJDFormField = (
    field: keyof JDFormState,
    label: string,
    placeholder: string,
    multiline = false,
    wide = false
  ) => (
    <label className={`pl-form-field${wide ? ' pl-span-2' : ''}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="pl-textarea"
          value={jdForm[field]}
          onChange={(e) => updateJDFormField(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          className="pl-input"
          value={jdForm[field]}
          onChange={(e) => updateJDFormField(field, e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );

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

        .pl-toast {
          position: fixed; top: 20px; right: 24px; z-index: 1300;
          display: flex; align-items: center; gap: 10px; max-width: min(420px, calc(100vw - 48px));
          padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border);
          background: var(--bg-card); color: var(--text); box-shadow: 0 16px 48px rgba(0,0,0,.22);
          font-size: 13px; font-weight: 500; line-height: 1.45; animation: pl-toast-in 0.2s ease;
        }
        .pl-toast.success { border-color: rgba(22, 163, 74, .28); }
        .pl-toast.error { border-color: rgba(220, 38, 38, .32); }
        .pl-toast-dot { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0; background: var(--status-pass); }
        .pl-toast.error .pl-toast-dot { background: var(--status-fail); }

        .pl-page-grid { display: flex; flex-direction: column; gap: 18px; }
        .pl-top-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: stretch; }
        .pl-top-grid > .pl-card { height: 100%; }
        .pl-modal-backdrop {
          position: fixed; inset: 0; z-index: 1000; padding: 32px 20px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(15, 23, 42, 0.58); backdrop-filter: blur(2px);
        }
        .pl-modal {
          width: min(920px, 100%); max-height: calc(100vh - 64px); overflow-y: auto; overscroll-behavior: contain;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 20px; box-shadow: 0 24px 80px rgba(0,0,0,.28);
          animation: pl-modal-in 0.18s ease;
        }
        .pl-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .pl-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-light); }
        .pl-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .pl-form-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
        .pl-span-2 { grid-column: 1 / -1; }
        .pl-input, .pl-textarea {
          width: 100%; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--bg-card); color: var(--text); font: inherit; font-size: 13px;
          padding: 9px 10px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .pl-textarea { min-height: 82px; resize: vertical; line-height: 1.5; }
        .pl-input:focus, .pl-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(21,111,245,.12); }
        .pl-results-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; }
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
        @keyframes pl-modal-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pl-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 920px) {
          .pl-top-grid, .pl-form-grid { grid-template-columns: 1fr; }
          .pl-modal-backdrop { padding: 16px 12px; align-items: flex-start; }
          .pl-modal { max-height: calc(100vh - 32px); padding: 16px; }
          .pl-modal-header, .pl-modal-actions { flex-direction: column; align-items: stretch; }
          .pl-toast { top: 12px; right: 12px; left: 12px; max-width: none; }
          .pl-span-2 { grid-column: auto; }
        }
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

        {/* Pipeline Layout */}
        <div className="pl-page-grid">

          {/* Top row: JD + CV Queue */}
          <div className="pl-top-grid">
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
                    style={{ flex: 1, backgroundColor: 'var(--bg)', textAlign: 'left', minWidth: 0 }}
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
              <div style={{ marginBottom: '16px' }}>
                <button
                  className="pl-btn pl-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setJdFormOpen(true)}
                  disabled={isGeneratingJD}
                >
                  {isGeneratingJD ? 'Đang tạo JD' : <><span>✨</span> Tạo JD bằng AI</>}
                </button>
              </div>
              {/* JD Upload Fallback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '12px', borderTop: '1px dashed var(--border-light)', flexWrap: 'wrap' }}>
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
              <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
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
          </div>

          {/* Results */}
          <div className="pl-card" style={{ padding: '18px 20px', minHeight: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p className="pl-label" style={{ margin: 0 }}>03 · Kết quả chấm</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {resultList.length > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resultList.length} CV</span>}
              </div>
            </div>
            {resultList.length === 0
              ? (
                <div style={{ minHeight: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-faint)' }}>
                    Chưa có kết quả — chọn CV và chạy chấm điểm
                  </p>
                </div>
              )
              : (
                <div className="pl-results-list">
                  {resultList.map(s => <CVResultCard key={s.fileId} s={s} />)}
                </div>
              )
            }
          </div>

          {/* System Log */}
          <div className="pl-card" style={{ padding: '14px 16px' }}>
            <button className="pl-btn" style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => setLogOpen(o => !o)}>
              <span>📋 Nhật ký hệ thống</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {logs.length > 0 ? `${logs.length} dòng` : 'Trống'} {logOpen ? '▲' : '▼'}
              </span>
            </button>
            {logOpen && (
              <div className="pl-log" style={{ maxHeight: '280px' }}>
                {logs.length === 0
                  ? <span style={{ color: 'var(--text-faint)' }}>Chưa có log…</span>
                  : logs.map((l, i) => <div key={i} className="pl-log-line">{l}</div>)}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

        </div>

        {toast && (
          <div className={`pl-toast ${toast.type}`} role="status" aria-live="polite">
            <span className="pl-toast-dot" />
            <span>{toast.message}</span>
          </div>
        )}

        {jdFormOpen && (
          <div
            className="pl-modal-backdrop"
            onClick={() => !isGeneratingJD && setJdFormOpen(false)}
          >
            <div className="pl-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pl-modal-header">
                <div>
                  <p className="pl-label" style={{ margin: 0 }}>Tạo JD bằng AI</p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Điền các thông tin chính theo mẫu JD để AI tạo file tuyển dụng hoàn chỉnh.
                  </p>
                </div>
                <button
                  className="pl-btn"
                  style={{ padding: '6px 10px' }}
                  onClick={() => setJdFormOpen(false)}
                  disabled={isGeneratingJD}
                  aria-label="Đóng form tạo JD"
                >
                  ✕
                </button>
              </div>

              <div className="pl-form-grid">
                <p className="pl-label pl-span-2" style={{ margin: '2px 0 0' }}>Thông tin chung</p>
                {renderJDFormField('position', 'Vị trí', 'VD: Lập trình viên Mini App')}
                {renderJDFormField('department', 'Phòng ban', 'VD: Khoa học Dữ liệu & HTTT')}
                {renderJDFormField('location', 'Địa điểm làm việc', 'VD: Hà Nội / Remote / Hybrid')}
                {renderJDFormField('workTime', 'Thời gian làm việc', 'VD: Full-time hoặc Part-time')}

                <p className="pl-label pl-span-2" style={{ margin: '4px 0 0' }}>Mô tả công việc</p>
                {renderJDFormField('jobDescription', 'Mô tả công việc', 'Nhập các đầu việc chính, mỗi dòng một ý...', true, true)}

                <p className="pl-label pl-span-2" style={{ margin: '4px 0 0' }}>Yêu cầu ứng viên</p>
                {renderJDFormField('experience', 'Kinh nghiệm', 'VD: 01 năm kinh nghiệm')}
                {renderJDFormField('education', 'Học vấn', 'VD: Tốt nghiệp ngành CNTT')}
                {renderJDFormField('technicalSkills', 'Kỹ năng chuyên môn', 'VD: React, TypeScript, Mini App...', true, true)}
                {renderJDFormField('softSkills', 'Kỹ năng mềm', 'VD: Chủ động, giao tiếp tốt...', true, true)}

                <p className="pl-label pl-span-2" style={{ margin: '4px 0 0' }}>Quyền lợi</p>
                {renderJDFormField('salary', 'Mức lương', 'VD: 15.000.000 VNĐ/tháng')}
                {renderJDFormField('benefits', 'Phúc lợi', 'VD: Thưởng dự án, BHXH...', true)}
                {renderJDFormField('workEnvironment', 'Môi trường làm việc', 'VD: Trẻ, linh hoạt, sản phẩm thực tế...', true, true)}

                <p className="pl-label pl-span-2" style={{ margin: '4px 0 0' }}>Cách thức ứng tuyển</p>
                {renderJDFormField('applyEmail', 'Email nhận CV', 'VD: hr@company.vn')}
                {renderJDFormField('emailSubject', 'Tiêu đề email', 'VD: Vị trí - [Họ và tên]')}
              </div>

              <div className="pl-modal-actions">
                <button
                  className="pl-btn"
                  onClick={() => { setJdForm(emptyJDForm); setJdPrompt(''); }}
                  disabled={isGeneratingJD || !isJDFormReady}
                >
                  Xóa form
                </button>
                <button
                  className="pl-btn pl-btn-primary"
                  onClick={handleGenerateJD}
                  disabled={isGeneratingJD || !isJDFormReady}
                >
                  {isGeneratingJD ? 'Đang gửi yêu cầu...' : 'Gửi AI tạo JD'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
