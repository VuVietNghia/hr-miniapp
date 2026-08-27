import assert from 'node:assert/strict';
import test from 'node:test';

import { isPayrollOwnerFromContextResult } from '../src/ui/payroll/access/payroll-access-context';
import { refreshPayrollAccess } from '../src/ui/payroll/access/usePayrollAccessPolling';

test('allows Payroll only when the context result contains the exact owner role', () => {
  assert.equal(isPayrollOwnerFromContextResult({
    content: [{ text: '{"userRoles":["member","owner"]}' }],
  }), true);
});

test('denies Payroll when the context result does not contain owner', () => {
  assert.equal(isPayrollOwnerFromContextResult({
    content: [{ text: '{"userRoles":["member"]}' }],
  }), false);
});

test('denies Payroll when the context result is malformed', () => {
  assert.equal(isPayrollOwnerFromContextResult({
    content: [{ text: 'not-json' }],
  }), false);
});

test('denies Payroll when the role refresh request fails', async () => {
  const isOwner = await refreshPayrollAccess({
    callServerTool: async () => {
      throw new Error('context request failed');
    },
  });

  assert.equal(isOwner, false);
});
