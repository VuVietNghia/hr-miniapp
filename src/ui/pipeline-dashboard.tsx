import { useState, useEffect, useRef } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PipelineService, CVFile, ProcessingStatus } from './pipeline-service';
import { MarkdownScreeningStrategy } from './screening-strategy';

// Using Vite's ?raw import to inject the markdown files directly as strings
import chuanHoaData from '../../../Format CV và Template chấm điểm CV/chuan_hoa_data.md?raw';
import sangLocCv from '../../../Format CV và Template chấm điểm CV/sang_loc_cv.md?raw';

export default function PipelineDashboard() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  
  const [files, setFiles] = useState<CVFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, ProcessingStatus>>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Custom JD state & Logs
  const [jdContent, setJdContent] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const serviceRef = useRef<PipelineService | null>(null);

  useEffect(() => {
    if (app && roomId) {
      const strategy = new MarkdownScreeningStrategy(chuanHoaData, sangLocCv);
      serviceRef.current = new PipelineService(app, roomId, strategy);
      loadFiles();
    }
  }, [app, roomId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const loadFiles = async () => {
    if (!serviceRef.current) return;
    setLoading(true);
    try {
      const list = await serviceRef.current.fetchAvailableFiles();
      setFiles(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleUploadCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serviceRef.current) return;
    
    setLoading(true);
    try {
      await serviceRef.current.uploadCV(file);
      const list = await serviceRef.current.fetchAvailableFiles();
      setFiles(list);
      // Auto-select the newly uploaded file
      const newFile = list.find(f => f.name === file.name);
      if (newFile) {
        setSelectedIds(prev => new Set(prev).add(newFile._id));
      }
      addLog(`Tải lên thành công: ${file.name}`);
    } catch (err) {
      console.error(err);
      addLog(`Lỗi tải lên: ${file.name}`);
    } finally {
      setLoading(false);
      e.target.value = ''; 
    }
  };

  const handleUploadJD = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJdContent(String(reader.result));
      addLog(`Đã tải lên Job Description: ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startPipeline = async () => {
    if (!serviceRef.current || selectedIds.size === 0) return;
    if (!jdContent) {
      alert('Vui lòng tải lên file JD (Job Description) trước khi bắt đầu.');
      return;
    }

    setProcessing(true);
    setLogs([]); // clear old logs
    addLog('--- KHỞI ĐỘNG PIPELINE ---');
    
    const filesToProcess = files.filter(f => selectedIds.has(f._id));
    
    const newStatuses = { ...statuses };
    filesToProcess.forEach(f => {
      newStatuses[f._id] = { fileId: f._id, originalName: f.name, status: 'pending' };
    });
    setStatuses(newStatuses);

    for (const cv of filesToProcess) {
      addLog(`==> ĐANG CHẠY: ${cv.name}`);
      await serviceRef.current.processSingleCV(
        cv, 
        (update) => {
          setStatuses(prev => ({ ...prev, [cv._id]: { ...prev[cv._id], ...update } }));
        }, 
        jdContent,
        (msg) => addLog(msg)
      );
      
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(cv._id);
        return next;
      });
      addLog(`==> HOÀN THÀNH: ${cv.name}`);
    }
    
    setProcessing(false);
    addLog('--- PIPELINE KẾT THÚC ---');
    await loadFiles();
  };

  return (
    <div style={{
      backgroundColor: '#0A0A0A',
      color: '#F4F4F4',
      minHeight: '100vh',
      fontFamily: '"Inter", "Work Sans", sans-serif',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      {/* Dynamic Font Injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Work+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
        
        .industrial-btn {
          background-color: transparent;
          color: #CCFF00;
          border: 1px solid #CCFF00;
          padding: 12px 24px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .industrial-btn:hover:not(:disabled) {
          background-color: #CCFF00;
          color: #0A0A0A;
        }
        .industrial-btn:disabled {
          border-color: #333;
          color: #555;
          cursor: not-allowed;
        }
        .industrial-btn-primary {
          background-color: #CCFF00;
          color: #0A0A0A;
        }
        .industrial-btn-primary:hover:not(:disabled) {
          background-color: #E4FF00;
          box-shadow: 0 0 15px rgba(204, 255, 0, 0.4);
        }
        .panel {
          border: 1px solid #333;
          background-color: #111;
          padding: 24px;
        }
        .log-terminal {
          font-family: 'JetBrains Mono', monospace;
          background-color: #000;
          color: #00FF41;
          border: 1px solid #333;
          padding: 16px;
          height: 300px;
          overflow-y: auto;
          font-size: 13px;
          line-height: 1.5;
        }
        .status-badge {
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
          border: 1px solid currentColor;
        }
        
        /* Custom Scrollbar for Terminal */
        .log-terminal::-webkit-scrollbar { width: 8px; }
        .log-terminal::-webkit-scrollbar-track { background: #000; }
        .log-terminal::-webkit-scrollbar-thumb { background: #333; }
        .log-terminal::-webkit-scrollbar-thumb:hover { background: #555; }
        
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        @media (min-width: 1024px) {
          .dashboard-layout {
            display: grid;
            grid-template-columns: 1fr 2fr;
            align-items: start;
          }
        }
      `}</style>

      <header style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '40px' }}>
        <h1 style={{ 
          fontFamily: '"Space Grotesk", sans-serif', 
          fontSize: '32px', 
          margin: 0, 
          letterSpacing: '-1px',
          textTransform: 'uppercase'
        }}>
          CV Processing Pipeline <span style={{ color: '#CCFF00' }}>[v2.0]</span>
        </h1>
        <p style={{ color: '#888', margin: '8px 0 0 0', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
          INDUSTRIAL UTILITARIAN AESTHETIC // STRICT EXECUTION MODE
        </p>
      </header>
      
      <div className="dashboard-layout">
        
        {/* Left Column: Controls & Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Module 1: Job Description */}
          <div className="panel">
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '16px', textTransform: 'uppercase', color: '#888', marginTop: 0 }}>
              01 // System Directive (JD)
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <input type="file" id="jd-upload" style={{ display: 'none' }} onChange={handleUploadJD} accept=".md,.txt" />
              <button className="industrial-btn" onClick={() => document.getElementById('jd-upload')?.click()} disabled={processing}>
                Upload JD (.md)
              </button>
              {jdContent ? (
                <span style={{ color: '#CCFF00', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>[ ACTIVE ]</span>
              ) : (
                <span style={{ color: '#FF3366', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>[ REQUIRED ]</span>
              )}
            </div>
          </div>

          {/* Module 2: File Ingestion */}
          <div className="panel" style={{ opacity: jdContent ? 1 : 0.5, pointerEvents: jdContent ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '16px', textTransform: 'uppercase', color: '#888', marginTop: 0 }}>
              02 // File Ingestion
            </h2>
            <input type="file" id="cv-upload" style={{ display: 'none' }} onChange={handleUploadCV} accept=".pdf,.doc,.docx,.jpg,.png" />
            <button className="industrial-btn" onClick={() => document.getElementById('cv-upload')?.click()} disabled={loading || processing}>
              + Ingest New CV
            </button>
            
            <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#888' }}>
                  PENDING QUEUE ({files.length})
                </span>
                <button 
                  onClick={loadFiles} 
                  disabled={loading || processing}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div style={{ color: '#CCFF00', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>SCANNING...</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                  {files.map(f => (
                    <li key={f._id} style={{ 
                      padding: '10px', 
                      backgroundColor: selectedIds.has(f._id) ? '#1A1A1A' : 'transparent',
                      border: selectedIds.has(f._id) ? '1px solid #CCFF00' : '1px solid #333',
                      marginBottom: '8px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '13px',
                      cursor: processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }} onClick={() => !processing && handleToggleSelect(f._id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '12px', height: '12px', 
                          backgroundColor: selectedIds.has(f._id) ? '#CCFF00' : 'transparent',
                          border: '1px solid #CCFF00'
                        }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                      </div>
                    </li>
                  ))}
                  {files.length === 0 && <li style={{ color: '#555', fontSize: '13px' }}>NO FILES DETECTED</li>}
                </ul>
              )}
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <button 
                className="industrial-btn industrial-btn-primary" 
                style={{ width: '100%' }}
                onClick={startPipeline} 
                disabled={selectedIds.size === 0 || processing || !jdContent}
              >
                {processing ? 'PROCESSING...' : `EXECUTE PIPELINE (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Execution & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Terminal Logs */}
          <div className="panel" style={{ padding: 0 }}>
            <div style={{ padding: '10px 15px', borderBottom: '1px solid #333', backgroundColor: '#1A1A1A', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '14px', color: '#888' }}>SYSTEM_LOGS.EXE</span>
              <span style={{ display: processing ? 'block' : 'none', color: '#CCFF00', animation: 'blink 1s infinite', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>● ACTIVE</span>
            </div>
            <div className="log-terminal">
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
              ))}
              {logs.length === 0 && <div style={{ color: '#555' }}>Awaiting execution sequence...</div>}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Results Table */}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '16px', textTransform: 'uppercase', color: '#888', marginTop: 0, marginBottom: '20px' }}>
              Execution Matrix
            </h2>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #555' }}>
                  <th style={{ width: '20%', padding: '12px 8px', color: '#888', fontWeight: 500, fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>SOURCE_ID</th>
                  <th style={{ width: '20%', padding: '12px 8px', color: '#888', fontWeight: 500, fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>NORMALIZED_ID</th>
                  <th style={{ width: '15%', padding: '12px 8px', color: '#888', fontWeight: 500, fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>STATUS</th>
                  <th style={{ width: '45%', padding: '12px 8px', color: '#888', fontWeight: 500, fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>OUTPUT_EVAL</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(statuses).map(s => (
                  <tr key={s.fileId} style={{ borderBottom: '1px solid #333', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '12px 8px', wordWrap: 'break-word', overflowWrap: 'break-word', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                      {s.originalName}
                    </td>
                    <td style={{ padding: '12px 8px', wordWrap: 'break-word', overflowWrap: 'break-word', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#CCFF00' }}>
                      {s.normalizedName || '---'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {s.status === 'pending' && <span className="status-badge" style={{ color: '#888' }}>PENDING</span>}
                      {s.status === 'renaming' && <span className="status-badge" style={{ color: '#00D1FF' }}>RENAMING</span>}
                      {s.status === 'scoring' && <span className="status-badge" style={{ color: '#FFA500' }}>SCORING</span>}
                      {s.status === 'completed' && <span className="status-badge" style={{ color: '#CCFF00' }}>COMPLETED</span>}
                      {s.status === 'error' && <span className="status-badge" style={{ color: '#FF3366' }}>ERROR</span>}
                    </td>
                    <td style={{ padding: '12px 8px', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                      {s.category && (
                        <div style={{ 
                          display: 'inline-block', padding: '4px 8px', fontWeight: 'bold', fontSize: '12px',
                          backgroundColor: s.category === 'ĐẠT' ? 'rgba(204,255,0,0.1)' : s.category === 'CÂN NHẮC' ? 'rgba(255,165,0,0.1)' : 'rgba(255,51,102,0.1)',
                          color: s.category === 'ĐẠT' ? '#CCFF00' : s.category === 'CÂN NHẮC' ? '#FFA500' : '#FF3366',
                          border: `1px solid currentColor`
                        }}>
                          [{s.category}] SCORE: {s.score}
                        </div>
                      )}
                      {s.reason && <div style={{ color: '#AAA', marginTop: '8px', fontSize: '13px', lineHeight: 1.4 }}>{s.reason}</div>}
                      {s.errorMsg && <div style={{ color: '#FF3366', marginTop: '8px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>{s.errorMsg}</div>}
                    </td>
                  </tr>
                ))}
                {Object.keys(statuses).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px 8px', textAlign: 'center', color: '#555', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                      NO EXECUTION DATA
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
      
      {/* Blinking Animation Keyframes */}
      <style>{`
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}
