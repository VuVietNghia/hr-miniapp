import { useMemo, useState } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { LifecycleServiceProvider, useLifecycleService } from './di/LifecycleContext';
import { EmployeeEmailTemplateProvider } from './di/EmployeeEmailTemplateContext';
import {
  BuiltinEmployeeEmailTemplateProvider,
  type IEmployeeEmailTemplateProvider,
} from './email/EmployeeEmailTemplateProvider';
import { PrivOSLifecycleService } from './services/PrivOSLifecycleService';
import { KanbanBoard } from './components/KanbanBoard';
import { ProfileListView } from './components/ProfileListView';
import { CreateDetailedProfileForm } from './components/CreateDetailedProfileForm';
import { LifecycleStatusBanners } from './components/LifecycleStatusBanners';
import { LifecycleToolbar } from './components/LifecycleToolbar';
import { useLifecycleDashboard } from './hooks/useLifecycleDashboard';
import {
  filterLifecycleProfiles,
  getAvailableCandidates,
  getLifecycleDepartments,
  getLifecycleStatusCounts,
  type LifecycleViewMode,
} from './lifecycle-dashboard-selectors';
import '../hr-premium-styles.css';

function LifecycleContent() {
  const { roomId } = usePrivosContext();
  const service = useLifecycleService();
  const dashboard = useLifecycleDashboard({ roomId: roomId!, service });
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<LifecycleViewMode>('kanban');

  const departments = useMemo(
    () => getLifecycleDepartments(dashboard.profiles),
    [dashboard.profiles],
  );
  const statusCounts = useMemo(
    () => getLifecycleStatusCounts(dashboard.profiles),
    [dashboard.profiles],
  );
  const filteredProfiles = useMemo(() => filterLifecycleProfiles(dashboard.profiles, {
    department: selectedDepartment,
    status: selectedStatus,
    searchTerm,
    viewMode,
  }), [dashboard.profiles, searchTerm, selectedDepartment, selectedStatus, viewMode]);
  const availableCandidates = useMemo(
    () => getAvailableCandidates(dashboard.passedCandidates, dashboard.profiles),
    [dashboard.passedCandidates, dashboard.profiles],
  );

  const toggleCreateForm = () => {
    const nextValue = !isCreating;
    setIsCreating(nextValue);
    if (nextValue) void dashboard.refreshCandidates();
  };

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
            disabled={dashboard.dataState !== 'ready'}
            onClick={toggleCreateForm}
          >
            {isCreating ? 'Đóng form' : '+ Tạo Hồ Sơ Mới'}
          </button>
        </div>
      </header>

      {isCreating && (
        <CreateDetailedProfileForm
          onSubmit={dashboard.createProfile}
          onCancel={() => setIsCreating(false)}
          passedCandidates={availableCandidates}
          isLoadingCandidates={dashboard.isLoadingCandidates}
        />
      )}

      <LifecycleStatusBanners
        dataState={dashboard.dataState}
        statusMessage={dashboard.statusMessage}
      />
      <LifecycleToolbar
        searchTerm={searchTerm}
        selectedDepartment={selectedDepartment}
        selectedStatus={selectedStatus}
        viewMode={viewMode}
        departments={departments}
        statusCounts={statusCounts}
        visibleCount={filteredProfiles.length}
        totalCount={dashboard.profiles.length}
        onSearchChange={setSearchTerm}
        onDepartmentChange={setSelectedDepartment}
        onStatusChange={setSelectedStatus}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'kanban' ? (
        <KanbanBoard
          profiles={filteredProfiles}
          isLoading={dashboard.isLoadingProfiles}
          selectedColumnStatus={selectedStatus}
          onMoveProfile={dashboard.moveProfile}
        />
      ) : (
        <ProfileListView
          profiles={filteredProfiles}
          isLoading={dashboard.isLoadingProfiles}
          onMoveProfile={dashboard.moveProfile}
        />
      )}
    </div>
  );
}

export interface LifecycleDashboardProps {
  emailTemplateProvider?: IEmployeeEmailTemplateProvider;
}

export default function LifecycleDashboard({ emailTemplateProvider }: LifecycleDashboardProps = {}) {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const service = useMemo(() => (app ? new PrivOSLifecycleService(app) : null), [app]);
  const resolvedEmailTemplateProvider = useMemo(
    () => emailTemplateProvider ?? new BuiltinEmployeeEmailTemplateProvider(),
    [emailTemplateProvider],
  );

  if (!app || !roomId || !service) {
    return (
      <div className="lifecycle-connecting">
        <div className="spinner" />
        <p>Đang kết nối đến hệ thống PrivOS...</p>
      </div>
    );
  }

  return (
    <LifecycleServiceProvider service={service}>
      <EmployeeEmailTemplateProvider provider={resolvedEmailTemplateProvider}>
        <LifecycleContent />
      </EmployeeEmailTemplateProvider>
    </LifecycleServiceProvider>
  );
}
