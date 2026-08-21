import { useCallback, useState } from 'react';
import type { EmployeeProfile } from '../../lifecycle/types';
import { PAYROLL_FILTER_LABELS, type PayrollFilterStatus } from '../payroll-dashboard-selectors';
import type {
  IPayrollExportService,
  PayrollExportDestination,
  PayrollExportFormat,
  PayrollExportScope,
} from '../services/PayrollExportService';
import type { PayrollRecord } from '../types';
import type { PayrollStatusMessage } from './usePayrollStatus';

interface UsePayrollExportOptions {
  employees: EmployeeProfile[];
  filteredEmployees: EmployeeProfile[];
  payrollByEmployeeId: Map<string, PayrollRecord>;
  selectedDepartment: string;
  filterStatus: PayrollFilterStatus;
  payrollExportService: IPayrollExportService;
  showStatus: (message: PayrollStatusMessage, durationMs?: number) => void;
}

export function usePayrollExport(options: UsePayrollExportOptions) {
  const [exportingAction, setExportingAction] = useState<string | null>(null);

  const exportPayroll = useCallback(async (
    scope: PayrollExportScope,
    format: PayrollExportFormat,
    destination: PayrollExportDestination,
  ) => {
    const sourceEmployees = scope === 'filtered' ? options.filteredEmployees : options.employees;
    if (sourceEmployees.length === 0) {
      options.showStatus({ text: 'Không có dữ liệu bảng lương để xuất.', type: 'error' }, 3000);
      return;
    }

    const actionKey = `${scope}-${format}-${destination}`;
    setExportingAction(actionKey);
    try {
      await options.payrollExportService.export({
        employees: sourceEmployees,
        payrollByEmployeeId: options.payrollByEmployeeId,
        scope,
        format,
        destination,
        filterContext: {
          department: options.selectedDepartment === 'all'
            ? 'Tat_Ca_Phong_Ban'
            : options.selectedDepartment,
          status: PAYROLL_FILTER_LABELS[options.filterStatus],
        },
      });
      options.showStatus({ text: 'Đã xuất báo cáo bảng lương thành công.', type: 'success' });
    } catch {
      console.error('[PayrollDashboard] PAYROLL_EXPORT_FAILED');
      options.showStatus({ text: 'Không thể xuất báo cáo bảng lương. Vui lòng thử lại.', type: 'error' });
    } finally {
      setExportingAction(null);
    }
  }, [options]);

  return { exportingAction, exportPayroll };
}
