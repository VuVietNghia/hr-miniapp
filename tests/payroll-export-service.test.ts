import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import type { McpApp } from '@privos/app-react';
import { PayrollExportService } from '../src/ui/payroll/services/PayrollExportService';

const employees = [
  {
    _id: 'employee-it',
    name: 'Nguyễn Minh An',
    status: 'Chính thức',
    position: 'Developer',
    department: 'IT',
  },
  {
    _id: 'employee-hr',
    name: 'Trần Hồng Bình',
    status: 'Chính thức',
    position: 'HR Specialist',
    department: 'Back-office',
  },
];

const payrollByEmployeeId = new Map([
  ['employee-it', {
    employeeId: 'employee-it',
    baseSalary: 20_000_000,
    taxId: '0123456789',
    bankAccount: '123456789012',
    bankName: 'Vietcombank',
    contractType: 'Chính thức',
  }],
  ['employee-hr', {
    employeeId: 'employee-hr',
    baseSalary: 15_000_000,
    taxId: '9876543210',
    bankAccount: '987654321098',
    bankName: 'MB Bank',
    contractType: 'Thử việc (85%)',
  }],
]);

function createAppMock() {
  const uploads: Array<Record<string, unknown>> = [];
  const app = {
    async callServerTool(params: { name: string }) {
      if (params.name === 'privos.folders.getByChannel') {
        return { content: [{ text: '[]' }] };
      }
      if (params.name === 'privos.folders.create') {
        return { content: [{ text: JSON.stringify({ _id: 'payroll-export-folder' }) }] };
      }
      throw new Error(`Unexpected tool: ${params.name}`);
    },
    async uploadFile(params: Record<string, unknown>) {
      uploads.push(params);
      return { _id: 'uploaded-file' };
    },
  } as unknown as McpApp;

  return { app, uploads };
}

function createRequest(format: 'csv' | 'xlsx', source = employees) {
  return {
    employees: source,
    payrollByEmployeeId,
    scope: source.length === employees.length ? 'all' as const : 'filtered' as const,
    format,
    destination: 'privos' as const,
    filterContext: { department: 'IT', status: 'Da_Co_Luong' },
    createdAt: new Date(2026, 7, 21, 9, 5, 7),
  };
}

test('exports filtered CSV with only supplied employees and upload metadata', async () => {
  const { app, uploads } = createAppMock();
  const service = new PayrollExportService(app, 'room-1');

  const result = await service.export(createRequest('csv', [employees[0]]));

  assert.match(result.fileName, /^Bang_Luong_Loc_IT_Da_Co_Luong_20260821_090507\.csv$/u);
  assert.equal(result.roomPath, `hr-miniapp/payroll/exports/${result.fileName}`);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.mimeType, 'text/csv;charset=utf-8');
  assert.equal(uploads[0]?.duplicateAction, 'keep_both');
  assert.equal(uploads[0]?.folderId, 'payroll-export-folder');

  const csv = Buffer.from(String(uploads[0]?.base64Data), 'base64').toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Nguyễn Minh An/u);
  assert.doesNotMatch(csv, /Trần Hồng Bình/u);
});

test('exports all employees to a valid XLSX workbook with numeric salary cells', async () => {
  const { app, uploads } = createAppMock();
  const service = new PayrollExportService(app, 'room-1');

  const result = await service.export(createRequest('xlsx'));

  assert.match(result.fileName, /^Bang_Luong_Toan_Bo_20260821_090507\.xlsx$/u);
  assert.equal(uploads[0]?.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const workbook = XLSX.read(Buffer.from(String(uploads[0]?.base64Data), 'base64'), { type: 'buffer' });
  const sheet = workbook.Sheets['Bảng lương'];
  assert.equal(sheet?.A2?.v, 'Nguyễn Minh An');
  assert.equal(sheet?.A3?.v, 'Trần Hồng Bình');
  assert.equal(sheet?.E2?.v, 20_000_000);
  assert.equal(sheet?.E2?.t, 'n');
});

test('rejects an export with no source employees before uploading', async () => {
  const { app, uploads } = createAppMock();
  const service = new PayrollExportService(app, 'room-1');

  await assert.rejects(() => service.export(createRequest('csv', [])), /Không có dữ liệu bảng lương/u);
  assert.equal(uploads.length, 0);
});
