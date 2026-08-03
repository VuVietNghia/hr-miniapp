import { useState, useEffect, useMemo } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { EmployeeProfile } from './types';
import { PrivOSLifecycleService } from './services/PrivOSLifecycleService';
import { LifecycleServiceProvider, useLifecycleService } from './di/LifecycleContext';
import { KanbanBoard } from './components/KanbanBoard';
import { CreateProfileForm } from './components/CreateProfileForm';
import '../hr-premium-styles.css';

function LifecycleContent() {
  const { roomId } = usePrivosContext();
  const service = useLifecycleService();
  
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{text: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('Tất cả');

  useEffect(() => {
    if (roomId) {
      refreshProfiles();
    }
  }, [roomId, service]);

  const refreshProfiles = async () => {
    if (!roomId) return;
    setIsLoading(true);
    const data = await service.loadProfiles(roomId);
    setProfiles(data);
    setIsLoading(false);
  };

  const handleCreateSubmit = async (data: Omit<EmployeeProfile, '_id' | 'status'>) => {
    if (!roomId) return;
    setStatusMsg({ text: `Đang khởi tạo hồ sơ cho "${data.name}"...`, type: 'info' });
    
    // Create via service
    const newProfile = await service.createProfile(roomId, data);
    
    // Optimistic UI update
    setProfiles(prev => [...prev, newProfile]);
    setStatusMsg({ text: `Đã thêm hồ sơ "${data.name}" thành công!`, type: 'success' });
    setIsCreating(false);
    
    setTimeout(() => setStatusMsg(null), 3000);

    // Sync from server silently to get real ID and fields
    const updatedProfiles = await service.loadProfiles(roomId);
    setProfiles(updatedProfiles);
  };

  const handleMoveProfile = async (profileId: string, newStatus: string) => {
    if (!roomId) return;
    
    const targetProfile = profiles.find(p => p._id === profileId);
    if (!targetProfile || targetProfile.status === newStatus) return;

    const oldStatus = targetProfile.status;

    // Optimistic Update: instantly update local state
    setProfiles(prev => prev.map(p => p._id === profileId ? { ...p, status: newStatus } : p));
    setStatusMsg({ 
      text: `Đã chuyển "${targetProfile.name}" sang [${newStatus}]`, 
      type: 'success' 
    });

    try {
      await service.updateProfileStatus(roomId, profileId, newStatus);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('[LifecycleDashboard] Error updating profile status:', err);
      // Revert optimistic update on failure
      setProfiles(prev => prev.map(p => p._id === profileId ? { ...p, status: oldStatus } : p));
      setStatusMsg({ 
        text: `Lỗi khi đồng bộ trạng thái cho "${targetProfile.name}". Đã khôi phục lại vị trí cũ.`, 
        type: 'error' 
      });
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  // Extract distinct departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach(p => {
      if (p.department && p.department.trim()) {
        set.add(p.department.trim());
      }
    });
    return ['Tất cả', ...Array.from(set)];
  }, [profiles]);

  // Filtered profiles based on search and department
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchDept = selectedDept === 'Tất cả' || p.department === selectedDept;
      if (!matchDept) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(term);
      const matchPhone = p.phone?.toLowerCase().includes(term) ?? false;
      const matchEmail = p.email?.toLowerCase().includes(term) ?? false;
      const matchPosition = p.position?.toLowerCase().includes(term) ?? false;

      return matchName || matchPhone || matchEmail || matchPosition;
    });
  }, [profiles, selectedDept, searchTerm]);

  return (
    <div className="hr-terminal-ui">
      <header className="hr-header-block">
        <div className="header-content">
          <h2 className="hr-title">Hồ sơ & Vòng đời nhân sự</h2>
          <p className="hr-subtitle">
            Quản lý thông tin, hợp đồng và lộ trình phát triển của từng nhân sự.
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="hr-btn" 
            onClick={refreshProfiles}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Làm mới
          </button>
          <button 
            className="hr-btn hr-btn-accent" 
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'Đóng form' : '+ Tạo Hồ Sơ Mới'}
          </button>
        </div>
      </header>

      {isCreating && (
        <CreateProfileForm 
          onSubmit={handleCreateSubmit} 
          onCancel={() => setIsCreating(false)} 
        />
      )}

      {statusMsg && (
        <div className={`hr-status-banner hr-status-${statusMsg.type}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="hr-toolbar">
        <div className="hr-toolbar-left">
          <div className="hr-search-box">
            <span className="hr-search-icon">🔍</span>
            <input 
              type="text"
              className="hr-search-input"
              placeholder="Tìm theo tên, SĐT, email, vị trí..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="hr-pill-group">
            {departments.map(dept => (
              <button
                key={dept}
                type="button"
                className={`hr-filter-pill ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
        <div className="hr-toolbar-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #6C737A)' }}>
            Hiển thị <strong>{filteredProfiles.length}</strong> / {profiles.length} nhân sự
          </span>
        </div>
      </div>

      <KanbanBoard 
        profiles={filteredProfiles} 
        isLoading={isLoading} 
        onMoveProfile={handleMoveProfile}
      />
    </div>
  );
}

export default function LifecycleDashboard() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const service = useMemo(() => {
    if (!app) return null;
    return new PrivOSLifecycleService(app);
  }, [app]);

  if (!app || !roomId || !service) {
    return (
      <div className="lifecycle-connecting">
        <div className="spinner"></div>
        <p>Đang kết nối đến hệ thống PrivOS...</p>
      </div>
    );
  }

  return (
    <LifecycleServiceProvider service={service}>
      <LifecycleContent />
    </LifecycleServiceProvider>
  );
}
