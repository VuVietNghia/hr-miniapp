import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import '../hr-premium-styles.css';

export interface CVProfile {
  _id: string;
  name: string;
  status: string; // stage name e.g. 02_Loai_CV
  score?: number;
  category?: string;
  reason?: string;
}

const CV_COLUMNS = [
  { status: '02_Loai_CV', label: 'Loại', color: '#ef4444' },
  { status: '03_Tiem_Nang', label: 'Tiềm năng', color: '#22c55e' },
  { status: '05_Moi_Phong_Van', label: 'Mời phỏng vấn', color: '#eab308' },
  { status: '10_CV_Cu', label: 'CV cũ', color: '#9ca3af' },
];

function CVCard({ cv, onMove }: { cv: CVProfile, onMove: (id: string, newStatus: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const initials = cv.name.substring(0, 2).toUpperCase();
  const displayName = cv.name.length > 27 ? cv.name.substring(0, 27) + '...' : cv.name;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', cv._id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  return (
    <div 
      className={`hr-card ${isDragging ? 'is-dragging' : ''}`}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      title="Kéo thả CV"
    >
      <div className="profile-card-header">
        <div className="profile-name-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="profile-avatar" style={{ backgroundColor: 'var(--accent)', flexShrink: 0 }}>{initials}</div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <div className="profile-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} title={cv.name}>{displayName}</div>
            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge-tenure">Điểm: {cv.score ?? 'N/A'}</span>
              {cv.category && (() => {
                let badgeStyle: React.CSSProperties = { fontSize: '10px', padding: '2px 6px' };
                const catLower = cv.category.toLowerCase();
                if (catLower.includes('không đạt') || catLower.includes('không tuyển')) {
                  badgeStyle = { ...badgeStyle, backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' };
                } else if (catLower.includes('cân nhắc')) {
                  badgeStyle = { ...badgeStyle, backgroundColor: '#fefce8', color: '#eab308', border: '1px solid #fef08a' };
                }
                return <span className="position-badge" style={badgeStyle}>{cv.category}</span>;
              })()}
            </div>
          </div>
        </div>
      </div>
      {cv.reason && (
        <div className="profile-details" style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {cv.reason.length > 200 ? cv.reason.substring(0, 200) + '...' : cv.reason}
        </div>
      )}
    </div>
  );
}

function CVColumn({ column, cvs, onMove }: { column: typeof CV_COLUMNS[0], cvs: CVProfile[], onMove: (id: string, newStatus: string) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onMove(id, column.status);
  };

  return (
    <div 
      className={`hr-kanban-col ${isDragOver ? 'drag-over' : ''}`}
      style={{ flex: '0 0 calc((100% - 48px) / 3)', minWidth: '280px' }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
    >
      <div className="hr-kanban-col-header" style={{ borderTopColor: column.color }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: column.color }} />
          <h3 className="hr-kanban-title">{column.label}</h3>
        </div>
        <span className="hr-kanban-badge" style={{ color: column.color, backgroundColor: `${column.color}15` }}>
          {cvs.length}
        </span>
      </div>
      <div className="hr-kanban-content" style={{ overflowX: 'hidden' }}>
        {cvs.length === 0 ? (
          <p className="empty-state">{isDragOver ? 'Thả CV vào đây' : 'Trống'}</p>
        ) : (
          cvs.map(cv => <CVCard key={cv._id} cv={cv} onMove={onMove} />)
        )}
      </div>
    </div>
  );
}

export interface CVBoardData {
  listId: string;
  listName: string;
  stagesMap: Record<string, string>;
  cvs: CVProfile[];
}

function CVBoard({ board, onMove }: { board: CVBoardData, onMove: (listId: string, id: string, newStatus: string) => void }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ width: '100%', padding: '0 10px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>{board.listName}</h3>
      </div>
      <div className="hr-kanban-container" style={{ display: 'flex', gap: '24px', paddingBottom: '16px', overflowX: 'auto' }}>
        {CV_COLUMNS.map(col => (
          <CVColumn 
            key={col.status} 
            column={col} 
            cvs={board.cvs.filter(cv => cv.status === col.status)} 
            onMove={(id, newStatus) => onMove(board.listId, id, newStatus)} 
          />
        ))}
      </div>
    </div>
  );
}

