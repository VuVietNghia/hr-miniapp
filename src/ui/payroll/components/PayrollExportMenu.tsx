import type {
  PayrollExportDestination,
  PayrollExportFormat,
  PayrollExportScope,
} from '../services/PayrollExportService';

interface PayrollExportMenuProps {
  filteredCount: number;
  totalCount: number;
  exportingAction: string | null;
  disabled: boolean;
  onExport: (
    scope: PayrollExportScope,
    format: PayrollExportFormat,
    destination: PayrollExportDestination,
  ) => void;
}

const EXPORT_GROUPS: ReadonlyArray<{
  label: string;
  scope: PayrollExportScope;
  actions: ReadonlyArray<{ format: PayrollExportFormat; destination: PayrollExportDestination }>;
}> = [
  {
    label: 'Theo bộ lọc',
    scope: 'filtered',
    actions: [
      { format: 'csv', destination: 'download' },
      { format: 'csv', destination: 'privos' },
      { format: 'xlsx', destination: 'download' },
      { format: 'xlsx', destination: 'privos' },
    ],
  },
  {
    label: 'Toàn bộ dữ liệu',
    scope: 'all',
    actions: [
      { format: 'csv', destination: 'download' },
      { format: 'csv', destination: 'privos' },
      { format: 'xlsx', destination: 'download' },
      { format: 'xlsx', destination: 'privos' },
    ],
  },
];

export function PayrollExportMenu(props: PayrollExportMenuProps) {
  return (
    <div className="header-actions payroll-header-actions">
      {EXPORT_GROUPS.map((group) => {
        const sourceCount = group.scope === 'filtered' ? props.filteredCount : props.totalCount;
        return (
          <details key={group.scope} className="payroll-export-menu">
            <summary className="payroll-export-menu-trigger">
              <span className="payroll-export-menu-icon" aria-hidden="true">↓</span>
              <span>
                <span className="payroll-export-menu-title">{group.label}</span>
                <span className="payroll-export-menu-count">{sourceCount} nhân sự</span>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="payroll-export-menu-panel">
              <p className="payroll-export-menu-description">
                {group.scope === 'filtered'
                  ? 'Dùng kết quả tìm kiếm và bộ lọc hiện tại.'
                  : 'Bỏ qua toàn bộ bộ lọc đang áp dụng.'}
              </p>
              <div className="payroll-export-actions">
                {group.actions.map((action) => {
                  const actionKey = `${group.scope}-${action.format}-${action.destination}`;
                  const isExporting = props.exportingAction === actionKey;
                  return (
                    <button
                      key={actionKey}
                      type="button"
                      className={`payroll-export-action payroll-export-action-${action.destination}`}
                      disabled={props.disabled || sourceCount === 0 || isExporting}
                      onClick={() => props.onExport(group.scope, action.format, action.destination)}
                    >
                      <span className="payroll-export-action-format">{action.format === 'csv' ? 'CSV' : 'Excel'}</span>
                      <span>{isExporting ? 'Đang xuất...' : action.destination === 'download' ? 'Tải máy' : 'Lưu PrivOS'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
