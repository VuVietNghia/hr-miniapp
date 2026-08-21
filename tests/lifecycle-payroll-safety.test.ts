import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { McpApp } from '@privos/app-react';
import { PrivOSLifecycleService } from '../src/ui/lifecycle/services/PrivOSLifecycleService';
import type { EmployeeProfile, ILifecycleService } from '../src/ui/lifecycle/types';
import { loadPayrollDashboardData } from '../src/ui/payroll/payroll-load-state';
import type { IPayrollService, PayrollRecord } from '../src/ui/payroll/types';

interface LifecycleAppOptions {
  items?: Array<Record<string, unknown>>;
  total?: number;
  listLoadError?: Error;
}

function createLifecycleApp(options: LifecycleAppOptions = {}): McpApp {
  return {
    async callServerTool(request: { name: string; arguments?: Record<string, unknown> }) {
      if (request.name === 'privos.lists.getAll') {
        if (options.listLoadError) throw options.listLoadError;
        return {
          content: [{
            text: JSON.stringify([{
              _id: 'hr-list',
              name: '[HR-MiniApp] Employee profiles',
              stages: [{ _id: 'new', name: 'New employee' }],
              fieldDefinitions: [],
            }]),
          }],
        };
      }

      if (request.name === 'privos.lists.searchItems') {
        return { content: [{ text: '[]' }] };
      }

      if (request.name === 'privos.lists.getItems') {
        const allItems = options.items ?? [];
        const offset = Number(request.arguments?.offset ?? 0);
        const count = Number(request.arguments?.count ?? 100);
        const items = allItems.slice(offset, offset + count);
        return {
          content: [{ text: JSON.stringify({ items, total: options.total ?? allItems.length }) }],
        };
      }

      if (request.name === 'debug_log') {
        return { content: [{ text: '{}' }] };
      }

      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;
}

function createEmployee(index: number): EmployeeProfile {
  return {
    _id: `employee-${index}`,
    name: `Employee ${index}`,
    status: 'Active',
  };
}

function createPayroll(index: number): PayrollRecord {
  return {
    _id: `payroll-${index}`,
    employeeId: `employee-${index}`,
    baseSalary: 10_000_000,
    taxId: '',
    bankAccount: '',
    bankName: '',
    contractType: 'Official',
    roomId: 'room-1',
  };
}

test('distinguishes a valid empty employee snapshot from a failed load', async () => {
  const emptyResult = await new PrivOSLifecycleService(createLifecycleApp()).loadProfiles('room-1');
  assert.equal(emptyResult.status, 'success');
  if (emptyResult.status === 'success') {
    assert.deepEqual(emptyResult.records, []);
    assert.equal(emptyResult.isComplete, true);
  }

  const failedResult = await new PrivOSLifecycleService(createLifecycleApp({
    listLoadError: new Error('timeout'),
  })).loadProfiles('room-1');
  assert.equal(failedResult.status, 'failed');
});

test('marks a capped 500-record snapshot as incomplete when more profiles exist', async () => {
  const items = Array.from({ length: 501 }, (_, index) => ({
    _id: `employee-${index + 1}`,
    name: `Employee ${index + 1}`,
    stageId: 'new',
  }));
  const result = await new PrivOSLifecycleService(createLifecycleApp({
    items,
    total: 501,
  })).loadProfiles('room-1');

  assert.equal(result.status, 'success');
  if (result.status === 'success') {
    assert.equal(result.records.length, 500);
    assert.equal(result.isComplete, false);
  }
});

test('keeps all 101 employees and payroll records when the employee snapshot is incomplete', async () => {
  const employees = Array.from({ length: 101 }, (_, index) => createEmployee(index + 1));
  const payrolls = Array.from({ length: 101 }, (_, index) => createPayroll(index + 1));
  let deleteCalls = 0;

  const lifecycleService = {
    async loadProfiles() {
      return { status: 'success', records: employees.slice(0, 100), isComplete: false } as const;
    },
  } as Pick<ILifecycleService, 'loadProfiles'>;
  const payrollService = {
    async getRecords() {
      return { status: 'success', records: payrolls } as const;
    },
    async deleteRecord() {
      deleteCalls += 1;
    },
  } as unknown as IPayrollService;

  const result = await loadPayrollDashboardData({
    roomId: 'room-1',
    lifecycleService,
    payrollService,
    previousEmployees: employees,
    previousPayrolls: payrolls,
  });

  assert.equal(result.profileStatus, 'partial');
  assert.equal(result.employees.length, 101);
  assert.equal(result.payrolls.length, 101);
  assert.equal(deleteCalls, 0);
});

test('preserves the last known payroll view when employee loading fails', async () => {
  const employees = [createEmployee(1)];
  const payrolls = [createPayroll(1)];
  let deleteCalls = 0;

  const lifecycleService = {
    async loadProfiles() {
      return {
        status: 'failed',
        errorCode: 'PROFILE_LOAD_FAILED',
        message: 'Employee profiles are unavailable.',
      } as const;
    },
  } as Pick<ILifecycleService, 'loadProfiles'>;
  const payrollService = {
    async getRecords() {
      return { status: 'success', records: [] } as const;
    },
    async deleteRecord() {
      deleteCalls += 1;
    },
  } as unknown as IPayrollService;

  const result = await loadPayrollDashboardData({
    roomId: 'room-1',
    lifecycleService,
    payrollService,
    previousEmployees: employees,
    previousPayrolls: payrolls,
  });

  assert.equal(result.profileStatus, 'failed');
  assert.deepEqual(result.employees, employees);
  assert.deepEqual(result.payrolls, payrolls);
  assert.equal(deleteCalls, 0);
});

test('marks payroll data stale and preserves it when the payroll read fails', async () => {
  const employees = [createEmployee(1)];
  const payrolls = [createPayroll(1)];
  const lifecycleService = {
    async loadProfiles() {
      return { status: 'success', records: employees, isComplete: true } as const;
    },
  } as Pick<ILifecycleService, 'loadProfiles'>;
  const payrollService = {
    async getRecords() {
      return {
        status: 'failed',
        errorCode: 'PAYROLL_READ_FAILED',
        message: 'Payroll is unavailable.',
      } as const;
    },
  } as Pick<IPayrollService, 'getRecords'>;

  const result = await loadPayrollDashboardData({
    roomId: 'room-1',
    lifecycleService,
    payrollService,
    previousEmployees: employees,
    previousPayrolls: payrolls,
  });

  assert.equal(result.dataState, 'stale');
  assert.deepEqual(result.payrolls, payrolls);
});

test('production payroll dashboard contains no raw debug tool flow', async () => {
  const sourceUrl = new URL('../src/ui/payroll/components/PayrollDashboard.tsx', import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');

  assert.doesNotMatch(source, /test_auth/u);
  assert.doesNotMatch(source, /showRawPayrollDebug/u);
  assert.doesNotMatch(source, /formatPayrollDebugOutput/u);
  assert.doesNotMatch(source, /hr-debug-pre/u);
});
