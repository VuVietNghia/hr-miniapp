import { APP_TOOL_NAMES } from '../mcp/tool-names';
import {
  parsePayrollRecordId,
  parsePayrollRecordInput,
  type PayrollRecordInput,
} from './payroll-types';

export function buildPayrollQueryToolPayload() {
  return {
    name: APP_TOOL_NAMES.payrollQuery,
    arguments: {},
  } as const;
}

export function buildPayrollCreateToolPayload(value: unknown) {
  const record = parsePayrollRecordInput(value);
  return {
    name: APP_TOOL_NAMES.payrollCreate,
    arguments: { record },
  } as const;
}

export function buildPayrollUpdateToolPayload(id: unknown, value: unknown) {
  const record: PayrollRecordInput = parsePayrollRecordInput(value);
  return {
    name: APP_TOOL_NAMES.payrollUpdate,
    arguments: { id: parsePayrollRecordId(id), record },
  } as const;
}

export function buildPayrollDeleteToolPayload(id: unknown) {
  return {
    name: APP_TOOL_NAMES.payrollDelete,
    arguments: { id: parsePayrollRecordId(id) },
  } as const;
}
