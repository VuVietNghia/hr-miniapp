import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpApp } from '@privos/app-react';
import { PayrollService } from '../src/ui/payroll/services/PayrollService';
import { PayrollConflictError } from '../src/ui/payroll/types';

interface ToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

function toolResponse(payload: unknown) {
  return { content: [{ text: JSON.stringify(payload) }] };
}

test('registers the room and employee uniqueness index for new payroll collections', async () => {
  let registerRequest: ToolRequest | undefined;
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'privos.db.getSchema') throw new Error('collection not found');
      registerRequest = request;
      return toolResponse({ registered: true });
    },
  } as unknown as McpApp;

  await new PayrollService(app, 'room-1').initializeSchema();

  assert.equal(registerRequest?.name, 'privos.db.registerCollection');
  assert.deepEqual(registerRequest?.arguments?.indexes, [
    { fields: { roomId: 1, employeeId: 1 }, unique: true },
  ]);
});

test('uses an existing payroll schema without attempting schema registration', async () => {
  const calls: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'privos.db.getSchema') {
        return toolResponse({ collection: 'payroll_records' });
      }
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await new PayrollService(app, 'room-1').initializeSchema();

  assert.equal(calls.some((call) => call.name === 'privos.db.registerCollection'), false);
});

test('allows payroll reads when schema registration is unavailable but the collection exists', async () => {
  const calls: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'privos.db.getSchema') throw new Error('insufficient scope');
      if (request.name === 'privos.db.registerCollection') throw new Error('insufficient scope');
      if (request.name === 'hrm.payroll.query') return toolResponse({ records: [] });
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await new PayrollService(app, 'room-1').initializeSchema();

  assert.equal(calls.some((call) => call.name === 'hrm.payroll.query'), true);
});

test('fails payroll initialization when neither schema setup nor data access is available', async () => {
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'privos.db.getSchema') throw new Error('collection not found');
      if (request.name === 'privos.db.registerCollection') throw new Error('database unavailable');
      if (request.name === 'hrm.payroll.query') throw new Error('database unavailable');
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await assert.rejects(
    () => new PayrollService(app, 'room-1').initializeSchema(),
    /Không thể khởi tạo cấu trúc dữ liệu lương/,
  );
});

test('returns a failed result instead of treating a payroll read error as empty', async () => {
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'hrm.payroll.query') throw new Error('database unavailable');
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  const result = await new PayrollService(app, 'room-1').getRecords();

  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.errorCode, 'PAYROLL_READ_FAILED');
});

test('updates the existing employee payroll instead of creating a duplicate', async () => {
  const calls: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'hrm.payroll.query') {
        return toolResponse({
          records: [{
            _id: 'payroll-existing',
            employeeId: 'employee-1',
            roomId: 'room-1',
            baseSalary: 10_000_000,
            taxId: '',
            bankAccount: '',
          }],
        });
      }
      if (request.name === 'hrm.payroll.update') return toolResponse({ updated: 1 });
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await new PayrollService(app, 'room-1').saveRecord({
    employeeId: 'employee-1',
    baseSalary: 12_000_000,
    taxId: '',
    bankAccount: '',
  });

  const updateCall = calls.find((call) => call.name === 'hrm.payroll.update');
  assert.equal(updateCall?.arguments?.id, 'payroll-existing');
  assert.equal(calls.some((call) => call.name === 'hrm.payroll.create'), false);
});

test('fails closed when duplicate payroll records already exist', async () => {
  const calls: ToolRequest[] = [];
  const duplicate = {
    employeeId: 'employee-1',
    roomId: 'room-1',
    baseSalary: 10_000_000,
    taxId: '',
    bankAccount: '',
  };
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'hrm.payroll.query') {
        return toolResponse({
          records: [
            { ...duplicate, _id: 'payroll-1' },
            { ...duplicate, _id: 'payroll-2' },
          ],
        });
      }
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await assert.rejects(
    () => new PayrollService(app, 'room-1').saveRecord(duplicate),
    PayrollConflictError,
  );
  assert.equal(calls.some((call) => call.name === 'hrm.payroll.create'), false);
  assert.equal(calls.some((call) => call.name === 'hrm.payroll.update'), false);
});

test('maps a backend unique constraint violation to a payroll conflict', async () => {
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'hrm.payroll.query') return toolResponse({ records: [] });
      if (request.name === 'hrm.payroll.create') throw new Error('duplicate key violates unique index');
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await assert.rejects(
    () => new PayrollService(app, 'room-1').saveRecord({
      employeeId: 'employee-1',
      baseSalary: 10_000_000,
      taxId: '',
      bankAccount: '',
    }),
    PayrollConflictError,
  );
});
