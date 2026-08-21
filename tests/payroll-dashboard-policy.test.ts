import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNextPayrollPollingInterval,
  validatePayrollDraft,
} from '../src/ui/payroll/payroll-dashboard-policy';

test('backs payroll polling off when repeated snapshots are unchanged', () => {
  assert.equal(getNextPayrollPollingInterval(0), 15_000);
  assert.equal(getNextPayrollPollingInterval(3), 30_000);
  assert.equal(getNextPayrollPollingInterval(6), 60_000);
});

test('normalizes a valid payroll draft before persistence', () => {
  const result = validatePayrollDraft({
    employeeId: 'employee-1',
    baseSalary: 25_000_000,
    taxId: '0123456789-001',
    bankAccount: ' 123456789 ',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.record.bankAccount, '123456789');
    assert.equal(result.record.probationRate, 85);
  }
});

test('rejects invalid payroll identifiers without returning raw values in the error', () => {
  const result = validatePayrollDraft({
    employeeId: 'employee-1',
    baseSalary: 10_000_000,
    taxId: 'secret-tax-value',
    bankAccount: '123456',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'INVALID_TAX_ID');
    assert.doesNotMatch(result.message, /secret-tax-value/u);
  }
});
