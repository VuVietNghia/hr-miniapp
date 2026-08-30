import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos_ai/app-react';
import { EmployeeProfile, PassedCandidate } from './types';
import { PrivOSLifecycleService } from './services/PrivOSLifecycleService';
import { createRoomClients } from '../platform/create-room-clients';
import { LifecycleServiceProvider, useLifecycleService } from './di/LifecycleContext';
import { EmployeeEmailTemplateProvider } from './di/EmployeeEmailTemplateContext';
import { BuiltinEmployeeEmailTemplateProvider, type IEmployeeEmailTemplateProvider } from './email/EmployeeEmailTemplateProvider';
import { KanbanBoard } from './components/KanbanBoard';
import { ProfileListView } from './components/ProfileListView';
import { CreateDetailedProfileForm } from './components/CreateDetailedProfileForm';
import { usePolling } from '../hooks/usePolling';
import '../hr-premium-styles.css';
import { FEATURE_DEGRADED_BEHAVIOR, type FeatureCapabilities } from '../access/feature-capabilities';

function areCandidatesEqual(prev: PassedCandidate[], next: PassedCandidate[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (
      prev[i]._id !== next[i]._id ||
      prev[i].name !== next[i].name ||
      prev[i].score !== next[i].score ||
      prev[i].position !== next[i].position ||
      prev[i].email !== next[i].email ||
      prev[i].phone !== next[i].phone
    ) {
      return false;
    }
  }
  return true;
}

