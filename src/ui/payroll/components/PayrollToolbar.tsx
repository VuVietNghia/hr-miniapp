import type { PayrollFilterCounts, PayrollFilterStatus } from '../payroll-dashboard-selectors';

interface PayrollToolbarProps {
  searchTerm: string;
  filterStatus: PayrollFilterStatus;
  selectedDepartment: string;
  departments: string[];
  filterCounts: PayrollFilterCounts;
  visibleCount: number;
  onSearchChange: (value: string) => void;
  onFilterStatusChange: (value: PayrollFilterStatus) => void;
  onDepartmentChange: (value: string) => void;
}

export function PayrollToolbar(props: PayrollToolbarProps) {
  return (
    <div className="hr-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div className="hr-search-box" style={{ flex: '1 1 280px' }}>
          <span className="hr-search-icon">🔍</span>
          <input
            type="text"
            className="hr-search-input"
            placeholder="Tìm theo tên, vị trí, phòng ban, STK, MST..."
            value={props.searchTerm}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </div>
        <select
          aria-label="Lọc theo tình trạng lương"
          className="hr-input"
          value={props.filterStatus}
          onChange={(event) => props.onFilterStatusChange(event.target.value as PayrollFilterStatus)}
          style={{ width: 'auto', minWidth: '185px' }}
        >
          <option value="all">Tất cả tình trạng ({props.filterCounts.all})</option>
          <option value="configured">Đã có lương ({props.filterCounts.configured})</option>
          <option value="unconfigured">Chưa thiết lập ({props.filterCounts.unconfigured})</option>
          <option value="missing_info">Thiếu STK/MST ({props.filterCounts.missingInfo})</option>
        </select>
        {props.departments.length > 0 && (
          <select
            aria-label="Lọc theo phòng ban"
            className="hr-input"
            value={props.selectedDepartment}
            onChange={(event) => props.onDepartmentChange(event.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="all">Tất cả phòng ban</option>
            {props.departments.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        )}
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #6C737A)' }}>
          Hiển thị <strong>{props.visibleCount}</strong> / {props.filterCounts.all} hồ sơ
        </span>
      </div>
    </div>
  );
}
