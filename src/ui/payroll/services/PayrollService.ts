import type { McpApp } from '@privos_ai/app-react';

import {
  buildPayrollCreateToolPayload,
  buildPayrollDeleteToolPayload,
  buildPayrollQueryToolPayload,
  buildPayrollUpdateToolPayload,
} from '../../../payroll/payroll-tool-payloads';
import {
  parsePayrollRecordInput,
  parseStoredPayrollRecord,
  type PayrollRecordInput,
} from '../../../payroll/payroll-types';
import type { IPayrollService, PayrollRecord } from '../types';

type PayrollApp = Pick<McpApp, 'callServerTool'>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeToolText(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.content)) return value;
  const first = value.content[0];
  if (!isRecord(first) || typeof first.text !== 'string') return value;
  try {
    return JSON.parse(first.text) as unknown;
  } catch {
    throw new Error('Payroll query returned malformed JSON');
  }
}

function readPayrollRecords(value: unknown, roomId: string): PayrollRecord[] {
  const decoded = decodeToolText(value);
  const records = Array.isArray(decoded)
    ? decoded
    : isRecord(decoded) && Array.isArray(decoded.records)
      ? decoded.records
      : undefined;
  if (records === undefined) throw new Error('Payroll query returned malformed records');
  return records.map((record) => parseStoredPayrollRecord(record, roomId));
}

function businessRecord(record: PayrollRecord): PayrollRecordInput {
  return parsePayrollRecordInput({
    employeeId: record.employeeId,
    baseSalary: record.baseSalary,
    taxId: record.taxId,
    bankAccount: record.bankAccount,
    ...(record.bankName === undefined ? {} : { bankName: record.bankName }),
    ...(record.contractType === undefined ? {} : { contractType: record.contractType }),
    ...(record.applyProbationRate === undefined
      ? {}
      : { applyProbationRate: record.applyProbationRate }),
    ...(record.probationRate === undefined ? {} : { probationRate: record.probationRate }),
  });
}

export class PayrollService implements IPayrollService {
  constructor(
    private readonly app: PayrollApp,
    private readonly roomId: string,
  ) {
    if (!app) throw new Error('PayrollService requires a valid McpApp instance.');
    if (!roomId.trim()) throw new Error('PayrollService requires a roomId.');
  }

  async initializeSchema(): Promise<void> {
    // The backend repository owns schema verification and registration.
  }

  async getRecords(): Promise<PayrollRecord[]> {
    const result: unknown = await this.app.callServerTool(buildPayrollQueryToolPayload());
    return readPayrollRecords(result, this.roomId);
  }

  async saveRecord(record: PayrollRecord): Promise<void> {
    const input = businessRecord(record);
    const payload = record._id
      ? buildPayrollUpdateToolPayload(record._id, input)
      : buildPayrollCreateToolPayload(input);
    await this.app.callServerTool(payload);
  }

  async deleteRecord(id: string): Promise<void> {
    await this.app.callServerTool(buildPayrollDeleteToolPayload(id));
  }
}