function areProfilesEqual(prev: EmployeeProfile[], next: EmployeeProfile[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((profile, index) => {
    const candidate = next[index];
    return profile._id === candidate._id
      && profile.name === candidate.name
      && profile.status === candidate.status
      && profile.phone === candidate.phone
      && profile.email === candidate.email
      && profile.position === candidate.position
      && profile.department === candidate.department
      && profile.startDate === candidate.startDate
      && profile.sourceCandidateId === candidate.sourceCandidateId;
  });
}

function LifecycleContent({ capabilities }: { capabilities: FeatureCapabilities }) {
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
  const isRefreshingProfilesRef = useRef(false);
  const isRefreshingCandidatesRef = useRef(false);

  const refreshCandidates = useCallback(async (isSilent = false) => {
    if (!roomId || !capabilities.listsReadable || isRefreshingCandidatesRef.current) return;
    isRefreshingCandidatesRef.current = true;
    if (!isSilent) setIsLoadingCandidates(true);
    try {
      const candidates = await service.loadPassedCandidates(roomId);
      setPassedCandidates((prev) => (areCandidatesEqual(prev, candidates) ? prev : candidates));
    } catch {
      if (!isSilent) {
        setStatusMsg({ text: 'Không thể tải danh sách ứng viên đạt.', type: 'error' });
      }
    } finally {
      isRefreshingCandidatesRef.current = false;
      if (!isSilent) setIsLoadingCandidates(false);
    }
  }, [roomId, service, capabilities.listsReadable]);

  const refreshProfiles = useCallback(async (isSilent = false) => {
    if (!roomId || !capabilities.listsReadable || isRefreshingProfilesRef.current) return;
    isRefreshingProfilesRef.current = true;
    if (!isSilent) setIsLoading(true);

    try {
      const data = await service.loadProfiles(roomId);
      setProfiles((previous) => (areProfilesEqual(previous, data) ? previous : data));
    } catch {
      if (!isSilent) {
        setStatusMsg({ text: 'Không thể tải danh sách hồ sơ nhân sự.', type: 'error' });
      }
    } finally {
      isRefreshingProfilesRef.current = false;
      if (!isSilent) setIsLoading(false);
    }
  }, [roomId, service, capabilities.listsReadable]);

  // Đồng bộ hồ sơ mỗi giây khi tab đang hiển thị, không hiển thị loading lại trên UI.
  usePolling(
    useCallback(() => refreshProfiles(true), [refreshProfiles]),
    { enabled: Boolean(roomId) && capabilities.listsReadable, interval: 1000, immediate: false }
  );

  // Đồng bộ ứng viên đạt mỗi giây chỉ khi form tạo hồ sơ đang mở.
  usePolling(
    useCallback(() => refreshCandidates(true), [refreshCandidates]),
    { enabled: isCreating && Boolean(roomId) && capabilities.listsReadable, interval: 1000, immediate: false }
  );

  useEffect(() => {
    if (roomId) {
      void refreshProfiles();
      void refreshCandidates();
    }
  }, [roomId, refreshCandidates, refreshProfiles]);

  useEffect(() => {
    if (!capabilities.listsWritable || !capabilities.filesWritable) setIsCreating(false);
  }, [capabilities.listsWritable, capabilities.filesWritable]);

  useEffect(() => {
    if (capabilities.listsReadable) return;
    setProfiles([]);
    setPassedCandidates([]);
  }, [capabilities.listsReadable]);

  const handleCreateSubmit = async (data: Omit<EmployeeProfile, '_id' | 'status'>) => {
    if (!roomId || !capabilities.listsWritable || !capabilities.filesWritable) return;
    setStatusMsg({ text: `Đang khởi tạo hồ sơ cho "${data.name}"...`, type: 'info' });
    
    // Create via service
    const newProfile = await service.createProfile(roomId, data);
    
    // Optimistic UI update
    setProfiles(prev => [...prev, newProfile]);
    setStatusMsg({ text: `Đã thêm hồ sơ "${data.name}" thành công!`, type: 'success' });
    
    setTimeout(() => setStatusMsg(null), 3000);

    // Sync from server silently to get real ID and fields
    await refreshProfiles(true);
  };

  const handleMoveProfile = async (profileId: string, newStatus: string) => {
    if (!roomId || !capabilities.listsWritable || !service.capabilities.stageMovement) return;
    
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
    } catch {
      // Revert optimistic update on failure
      setProfiles(prev => prev.map(p => p._id === profileId ? { ...p, status: oldStatus } : p));
      setStatusMsg({ 
        text: 'Không thể đồng bộ trạng thái. Đã khôi phục vị trí cũ.',
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
            className="hr-btn hr-btn-accent" 
            disabled={!capabilities.listsWritable || !capabilities.filesWritable}
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

      {!capabilities.listsReadable && (
        <div className="hr-status-banner hr-status-error">Lifecycle List views are unavailable until List read permission is granted.</div>
      )}
      {capabilities.listsReadable && !capabilities.listsQueryable && (
        <div className="hr-status-banner hr-status-info">{FEATURE_DEGRADED_BEHAVIOR.listsQueryable}</div>
      )}
      {!capabilities.listsWritable && (
        <div className="hr-status-banner hr-status-error">{FEATURE_DEGRADED_BEHAVIOR.listsWritable}</div>
      )}
      {!capabilities.filesWritable && (
        <div className="hr-status-banner hr-status-error">{FEATURE_DEGRADED_BEHAVIOR.filesWritable}</div>
      )}

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

      {(!capabilities.listsWritable || !service.capabilities.stageMovement) && (
        <div className="hr-status-banner hr-status-error">Di chuyển stage lifecycle đang tắt vì capability chưa được xác minh.</div>
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

          <select
            aria-label="Lọc theo trạng thái nhân sự"
            className="hr-input"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="all">Tất cả trạng thái ({statusCounts.all})</option>
            <option value="Mới nhận việc">Chờ hồ sơ ({statusCounts.wait})</option>
            <option value="Đang thử việc">Thử việc ({statusCounts.probation})</option>
            <option value="Chính thức">Chính thức ({statusCounts.official})</option>
            <option value="Nghỉ việc">Nghỉ việc ({statusCounts.resigned})</option>
          </select>

          {departments.length > 2 && (
            <select
              aria-label="Lọc theo phòng ban"
              className="hr-input"
              value={selectedDept}
              onChange={(event) => setSelectedDept(event.target.value)}
              style={{ width: 'auto', minWidth: '180px' }}
            >
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department === 'Tất cả' ? 'Tất cả phòng ban' : department}
                </option>
              ))}
            </select>
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
          onMoveProfile={capabilities.listsWritable && service.capabilities.stageMovement ? handleMoveProfile : undefined}
        />
      ) : (
        <ProfileListView 
          profiles={filteredProfiles}
          isLoading={isLoading}
          onMoveProfile={capabilities.listsWritable && service.capabilities.stageMovement ? handleMoveProfile : undefined}
        />
      )}
    </div>
  );
}

export interface LifecycleDashboardProps {
  capabilities: FeatureCapabilities;
  emailTemplateProvider?: IEmployeeEmailTemplateProvider;
}

export default function LifecycleDashboard({ capabilities, emailTemplateProvider }: LifecycleDashboardProps) {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const service = useMemo(() => {
    if (!app) return null;
    return new PrivOSLifecycleService(createRoomClients(app).lists);
  }, [app]);
  const resolvedEmailTemplateProvider = useMemo(
    () => emailTemplateProvider ?? new BuiltinEmployeeEmailTemplateProvider(),
    [emailTemplateProvider]
  );
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
      <EmployeeEmailTemplateProvider provider={resolvedEmailTemplateProvider}>
        <LifecycleContent capabilities={capabilities} />
      </EmployeeEmailTemplateProvider>
    </LifecycleServiceProvider>
  );
}
