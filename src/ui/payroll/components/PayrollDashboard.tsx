import { useEffect, useMemo, useState } from 'react';
import type { ILifecycleService } from '../../lifecycle/types';
import {
  filterPayrollEmployees,
  getPayrollDepartments,
  getPayrollFilterCounts,
  getPayrollStats,
  type PayrollFilterStatus,
} from '../payroll-dashboard-selectors';
import type { IPayrollExportService } from '../services/PayrollExportService';
import type { IPayrollService } from '../types';
import { usePayrollData } from '../hooks/usePayrollData';
import { usePayrollEditor } from '../hooks/usePayrollEditor';
import { usePayrollExport } from '../hooks/usePayrollExport';
import { usePayrollStatus } from '../hooks/usePayrollStatus';
import { PayrollExportMenu } from './PayrollExportMenu';
import { PayrollStats } from './PayrollStats';
import { PayrollStatusBanner } from './PayrollStatusBanner';
import { PayrollTable } from './PayrollTable';
import { PayrollToolbar } from './PayrollToolbar';

interface PayrollDashboardProps {
  roomId: string;
  payrollService: IPayrollService;
  lifecycleService: ILifecycleService;
  payrollExportService: IPayrollExportService;
}

export function PayrollDashboard(props: PayrollDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<PayrollFilterStatus>('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const status = usePayrollStatus();
  const data = usePayrollData({
    roomId: props.roomId,
    payrollService: props.payrollService,
    lifecycleService: props.lifecycleService,
  });

  const departments = useMemo(
    () => getPayrollDepartments(data.employees),
    [data.employees],
  );
  const departmentEmployees = useMemo(
    () => selectedDepartment === 'all'
      ? data.employees
      : data.employees.filter((employee) => employee.department === selectedDepartment),
    [data.employees, selectedDepartment],
  );
  const filteredEmployees = useMemo(() => filterPayrollEmployees(
    data.employees,
    data.payrollByEmployeeId,
    selectedDepartment,
    filterStatus,
    searchTerm,
  ), [data.employees, data.payrollByEmployeeId, filterStatus, searchTerm, selectedDepartment]);
  const stats = useMemo(
    () => getPayrollStats(departmentEmployees, data.payrollByEmployeeId),
    [data.payrollByEmployeeId, departmentEmployees],
  );
  const filterCounts = useMemo(
    () => getPayrollFilterCounts(departmentEmployees, data.payrollByEmployeeId),
    [data.payrollByEmployeeId, departmentEmployees],
  );

  const editor = usePayrollEditor({
    payrollService: props.payrollService,
    payrollByEmployeeId: data.payrollByEmployeeId,
    reload: data.loadData,
    showStatus: status.showStatus,
  });
  const payrollExport = usePayrollExport({
    employees: data.employees,
    filteredEmployees,
    payrollByEmployeeId: data.payrollByEmployeeId,
    selectedDepartment,
    filterStatus,
    payrollExportService: props.payrollExportService,
    showStatus: status.showStatus,
  });

  useEffect(() => {
    data.setPollingPaused(Boolean(editor.editingId) || editor.isSaving || Boolean(payrollExport.exportingAction));
  }, [data.setPollingPaused, editor.editingId, editor.isSaving, payrollExport.exportingAction]);

  if (data.dataState === 'loading') {
    return (
      <div className="hr-terminal-ui" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ color: 'var(--text-muted)' }}>Đang tải bảng lương & thông tin tài chính...</p>
      </div>
    );
  }

  const retryLoad = () => {
    status.clearStatus();
    void data.loadData();
  };

  return (
    <div className="hr-terminal-ui">
      <header className="hr-header-block">
        <div className="header-content">
          <h2 className="hr-title">Quản Lý Lương & Tài Chính Nhân Sự</h2>
          <p className="hr-subtitle">
            Theo dõi mức lương cơ bản, lương thử việc, mã số thuế và tài khoản ngân hàng chi trả.
          </p>
        </div>
        <PayrollExportMenu
          filteredCount={filteredEmployees.length}
          totalCount={data.employees.length}
          exportingAction={payrollExport.exportingAction}
          disabled={editor.isSaving || data.dataState === 'stale' || data.dataState === 'error'}
          onExport={(scope, format, destination) => {
            void payrollExport.exportPayroll(scope, format, destination);
          }}
        />
      </header>

      <PayrollStatusBanner
        dataState={data.dataState}
        statusMessage={status.statusMessage}
        onRetry={retryLoad}
      />
      <PayrollStats stats={stats} selectedDepartment={selectedDepartment} />
      <PayrollToolbar
        searchTerm={searchTerm}
        filterStatus={filterStatus}
        selectedDepartment={selectedDepartment}
        departments={departments}
        filterCounts={filterCounts}
        visibleCount={filteredEmployees.length}
        onSearchChange={setSearchTerm}
        onFilterStatusChange={setFilterStatus}
        onDepartmentChange={setSelectedDepartment}
      />
      <PayrollTable
        employees={filteredEmployees}
        payrollByEmployeeId={data.payrollByEmployeeId}
        editingId={editor.editingId}
        draft={editor.draft}
        isSaving={editor.isSaving}
        setDraft={editor.setDraft}
        onBeginEdit={editor.beginEdit}
        onCancelEdit={editor.cancelEdit}
        onSave={() => { void editor.save(); }}
      />
    </div>
  );
}
