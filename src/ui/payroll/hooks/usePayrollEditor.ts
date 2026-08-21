import { useCallback, useState } from 'react';
import type { EmployeeProfile } from '../../lifecycle/types';
import { validatePayrollDraft } from '../payroll-dashboard-policy';
import { PayrollConflictError, type IPayrollService, type PayrollRecord } from '../types';
import type { PayrollStatusMessage } from './usePayrollStatus';

interface UsePayrollEditorOptions {
  payrollService: IPayrollService;
  payrollByEmployeeId: Map<string, PayrollRecord>;
  reload: () => Promise<void>;
  showStatus: (message: PayrollStatusMessage, durationMs?: number) => void;
}

export function usePayrollEditor(options: UsePayrollEditorOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PayrollRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  const beginEdit = useCallback((employee: EmployeeProfile) => {
    setEditingId(employee._id);
    setDraft(options.payrollByEmployeeId.get(employee._id) ?? {
      employeeId: employee._id,
      baseSalary: 0,
      taxId: '',
      bankAccount: '',
      bankName: 'Vietcombank',
      contractType: 'Chính thức',
      applyProbationRate: true,
      probationRate: 85,
    });
  }, [options.payrollByEmployeeId]);

  const cancelEdit = useCallback(() => {
    if (!isSaving) setEditingId(null);
  }, [isSaving]);

  const save = useCallback(async () => {
    if (isSaving) return;
    const validation = validatePayrollDraft(draft);
    if (!validation.ok) {
      options.showStatus({ text: validation.message, type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await options.payrollService.saveRecord(validation.record);
      setEditingId(null);
      options.showStatus({ text: 'Đã cập nhật thông tin lương thành công.', type: 'success' }, 3000);
      await options.reload();
    } catch (error) {
      console.error('[PayrollDashboard] PAYROLL_SAVE_FAILED');
      options.showStatus({
        text: error instanceof PayrollConflictError
          ? 'Phát hiện xung đột dữ liệu lương. Vui lòng xử lý bản ghi trùng trước khi lưu.'
          : 'Không thể lưu thông tin lương. Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, options]);

  return { editingId, draft, isSaving, setDraft, beginEdit, cancelEdit, save };
}
