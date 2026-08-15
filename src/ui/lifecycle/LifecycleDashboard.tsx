import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { EmployeeProfile, PassedCandidate } from './types';
import { PrivOSLifecycleService } from './services/PrivOSLifecycleService';
import { LifecycleServiceProvider, useLifecycleService } from './di/LifecycleContext';
import { KanbanBoard } from './components/KanbanBoard';
import { ProfileListView } from './components/ProfileListView';
import { CreateProfileForm } from './components/CreateProfileForm';
import { CreateDetailedProfileForm } from './components/CreateDetailedProfileForm';
import { usePolling } from '../hooks/usePolling';
import '../hr-premium-styles.css';

function areCandidatesEqual(prev: PassedCandidate[], next: PassedCandidate[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (
      prev[i]._id !== next[i]._id ||
      prev[i].name !== next[i].name ||
      prev[i].score !== next[i].score ||
      prev[i].position !== next[i].position
    ) {
      return false;
    }
  }
  return true;
}

function LifecycleContent() {
  const { roomId } = usePrivosContext();
  const service = useLifecycleService();
  
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [passedCandidates, setPassedCandidates] = useState<PassedCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{text: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const refreshCandidates = useCallback(async (isSilent = false) => {
    if (!roomId) return;
    if (!isSilent) setIsLoadingCandidates(true);
    try {
      const candidates = await service.loadPassedCandidates(roomId);
      setPassedCandidates((prev) => (areCandidatesEqual(prev, candidates) ? prev : candidates));
    } catch (err) {
      console.error('[LifecycleDashboard] Error loading candidates:', err);
    } finally {
      if (!isSilent) setIsLoadingCandidates(false);
    }
  }, [roomId, service]);

  // Bộ đếm polling 1 giây/lần khi form thêm nhân sự đang mở
  usePolling(
    useCallback(() => refreshCandidates(true), [refreshCandidates]),
    { enabled: isCreating, interval: 1000 }
  );

  useEffect(() => {
    if (roomId) {
      refreshProfiles();
      refreshCandidates();
    }
  }, [roomId, service, refreshCandidates]);

  const refreshProfiles = async () => {
    if (!roomId) return;
    setIsLoading(true);
    const data = await service.loadProfiles(roomId);
    setProfiles(data);
    setIsLoading(false);
  };

  const handleCreateSubmit = async (data: Omit<EmployeeProfile, '_id' | 'status'> & { attachedFileObj?: any }) => {
    if (!roomId) return;
    setStatusMsg({ text: `Đang khởi tạo hồ sơ cho "${data.name}"...`, type: 'info' });
    
    // Create via service
    const newProfile = await service.createProfile(roomId, data);
    
    // Optimistic UI update
    setProfiles(prev => [...prev, newProfile]);
    setStatusMsg({ text: `Đã thêm hồ sơ "${data.name}" thành công!`, type: 'success' });
    
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

  // Status counts for quick filter pills
  const statusCounts = useMemo(() => {
    const counts = {
      all: profiles.length,
      wait: profiles.filter(p => p.status === 'Mới nhận việc').length,
      probation: profiles.filter(p => p.status === 'Đang thử việc').length,
      official: profiles.filter(p => p.status === 'Chính thức').length,
      resigned: profiles.filter(p => p.status === 'Nghỉ việc').length,
    };
    return counts;
  }, [profiles]);

  // Filtered profiles based on search, department, and selectedStatus (for list view)
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchDept = selectedDept === 'Tất cả' || p.department === selectedDept;
      if (!matchDept) return false;

      // In list view, apply status filtering directly
      if (viewMode === 'list' && selectedStatus !== 'all' && p.status !== selectedStatus) {
        return false;
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(term);
      const matchPhone = p.phone?.toLowerCase().includes(term) ?? false;
      const matchEmail = p.email?.toLowerCase().includes(term) ?? false;
      const matchPosition = p.position?.toLowerCase().includes(term) ?? false;

      return matchName || matchPhone || matchEmail || matchPosition;
    });
  }, [profiles, selectedDept, searchTerm, viewMode, selectedStatus]);

  // Available candidates not yet onboarded
  const availableCandidates = useMemo(() => {
    return passedCandidates.filter(
      c => {
        // Kiểm tra xem ứng viên này đã được tạo hồ sơ chưa (dựa theo ID Kanban card)
        const onboardedById = profiles.some(p => p.sourceCandidateId === c._id);
        if (onboardedById) return false;

        // Fallback cho data cũ (chưa lưu sourceCandidateId): lọc theo tên
        const onboardedByName = profiles.some(p => !p.sourceCandidateId && p.name === c.name);
        if (onboardedByName) return false;

        return true;
      }
    );
  }, [passedCandidates, profiles]);

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
            onClick={() => {
              refreshProfiles();
              refreshCandidates();
            }}
            disabled={isLoading || isLoadingCandidates}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Làm mới
          </button>
          <button 
            className="hr-btn hr-btn-accent" 
            onClick={() => {
              const nextState = !isCreating;
              setIsCreating(nextState);
              if (nextState) {
                refreshCandidates();
              }
            }}
          >
            {isCreating ? 'Đóng form' : '+ Tạo Hồ Sơ Mới'}
          </button>
        </div>
      </header>

      {isCreating && (
        <CreateDetailedProfileForm 
          onSubmit={handleCreateSubmit} 
          onCancel={() => setIsCreating(false)} 
          passedCandidates={availableCandidates}
          isLoadingCandidates={isLoadingCandidates}
        />
      )}

      {statusMsg && (
        <div className={`hr-status-banner hr-status-${statusMsg.type}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="hr-toolbar">
        <div className="hr-toolbar-left" style={{ flexWrap: 'wrap', gap: '8px' }}>
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

          {/* Status Quick Filters */}
          <div className="hr-pill-group">
            <button
              type="button"
              className={`hr-filter-pill ${selectedStatus === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('all')}
            >
              Tất cả ({statusCounts.all})
            </button>
            <button
              type="button"
              className={`hr-filter-pill ${selectedStatus === 'Mới nhận việc' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Mới nhận việc')}
            >
              Chờ hồ sơ ({statusCounts.wait})
            </button>
            <button
              type="button"
              className={`hr-filter-pill ${selectedStatus === 'Đang thử việc' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Đang thử việc')}
            >
              Thử việc ({statusCounts.probation})
            </button>
            <button
              type="button"
              className={`hr-filter-pill ${selectedStatus === 'Chính thức' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Chính thức')}
            >
              Chính thức ({statusCounts.official})
            </button>
            <button
              type="button"
              className={`hr-filter-pill ${selectedStatus === 'Nghỉ việc' ? 'active' : ''}`}
              onClick={() => setSelectedStatus('Nghỉ việc')}
            >
              Nghỉ việc ({statusCounts.resigned})
            </button>
          </div>

          {/* Department Filter */}
          {departments.length > 2 && (
            <div className="hr-pill-group" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
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
          )}
        </div>

        <div className="hr-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View Mode Switcher */}
          <div className="hr-view-toggle">
            <button
              type="button"
              className={`hr-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Xem dạng Bảng Kanban"
            >
              📊 Kanban
            </button>
            <button
              type="button"
              className={`hr-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Xem dạng Danh sách"
            >
              📋 Danh sách
            </button>
          </div>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #6C737A)' }}>
            Hiển thị <strong>{filteredProfiles.length}</strong> / {profiles.length} nhân sự
          </span>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <KanbanBoard 
          profiles={filteredProfiles} 
          isLoading={isLoading} 
          selectedColumnStatus={selectedStatus}
          onMoveProfile={handleMoveProfile}
        />
      ) : (
        <ProfileListView 
          profiles={filteredProfiles}
          isLoading={isLoading}
          onMoveProfile={handleMoveProfile}
        />
      )}
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
