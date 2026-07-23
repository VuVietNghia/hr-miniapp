import { useState, useEffect } from 'react';
import { usePrivosApp, usePrivosContext, McpApp } from '@privos/app-react';
import { restCall } from './privos-rest';

// ─── Types ───
interface EmployeeProfile {
  _id: string;
  name: string;
  status: string;
  mst: string;
  bankAccount: string;
}

const KANBAN_COLUMNS = [
  { status: 'Mới nhận việc', label: 'Đang chờ hoàn thiện hồ sơ', color: '#f59e0b' },
  { status: 'Đang thử việc', label: 'Đang thử việc', color: '#3b82f6' },
  { status: 'Chính thức', label: 'Nhân viên chính thức', color: '#10b981' },
] as const;

// ─── Service helper: Fetch từ PrivOS Lists API ───
async function fetchProfiles(app: McpApp, roomId: string): Promise<EmployeeProfile[]> {
  try {
    // Dùng callServerTool đúng pattern codebase — tìm list có tên "nhan-su" hoặc "employees"
    const res: any = await app.callServerTool({
      name: 'privos.lists.getAll',
      arguments: { channelId: roomId }
    });

    const text = res?.content?.[0]?.text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    const lists = Array.isArray(parsed) ? parsed : (parsed?.lists || []);

    // Tìm list có tên chứa "nhan-su" hoặc "employee" hoặc "lifecycle"
    const hrList = lists.find((l: any) =>
      ['nhan-su', 'nhansu', 'employee', 'lifecycle', 'hồ sơ'].some(kw =>
        (l.name || '').toLowerCase().includes(kw)
      )
    );

    if (!hrList) {
      console.log('[Lifecycle] Không tìm thấy list nhân sự. Trả data mẫu.');
      return getDefaultProfiles();
    }

    // Fetch items từ list đó
    const itemsRes: any = await app.callServerTool({
      name: 'privos.lists.getItems',
      arguments: { listId: hrList._id }
    });

    const itemsText = itemsRes?.content?.[0]?.text;
    if (!itemsText) return getDefaultProfiles();

    const itemsParsed = JSON.parse(itemsText);
    const items = Array.isArray(itemsParsed) ? itemsParsed : (itemsParsed?.items || []);

    return items.map((item: any) => ({
      _id: item._id || item.id,
      name: item.name || item.title || 'Không có tên',
      status: item.status || item.stage || 'Mới nhận việc',
      mst: item.mst || item.taxCode || '',
      bankAccount: item.bankAccount || item.bank || '',
    }));
  } catch (err) {
    console.warn('[Lifecycle] Lỗi khi fetch profiles, dùng data mẫu:', err);
    return getDefaultProfiles();
  }
}

function getDefaultProfiles(): EmployeeProfile[] {
  return [
    { _id: 'sample-1', name: 'Nguyễn Văn A', status: 'Mới nhận việc', mst: '', bankAccount: '' },
    { _id: 'sample-2', name: 'Lê Thị B', status: 'Đang thử việc', mst: '0123456789', bankAccount: '123456 - VCB' },
    { _id: 'sample-3', name: 'Trần Văn C', status: 'Chính thức', mst: '9876543210', bankAccount: '654321 - TCB' },
  ];
}

// ─── Component ───
export default function LifecycleDashboard() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (app && roomId) {
      loadProfiles();
    }
  }, [app, roomId]);

  const loadProfiles = async () => {
    if (!app || !roomId) return;
    setIsLoading(true);
    try {
      const data = await fetchProfiles(app, roomId);
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setProfiles(getDefaultProfiles());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    const name = prompt('Nhập tên nhân sự mới:');
    if (!name || !app || !roomId) return;

    setStatusMsg(`Đang tạo hồ sơ "${name}"...`);
    try {
      // Thử tạo qua Lists API
      await app.callServerTool({
        name: 'privos.lists.create_item',
        arguments: {
          channelId: roomId,
          listName: 'nhan-su',
          item: {
            name,
            status: 'Mới nhận việc',
            mst: '',
            bankAccount: ''
          }
        }
      });
      setStatusMsg(`Đã tạo hồ sơ "${name}" thành công!`);
      await loadProfiles();
    } catch (err: any) {
      // Fallback: thêm vào state local
      setProfiles(prev => [...prev, {
        _id: `local-${Date.now()}`,
        name,
        status: 'Mới nhận việc',
        mst: '',
        bankAccount: ''
      }]);
      setStatusMsg(`Đã thêm "${name}" (chế độ offline — chưa lưu lên server).`);
    }
  };

  if (!app || !roomId) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang kết nối đến PrivOS...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
            Hồ sơ & Vòng đời nhân sự
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Quản lý thông tin, hợp đồng và tiến độ công việc của nhân sự nội bộ.
          </p>
        </div>
        <button className="primary-btn" onClick={handleCreateProfile}>+ Tạo Hồ Sơ Mới</button>
      </header>

      {statusMsg && (
        <div style={{ padding: '10px 15px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '13px' }}>
          {statusMsg}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', minHeight: '400px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải dữ liệu Kanban...</div>
        ) : (
          <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
            {KANBAN_COLUMNS.map(col => {
              const colProfiles = profiles.filter(p => p.status === col.status);
              return (
                <div key={col.status} style={{ flex: '0 0 300px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 15px', borderBottom: `2px solid ${col.color}`, fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{col.label}</span>
                    <span style={{ background: col.color, color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
                      {colProfiles.length}
                    </span>
                  </div>
                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100px' }}>
                    {colProfiles.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>Trống</p>
                    ) : (
                      colProfiles.map(p => <ProfileCard key={p._id} profile={p} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: EmployeeProfile }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>👤 {profile.name}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div><span style={{ fontWeight: 500 }}>MST:</span> {profile.mst || 'Chưa cập nhật'}</div>
        <div><span style={{ fontWeight: 500 }}>STK:</span> {profile.bankAccount || 'Chưa cập nhật'}</div>
      </div>
    </div>
  );
}
