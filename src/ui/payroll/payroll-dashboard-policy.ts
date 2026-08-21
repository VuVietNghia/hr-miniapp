import type { PayrollRecord } from './types';

const SALARY_REGEX = /^\d{1,12}$/;
const TAX_ID_REGEX = /^(?:\d{10}|\d{12}|\d{10}-?\d{3})$/;
const BANK_ACCOUNT_REGEX = /^[0-9-]{6,24}$/;

export type PayrollValidationErrorCode =
  | 'MISSING_EMPLOYEE'
  | 'INVALID_SALARY'
  | 'INVALID_TAX_ID'
  | 'INVALID_BANK_ACCOUNT';

export type PayrollDraftValidationResult =
  | { ok: true; record: PayrollRecord }
  | { ok: false; code: PayrollValidationErrorCode; message: string };

export function getNextPayrollPollingInterval(unchangedSnapshotCount: number): number {
  if (unchangedSnapshotCount >= 6) return 60_000;
  if (unchangedSnapshotCount >= 3) return 30_000;
  return 15_000;
}

export function validatePayrollDraft(draft: Partial<PayrollRecord>): PayrollDraftValidationResult {
  if (!draft.employeeId) {
    return { ok: false, code: 'MISSING_EMPLOYEE', message: 'Không xác định được nhân sự cần cập nhật.' };
  }

  const normalizedSalary = String(draft.baseSalary ?? 0).replace(/[^\d]/g, '');
  if (!SALARY_REGEX.test(normalizedSalary) || Number(normalizedSalary) < 0) {
    return { ok: false, code: 'INVALID_SALARY', message: 'Mức lương cơ bản không hợp lệ.' };
  }

  const normalizedTaxId = (draft.taxId ?? '').replace(/\s+/g, '');
  if (normalizedTaxId && !TAX_ID_REGEX.test(normalizedTaxId)) {
    return { ok: false, code: 'INVALID_TAX_ID', message: 'Mã số thuế không hợp lệ.' };
  }

  const normalizedBankAccount = (draft.bankAccount ?? '').replace(/\s+/g, '');
  if (normalizedBankAccount && !BANK_ACCOUNT_REGEX.test(normalizedBankAccount)) {
    return { ok: false, code: 'INVALID_BANK_ACCOUNT', message: 'Số tài khoản ngân hàng không hợp lệ.' };
  }

  return {
    ok: true,
    record: {
      ...draft,
      employeeId: draft.employeeId,
      baseSalary: Number(normalizedSalary),
      taxId: normalizedTaxId,
      bankAccount: normalizedBankAccount,
      applyProbationRate: draft.applyProbationRate !== false,
      probationRate: 85,
    },
  };
}
