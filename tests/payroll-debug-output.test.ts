import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPayrollDebugOutput } from '../src/ui/payroll/debug-format';

test('payroll debug output preserves the request context and raw tool response', () => {
  const output = formatPayrollDebugOutput({
    roomId: 'room-linux',
    request: {
      name: 'hrm.payroll.query',
      arguments: {
        collection: 'payroll_records',
        where: [{ field: 'roomId', op: '==', value: 'room-linux' }]
      }
    },
    result: { content: [{ type: 'text', text: '{"records":[]}' }] }
  });

  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.status, 'success');
  assert.equal(diagnostic.roomId, 'room-linux');
  assert.equal(diagnostic.request.name, 'hrm.payroll.query');
  assert.deepEqual(diagnostic.result, { content: [{ type: 'text', text: '{"records":[]}' }] });
});

test('payroll debug output keeps the actual error details instead of a generic message', () => {
  const error = new Error('Forbidden: missing db:read scope');
  error.name = 'PayrollQueryError';

  const output = formatPayrollDebugOutput({
    roomId: 'room-linux',
    request: { name: 'hrm.payroll.query', arguments: { collection: 'payroll_records' } },
    error
  });

  const diagnostic = JSON.parse(output);
  assert.equal(diagnostic.status, 'error');
  assert.equal(diagnostic.error.name, 'PayrollQueryError');
  assert.equal(diagnostic.error.message, 'Forbidden: missing db:read scope');
  assert.match(diagnostic.error.stack, /Forbidden: missing db:read scope/);
});
