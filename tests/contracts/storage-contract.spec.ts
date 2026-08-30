import { describe, expect, it } from 'vitest';
import {
  EMAIL_HISTORY_FIELD_IDS,
  EMAIL_HISTORY_LIST_NAME,
  EMAIL_HISTORY_STAGES,
} from '../../src/email-history/email-history-model';
import {
  PAYROLL_COLLECTION_NAME,
  type PayrollRecordInput,
} from '../../src/payroll/payroll-types';
import { calculateNetSalary } from '../../src/ui/payroll/utils';

describe('persisted HR identifiers', () => {
  it('keeps the payroll collection and shared email List identity unchanged', () => {
    expect(PAYROLL_COLLECTION_NAME).toBe('payroll_records');
    expect(EMAIL_HISTORY_LIST_NAME).toBe('Qu\u1ea3n l\u00ed Email');
    expect(Object.keys(EMAIL_HISTORY_FIELD_IDS)).toHaveLength(15);
    expect(Object.values(EMAIL_HISTORY_STAGES)).toEqual([
      'Email Ph\u1ecfng v\u1ea5n - \u0110\u00e3 g\u1eedi',
      'Email Ph\u1ecfng v\u1ea5n - G\u1eedi l\u1ed7i',
      'Email Nh\u00e2n s\u1ef1 - \u0110\u00e3 g\u1eedi',
      'Email Nh\u00e2n s\u1ef1 - G\u1eedi l\u1ed7i',
    ]);
  });

  it('keeps every payroll business field and the 85 percent probation rule', () => {
    const record: PayrollRecordInput = {
      employeeId: 'employee-1',
      baseSalary: 10_000_000,
      taxId: '0123456789',
      bankAccount: '123456789',
      bankName: 'Vietcombank',
      contractType: 'Th\u1eed vi\u1ec7c (85%)',
      applyProbationRate: true,
      probationRate: 85,
    };

    expect(Object.keys(record)).toEqual([
      'employeeId', 'baseSalary', 'taxId', 'bankAccount',
      'bankName', 'contractType', 'applyProbationRate', 'probationRate',
    ]);
    expect(calculateNetSalary(10_000_000, 'Th\u1eed vi\u1ec7c (85%)', true, 85)).toEqual({
      netSalary: 8_500_000,
      effectiveRate: 85,
      isProbationDiscounted: true,
    });
    expect(calculateNetSalary(10_000_000, 'Th\u1eed vi\u1ec7c (85%)', false, 85).netSalary)
      .toBe(10_000_000);
  });
});