export default function CVScoredTab() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [boards, setBoards] = useState<CVBoardData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const requestRef = React.useRef(0);

  const loadData = useCallback(async () => {
    if (!app || !roomId) return;
    const reqId = ++requestRef.current;
    
    setLoading(true);
    try {
      const res: any = await app.callServerTool({
        name: 'privos.lists.getAll',
        arguments: { roomId }
      });
      const parsed = JSON.parse(res?.content?.[0]?.text || '{}');
      const allLists = Array.isArray(parsed) ? parsed : (parsed.lists || []);
      
      // Get all screening lists and sort newest updated first
      const targetLists = allLists
        .filter((l: any) => (l.name || '').includes('SCREENING'))
        .sort((a: any, b: any) => {
          const tA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
          const tB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
          if (tA !== tB && tA > 0 && tB > 0) return tB - tA;
          const idA = a._id || a.id || '';
          const idB = b._id || b.id || '';
          return idB.localeCompare(idA);
        });
      
      if (targetLists.length === 0) {
        setBoards([]);
        setLoading(false);
        return;
      }

      const loadedBoards: CVBoardData[] = [];

      for (const targetList of targetLists) {
        const lId = targetList._id || targetList.id;
        
        let sMap: Record<string, string> = {};
        let fMap: Record<string, string> = {};
        
        try {
          const detailRes: any = await app.callServerTool({
            name: 'privos.lists.get',
            arguments: { listId: lId }
          });
          const detailParsed = JSON.parse(detailRes?.content?.[0]?.text || '{}');
          
          let stagesArr = detailParsed.stages || detailParsed.list?.stages || targetList.stages || [];
          
          if (!stagesArr || stagesArr.length === 0) {
            // Try to find the system config item
            const searchRes: any = await app.callServerTool({
              name: 'privos.lists.searchItems',
              arguments: { listId: lId, query: '[Hệ thống] Không xoá' }
            });
            const searchParsed = JSON.parse(searchRes?.content?.[0]?.text || '[]');
            const configItem = searchParsed.find((i: any) => (i.name || i.title || '').includes('[Hệ thống] Không xoá'));
            if (configItem && configItem.description) {
              try { stagesArr = JSON.parse(configItem.description); } catch (e) {}
            }
          }

          if (Array.isArray(stagesArr)) {
            stagesArr.forEach((s: any) => sMap[s._id || s.id] = s.name);
          }

          const fieldsArr = detailParsed.fieldDefinitions || detailParsed.list?.fieldDefinitions || targetList.fieldDefinitions || [];
          if (Array.isArray(fieldsArr)) {
            fieldsArr.forEach((fd: any) => fMap[fd._id || fd.id] = fd.name);
          }
        } catch (err) {
          console.error("Failed to fetch full list details for stages", err);
        }

        const itemsRes: any = await app.callServerTool({
          name: 'privos.lists.getItems',
          arguments: { listId: lId }
        });
        const itemsParsed = JSON.parse(itemsRes?.content?.[0]?.text || '[]');
        let items = Array.isArray(itemsParsed) ? itemsParsed : (itemsParsed.items || []);
        items = items.filter((item: any) => !(item.name || item.title || '').includes('[Hệ thống] Không xoá'));

        const loadedCvs: CVProfile[] = items.map((item: any) => {
          let score, category, reason;
          if (Array.isArray(item.customFields)) {
            item.customFields.forEach((cf: any) => {
              const fieldIdStr = cf.fieldId || cf.fieldDefinitionId;
              const fieldName = (fMap[fieldIdStr] || fieldIdStr || '').toLowerCase();
              if (fieldName.includes('tổng điểm') || fieldName.includes('tong_diem') || fieldName.includes('điểm')) score = cf.value;
              else if (fieldName.includes('phân loại') || fieldName.includes('phan_loai') || fieldName.includes('loại')) category = cf.value;
              else if (fieldName.includes('lý do') || fieldName.includes('ly_do') || fieldName.includes('nhận xét')) reason = cf.value;
            });
          } else if (item.customFields && typeof item.customFields === 'object') {
            Object.keys(item.customFields).forEach(key => {
              const fieldName = (fMap[key] || key || '').toLowerCase();
              const val = item.customFields[key];
              if (fieldName.includes('tổng điểm') || fieldName.includes('tong_diem') || fieldName.includes('điểm')) score = val;
              else if (fieldName.includes('phân loại') || fieldName.includes('phan_loai') || fieldName.includes('loại')) category = val;
              else if (fieldName.includes('lý do') || fieldName.includes('ly_do') || fieldName.includes('nhận xét')) reason = val;
            });
          }
          // Fallback deduce stageId if sMap is missing this specific stageId
          if (!sMap[item.stageId] && item.stageId && category) {
            const normalized = String(category || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').trim();
            if (normalized.includes('KHONG DAT') || normalized.includes('KHONG TUYEN')) {
              sMap[item.stageId] = '02_Loai_CV';
            } else if (normalized.includes('DAT') || normalized.includes('CAN NHAC')) {
              sMap[item.stageId] = '03_Tiem_Nang';
            } else {
              sMap[item.stageId] = '01_Dau_Vao';
            }
          }

          return {
            _id: item._id || item.id,
            name: item.name || item.title || 'Không tên',
            status: sMap[item.stageId] || item.stage || item.status || '01_Dau_Vao',
            score,
            category,
            reason
          };
        });

        loadedBoards.push({
          listId: lId,
          listName: targetList.name,
          stagesMap: sMap,
          cvs: loadedCvs
        });
      }
      
      if (reqId === requestRef.current) {
        setBoards(loadedBoards);
      }
    } catch (err) {
      console.error(err);
      if (reqId === requestRef.current) {
        setBoards([]);
      }
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [app, roomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMove = async (listId: string, id: string, newStatus: string) => {
    if (!app) return;
    
    const board = boards.find(b => b.listId === listId);
    if (!board) return;

    // Find stageId for newStatus
    const stageId = Object.keys(board.stagesMap).find(k => board.stagesMap[k] === newStatus);
    if (!stageId) return;

    // Optimistic
    setBoards(prev => prev.map(b => {
      if (b.listId === listId) {
        return { ...b, cvs: b.cvs.map(cv => cv._id === id ? { ...cv, status: newStatus } : cv) };
      }
      return b;
    }));

    try {
      await app.callServerTool({
        name: 'privos.lists.moveItemToStage',
        arguments: { itemId: id, stageId }
      });
    } catch (err) {
      console.error(err);
      // Revert could be implemented here
    }
  };

  const displayedBoards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return boards;
    return boards.filter(b => b.listName.toLowerCase().includes(q));
  }, [boards, searchQuery]);

  const handleRefresh = () => {
    setSearchQuery('');
    loadData();
  };

  return (
    <div className="hr-terminal-ui">
      <header className="hr-header-block">
        <div className="header-content">
          <h2 className="hr-title">CV đã chấm</h2>
          <p className="hr-subtitle">Kanban hiển thị kết quả lọc CV theo đợt tuyển dụng.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            className="pl-input" 
            placeholder="Tìm kiếm List Kanban..."
            style={{ height: '38px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', minWidth: '220px' }}
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
          <button className="hr-btn" onClick={handleRefresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Làm mới
          </button>
        </div>
      </header>

      {loading ? (
        <div className="kanban-loading">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu CV...</p>
        </div>
      ) : displayedBoards.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Không tìm thấy danh sách chấm điểm nào{searchQuery ? ` phù hợp với "${searchQuery}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {displayedBoards.map(board => (
            <CVBoard key={board.listId} board={board} onMove={handleMove} />
          ))}
        </div>
      )}
    </div>
  );
}
