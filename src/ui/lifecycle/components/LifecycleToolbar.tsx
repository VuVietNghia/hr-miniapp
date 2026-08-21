import type { LifecycleStatusCounts, LifecycleViewMode } from '../lifecycle-dashboard-selectors';

interface LifecycleToolbarProps {
  searchTerm: string;
  selectedDepartment: string;
  selectedStatus: string;
  viewMode: LifecycleViewMode;
  departments: string[];
  statusCounts: LifecycleStatusCounts;
  visibleCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onViewModeChange: (value: LifecycleViewMode) => void;
}

export function LifecycleToolbar(props: LifecycleToolbarProps) {
  return (
    <div className="hr-toolbar">
      <div className="hr-toolbar-left" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div className="hr-search-box">
          <span className="hr-search-icon">🔍</span>
          <input
            type="text"
            className="hr-search-input"
            placeholder="Tìm theo tên, SĐT, email, vị trí..."
            value={props.searchTerm}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
        <select
          aria-label="Lọc theo trạng thái nhân sự"
          className="hr-input"
          value={props.selectedStatus}
          onChange={(event) => props.onStatusChange(event.target.value)}
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="all">Tất cả trạng thái ({props.statusCounts.all})</option>
          <option value="Mới nhận việc">Chờ hồ sơ ({props.statusCounts.wait})</option>
          <option value="Đang thử việc">Thử việc ({props.statusCounts.probation})</option>
          <option value="Chính thức">Chính thức ({props.statusCounts.official})</option>
          <option value="Nghỉ việc">Nghỉ việc ({props.statusCounts.resigned})</option>
        </select>
        {props.departments.length > 2 && (
          <select
            aria-label="Lọc theo phòng ban"
            className="hr-input"
            value={props.selectedDepartment}
            onChange={(event) => props.onDepartmentChange(event.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            {props.departments.map((department) => (
              <option key={department} value={department}>
                {department === 'Tất cả' ? 'Tất cả phòng ban' : department}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="hr-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="hr-view-toggle">
          <button
            type="button"
            className={`hr-view-btn ${props.viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => props.onViewModeChange('kanban')}
            title="Xem dạng Bảng Kanban"
          >
            📊 Kanban
          </button>
          <button
            type="button"
            className={`hr-view-btn ${props.viewMode === 'list' ? 'active' : ''}`}
            onClick={() => props.onViewModeChange('list')}
            title="Xem dạng Danh sách"
          >
            📋 Danh sách
          </button>
        </div>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #6C737A)' }}>
          Hiển thị <strong>{props.visibleCount}</strong> / {props.totalCount} nhân sự
        </span>
      </div>
    </div>
  );
}
