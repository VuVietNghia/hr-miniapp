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
  email?: string;
  sdt?: string;
}

const CV_COLUMNS = [
  { status: '02_Loai_CV', label: 'Loại', color: '#ef4444' },
  { status: '03_Tiem_Nang', label: 'Tiềm năng', color: '#22c55e' },
  { status: '05_Moi_Phong_Van', label: 'Mời phỏng vấn', color: '#eab308' },
  { status: '06_Sai_JD', label: 'Sai JD', color: '#f59e0b' },
  { status: '07_CV_Cu', label: 'CV cũ', color: '#9ca3af' },
];

function CVCard({ 
  cv, 
  listName,
  onMove, 
  onInvite,
  onSelectDetail 
}: { 
  cv: CVProfile, 
  listName: string,
  onMove: (id: string, newStatus: string) => void, 
  onInvite: (cv: CVProfile, posName?: string) => void,
  onSelectDetail: (cv: CVProfile, listName: string) => void
}) {
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
      onClick={() => onSelectDetail(cv, listName)}
      title="Bấm để xem thông tin chi tiết & nhận xét AI (hoặc Kéo thả CV)"
      style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
    >
      <div className="profile-card-header">
        <div className="profile-name-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="profile-avatar" style={{ backgroundColor: 'var(--accent)', flexShrink: 0 }}>{initials}</div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <div className="profile-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }} title={cv.name}>{displayName}</div>
            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
              {cv.status === '05_Moi_Phong_Van' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onInvite(cv); }}
                  className="position-badge"
                  style={{
                    marginLeft: '4px',
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    border: '1px solid var(--accent, #156FF5)',
                    backgroundColor: 'rgba(21, 111, 245, 0.08)',
                    color: 'var(--accent, #156FF5)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent, #156FF5)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(21, 111, 245, 0.08)';
                    e.currentTarget.style.color = 'var(--accent, #156FF5)';
                  }}
                >
                  Gửi mail pv
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {cv.reason && (
        <div className="profile-details" style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {cv.reason.length > 180 ? cv.reason.substring(0, 180) + '...' : cv.reason}
        </div>
      )}
    </div>
  );
}

function CVColumn({ 
  column, 
  cvs, 
  listName,
  onMove, 
  onInvite,
  onSelectDetail
}: { 
  column: typeof CV_COLUMNS[0], 
  cvs: CVProfile[], 
  listName: string,
  onMove: (id: string, newStatus: string) => void, 
  onInvite: (cv: CVProfile, posName?: string) => void,
  onSelectDetail: (cv: CVProfile, listName: string) => void
}) {
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
          cvs.map(cv => (
            <CVCard 
              key={cv._id} 
              cv={cv} 
              listName={listName}
              onMove={onMove} 
              onInvite={onInvite} 
              onSelectDetail={onSelectDetail}
            />
          ))
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

function CVBoard({ 
  board, 
  onMove, 
  onInvite,
  onSelectDetail
}: { 
  board: CVBoardData, 
  onMove: (listId: string, id: string, newStatus: string) => void, 
  onInvite: (cv: CVProfile, posName?: string) => void,
  onSelectDetail: (cv: CVProfile, listName: string) => void
}) {
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
            cvs={board.cvs.filter(cv => cv.status === col.status || (col.status === '07_CV_Cu' && cv.status === '10_CV_Cu'))} 
            listName={board.listName}
            onMove={(id, newStatus) => onMove(board.listId, id, newStatus)} 
            onInvite={(cv) => onInvite(cv, board.listName.replace(/^JD\s+/i, ''))}
            onSelectDetail={onSelectDetail}
          />
        ))}
      </div>
    </div>
  );
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: 'var(--text)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderFormattedReason(reasonText: string) {
  if (!reasonText) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Chưa có nhận xét chi tiết từ hệ thống AI.</p>;
  
  const lines = reasonText.split('\n');
  return (
    <div style={{ fontSize: '13.5px', lineHeight: '1.68', color: 'var(--text)', fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '6px' }} />;
        
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '4px 0 4px 6px' }}>
              <span style={{ color: 'var(--accent, #156FF5)', fontSize: '14px', flexShrink: 0 }}>•</span>
              <div>{renderInlineBold(trimmed.replace(/^[-*•]\s*/, ''))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '4px 0 4px 6px' }}>
              <span style={{ color: 'var(--accent, #156FF5)', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>{numMatch[1]}.</span>
              <div>{renderInlineBold(numMatch[2])}</div>
            </div>
          );
        }

        return (
          <p key={idx} style={{ margin: '4px 0' }}>
            {renderInlineBold(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function CVScoredTab() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [boards, setBoards] = useState<CVBoardData[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCVForDetail, setSelectedCVForDetail] = useState<{ cv: CVProfile; listName: string } | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedCVForInvite, setSelectedCVForInvite] = useState<CVProfile | null>(null);
  
  const [inviteCandidateName, setInviteCandidateName] = useState('');
  const [invitePosition, setInvitePosition] = useState('');
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDate, setInviteDate] = useState('');
  const [inviteSubject, setInviteSubject] = useState('');
  const [inviteEmailBody, setInviteEmailBody] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleSendInviteEmail = async () => {
    if (!app) return;
    const targetEmail = inviteEmail.trim();
    
    if (!targetEmail) {
      alert('Vui lòng nhập địa chỉ email người nhận!');
      return;
    }

    if (!inviteSubject.trim() || !inviteEmailBody.trim()) {
      alert('Vui lòng nhập tiêu đề và nội dung thư mời');
      return;
    }

    setIsSendingInvite(true);
    try {
      await app.callServerTool({
        name: 'hrm.mail.send',
        arguments: {
          toName: inviteCandidateName || 'Ứng viên',
          toEmail: targetEmail,
          subject: inviteSubject,
          htmlContent: inviteEmailBody.replace(/\n/g, '<br/>')
        }
      });
      alert(`Đã gửi email mời phỏng vấn thành công tới ${targetEmail}!`);
      setInviteModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi gửi email:', err);
      alert('Lỗi gửi email: ' + (err.message || err));
    } finally {
      setIsSendingInvite(false);
    }
  };

  const inviteDateRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef(0);

  useEffect(() => {
    if (!inviteModalOpen) return;
    setInviteSubject(`Thư mời phỏng vấn - ${invitePosition || '[Vị trí]'} tại ${inviteCompany || '[Tên công ty]'}`);
    
    const formattedDate = inviteDate ? inviteDate.split('-').reverse().join('/') : '[Ngày, giờ]';
    const emailBody = `Xin chào ${inviteCandidateName || '[Tên ứng viên]'},

Cảm ơn bạn đã dành thời gian ứng tuyển vào vị trí ${invitePosition || '[Tên vị trí]'} tại ${inviteCompany || '[Tên công ty]'}! Chúng tôi đã xem xét hồ sơ của bạn và rất ấn tượng với những gì bạn có. Vì vậy, chúng tôi mong muốn có cơ hội gặp gỡ và trao đổi trực tiếp với bạn trong buổi phỏng vấn sắp tới.

Thời gian: ${formattedDate}

Địa điểm: [Địa chỉ công ty / Link phòng họp online]

Người liên hệ: [Tên + Số điện thoại / Email]

Nếu thời gian trên chưa phù hợp, bạn có thể phản hồi để sắp xếp lại lịch. Hãy xác nhận sự tham gia của bạn bằng cách trả lời email này trước [Thời hạn phản hồi].

Chúng tôi rất mong được gặp bạn và trao đổi thêm về cơ hội hợp tác!

Trân trọng,
[Thông tin liên hệ của HR hoặc công ty]`;
    setInviteEmailBody(emailBody);
  }, [inviteCandidateName, invitePosition, inviteCompany, inviteDate, inviteModalOpen]);

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
          let score, category, reason, email, sdt;
          if (Array.isArray(item.customFields)) {
            item.customFields.forEach((cf: any) => {
              const fieldIdStr = cf.fieldId || cf.fieldDefinitionId;
              const fieldName = (fMap[fieldIdStr] || fieldIdStr || '').toLowerCase();
              if (fieldName.includes('tổng điểm') || fieldName.includes('tong_diem') || fieldName.includes('điểm')) score = cf.value;
              else if (fieldName.includes('phân loại') || fieldName.includes('phan_loai') || fieldName.includes('loại')) category = cf.value;
              else if (fieldName.includes('lý do') || fieldName.includes('ly_do') || fieldName.includes('nhận xét')) reason = cf.value;
              else if (fieldName.includes('email') || fieldName.includes('thu_dien_tu')) email = cf.value;
              else if (fieldName.includes('sdt') || fieldName.includes('sđt') || fieldName.includes('phone') || fieldName.includes('điện thoại')) sdt = cf.value;
            });
          } else if (item.customFields && typeof item.customFields === 'object') {
            Object.keys(item.customFields).forEach(key => {
              const fieldName = (fMap[key] || key || '').toLowerCase();
              const val = item.customFields[key];
              if (fieldName.includes('tổng điểm') || fieldName.includes('tong_diem') || fieldName.includes('điểm')) score = val;
              else if (fieldName.includes('phân loại') || fieldName.includes('phan_loai') || fieldName.includes('loại')) category = val;
              else if (fieldName.includes('lý do') || fieldName.includes('ly_do') || fieldName.includes('nhận xét')) reason = val;
              else if (fieldName.includes('email') || fieldName.includes('thu_dien_tu')) email = val;
              else if (fieldName.includes('sdt') || fieldName.includes('sđt') || fieldName.includes('phone') || fieldName.includes('điện thoại')) sdt = val;
            });
          }

          // Fallback: scanner for candidate email if not present in customFields
          const textToScan = `${item.name || ''} ${item.title || ''} ${reason || ''} ${item.description || ''}`;
          if (!email) {
            const gmailMatch = textToScan.match(/[a-zA-Z0-9._%+-]+@gmail\.com/i);
            if (gmailMatch) {
              email = gmailMatch[0].toLowerCase();
            } else {
              const generalMatch = textToScan.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
              if (generalMatch) {
                email = generalMatch[0].toLowerCase();
              }
            }
          }

          if (!sdt) {
            const phoneMatch = textToScan.match(/(?:\+84|84|0)[35789][0-9\s\.\-]{8,12}\b/);
            if (phoneMatch) {
              sdt = phoneMatch[0].replace(/[^\d+]/g, '');
            }
          }

          // Fallback deduce stageId if sMap is missing this specific stageId
          if (!sMap[item.stageId] && item.stageId && category) {
            const normalized = String(category || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').trim();
            if (normalized.includes('SAI JD')) {
              sMap[item.stageId] = '06_Sai_JD';
            } else if (normalized.includes('KHONG DAT') || normalized.includes('KHONG TUYEN')) {
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
            reason,
            email: email || '',
            sdt: sdt || ''
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
    let stageId = Object.keys(board.stagesMap).find(k => board.stagesMap[k] === newStatus);
    if (!stageId && newStatus === '07_CV_Cu') {
      stageId = Object.keys(board.stagesMap).find(k => board.stagesMap[k] === '10_CV_Cu');
    }
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
            <CVBoard 
              key={board.listId} 
              board={board} 
              onMove={handleMove} 
              onInvite={(cv, posName) => {
                let cleanName = cv.name.replace(/\.md$/i, '');
                const cvIndex = cleanName.indexOf('_CV_');
                if (cvIndex !== -1) {
                  cleanName = cleanName.substring(cvIndex + 4);
                }
                cleanName = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
                
                let cleanPos = posName || '';
                cleanPos = cleanPos.replace(/^SCREENING_/i, '').replace(/_/g, ' ');

                setSelectedCVForInvite(cv);
                setInviteCandidateName(cleanName);
                setInvitePosition(cleanPos);
                setInviteCompany('Công ty ABC');
                setInviteEmail(cv.email || '');
                setInviteDate('');
                setInviteModalOpen(true);
              }}
              onSelectDetail={(cv, listName) => {
                setSelectedCVForDetail({ cv, listName });
                setDetailModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* CV Detail & AI Scoring Modal Popup */}
      {detailModalOpen && selectedCVForDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '800px',
              maxWidth: '95%',
              maxHeight: '88vh',
              backgroundColor: 'var(--bg-card, #fff)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10000,
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light, #e2e8f0)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--accent, #156FF5)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '18px',
                    boxShadow: '0 4px 12px rgba(21,111,245,0.25)'
                  }}
                >
                  {selectedCVForDetail.cv.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                    {selectedCVForDetail.cv.name}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Đợt tuyển dụng: <strong>{selectedCVForDetail.listName}</strong></span>
                    {selectedCVForDetail.cv.email && <span>✉️ Email: <strong>{selectedCVForDetail.cv.email}</strong></span>}
                    {selectedCVForDetail.cv.sdt && <span>📞 SĐT: <strong>{selectedCVForDetail.cv.sdt}</strong></span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--text-muted)',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Stats Summary Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: 'var(--bg-subtle, var(--bg-card))', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light, var(--border))' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Tổng điểm AI
                </span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: selectedCVForDetail.cv.score && Number(selectedCVForDetail.cv.score) >= 75 ? '#22c55e' : selectedCVForDetail.cv.score && Number(selectedCVForDetail.cv.score) >= 50 ? '#eab308' : '#ef4444', marginTop: '2px' }}>
                  {selectedCVForDetail.cv.score !== undefined ? `${selectedCVForDetail.cv.score}/100` : 'N/A'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle, var(--bg-card))', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light, var(--border))' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Phân loại AI
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
                  {selectedCVForDetail.cv.category || 'Chưa phân loại'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle, var(--bg-card))', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light, var(--border))' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Trạng thái Kanban
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
                  {CV_COLUMNS.find(c => c.status === selectedCVForDetail.cv.status)?.label || selectedCVForDetail.cv.status}
                </div>
              </div>
            </div>

            {/* AI Detailed Assessment Content Container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '15px' }}>🤖</span>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  Mô tả AI chấm điểm & nhận xét chi tiết CV
                </h4>
              </div>
              <div
                className="pl-no-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  padding: '16px 18px',
                  backgroundColor: 'var(--bg-subtle, var(--bg-card))',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light, var(--border))',
                  color: 'var(--text)',
                }}
              >
                {renderFormattedReason(selectedCVForDetail.cv.reason || '')}
              </div>
            </div>
          </div>
        </div>
      )}

      {inviteModalOpen && selectedCVForInvite && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '850px', 
              maxWidth: '95%', 
              backgroundColor: 'var(--bg-card, #fff)', 
              borderRadius: '12px', 
              padding: '24px', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10000
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Gửi thư mời phỏng vấn</h3>
              <button 
                onClick={() => setInviteModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-muted)', padding: '4px' }}
                title="Đóng"
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Left Column: Form Fields */}
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên ứng viên</label>
                  <input type="text" className="pl-input" value={inviteCandidateName} onChange={e => setInviteCandidateName(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Email ứng viên</label>
                  <input type="email" className="pl-input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Ví dụ: ungvien@gmail.com" style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên vị trí</label>
                  <input type="text" className="pl-input" value={invitePosition} onChange={e => setInvitePosition(e.target.value)} placeholder="Nhập tên vị trí" style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên công ty</label>
                  <input type="text" className="pl-input" value={inviteCompany} onChange={e => setInviteCompany(e.target.value)} placeholder="Nhập tên công ty" style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Thời gian phỏng vấn</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="pl-input" 
                      readOnly 
                      placeholder="dd/mm/yyyy"
                      value={inviteDate ? inviteDate.split('-').reverse().join('/') : ''} 
                      style={{ width: '100%', paddingRight: '40px', cursor: 'pointer', backgroundColor: 'var(--bg-subtle)' }} 
                    />
                    <div style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#156FF5', display: 'flex', alignItems: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <input 
                      type="date"
                      ref={inviteDateRef}
                      value={inviteDate}
                      onChange={e => setInviteDate(e.target.value)}
                      onClick={(e) => {
                        try { e.currentTarget.showPicker(); } catch (err) {}
                      }}
                      style={{ 
                        position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
                        opacity: 0, cursor: 'pointer' 
                      }} 
                    />
                  </div>
                </div>
              </div>
              
              {/* Right Column: Preview */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tiêu đề (Cập nhật tự động)</label>
                  <input type="text" className="pl-input" value={inviteSubject} onChange={e => setInviteSubject(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Nội dung thư mời (Cập nhật tự động)</label>
                  <textarea className="pl-input" style={{ width: '100%', flex: 1, minHeight: '260px', resize: 'vertical' }} value={inviteEmailBody} onChange={e => setInviteEmailBody(e.target.value)} />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="hr-btn" onClick={() => {
                alert('Đã tải nội dung email!');
              }}>Tải email về</button>
              <button 
                className="hr-btn hr-btn-primary" 
                disabled={isSendingInvite} 
                style={{ backgroundColor: '#156FF5', color: '#fff', borderColor: '#156FF5' }} 
                onClick={handleSendInviteEmail}
              >
                {isSendingInvite ? 'Đang gửi...' : 'Gửi email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
