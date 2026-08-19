import { ContractError } from './errors';
import {
  ActivateContractDto,
  AttachSignedDocumentDto,
  ContractType,
  CreateContractDto,
  RenewContractDto,
  TerminateContractDto,
  UpdateDraftContractDto,
} from './types';

type UnknownRecord = Record<string, unknown>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTRACT_TYPES: readonly ContractType[] = ['FIXED_TERM', 'INDEFINITE'];
const MAX_SIGNED_FILE_SIZE = 10 * 1024 * 1024;

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError('INVALID_INPUT', 'Dữ liệu yêu cầu không hợp lệ.');
  }
  return value as UnknownRecord;
}

function requiredString(input: UnknownRecord, key: string, maxLength = 500): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} là bắt buộc.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} vượt quá ${maxLength} ký tự.`);
  }
  return normalized;
}

function optionalString(input: UnknownRecord, key: string, maxLength = 500): string | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} phải là chuỗi.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} vượt quá ${maxLength} ký tự.`);
  }
  return normalized || undefined;
}

function requiredDate(input: UnknownRecord, key: string): string {
  const value = requiredString(input, key, 10);
  if (!isCalendarDate(value)) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} phải có định dạng YYYY-MM-DD.`);
  }
  return value;
}

function optionalDate(input: UnknownRecord, key: string): string | undefined {
  const value = optionalString(input, key, 10);
  if (!value) return undefined;
  if (!isCalendarDate(value)) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} phải có định dạng YYYY-MM-DD.`);
  }
  return value;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function positiveNumber(input: UnknownRecord, key: string): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} phải là số dương.`);
  }
  return Math.round(value);
}

function positiveInteger(input: UnknownRecord, key: string): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ContractError('VALIDATION_ERROR', `Trường ${key} phải là số nguyên dương.`);
  }
  return value;
}

function contractType(input: UnknownRecord): ContractType {
  const value = input.contractType;
  if (typeof value !== 'string' || !CONTRACT_TYPES.includes(value as ContractType)) {
    throw new ContractError('VALIDATION_ERROR', 'Loại hợp đồng không hợp lệ.');
  }
  return value as ContractType;
}

function validateDateRange(type: ContractType, startDate: string, endDate?: string): void {
  if (type === 'FIXED_TERM' && !endDate) {
    throw new ContractError('VALIDATION_ERROR', 'Hợp đồng xác định thời hạn bắt buộc có ngày kết thúc.');
  }
  if (type === 'INDEFINITE' && endDate) {
    throw new ContractError('VALIDATION_ERROR', 'Hợp đồng không xác định thời hạn không được có ngày kết thúc.');
  }
  if (endDate && endDate <= startDate) {
    throw new ContractError('VALIDATION_ERROR', 'Ngày kết thúc phải sau ngày bắt đầu.');
  }
}

function parseContractFields(input: UnknownRecord) {
  const type = contractType(input);
  const startDate = requiredDate(input, 'startDate');
  const endDate = optionalDate(input, 'endDate');
  validateDateRange(type, startDate, endDate);
  return {
    roomId: requiredString(input, 'roomId', 100),
    contractNumber: requiredString(input, 'contractNumber', 100),
    contractType: type,
    startDate,
    endDate,
    position: requiredString(input, 'position', 200),
    department: requiredString(input, 'department', 200),
    workLocation: requiredString(input, 'workLocation', 300),
    baseSalary: positiveNumber(input, 'baseSalary'),
  };
}

export function parseCreateContractDto(value: unknown): CreateContractDto {
  const input = asRecord(value);
  return {
    ...parseContractFields(input),
    employeeId: requiredString(input, 'employeeId', 100),
    previousContractId: optionalString(input, 'previousContractId', 100),
  };
}

export function parseUpdateDraftContractDto(value: unknown): UpdateDraftContractDto {
  const input = asRecord(value);
  return {
    ...parseContractFields(input),
    contractId: requiredString(input, 'contractId', 100),
    expectedRevision: positiveInteger(input, 'expectedRevision'),
  };
}

export function parseAttachSignedDocumentDto(value: unknown): AttachSignedDocumentDto {
  const input = asRecord(value);
  const mimeType = requiredString(input, 'mimeType', 100).toLowerCase();
  const fileName = requiredString(input, 'fileName', 255);
  const fileSize = positiveInteger(input, 'fileSize');
  if (mimeType !== 'application/pdf' || !fileName.toLowerCase().endsWith('.pdf')) {
    throw new ContractError('INVALID_DOCUMENT', 'Bản hợp đồng đã ký phải là file PDF.');
  }
  if (fileSize > MAX_SIGNED_FILE_SIZE) {
    throw new ContractError('INVALID_DOCUMENT', 'File PDF đã ký không được vượt quá 10 MB.');
  }
  return {
    roomId: requiredString(input, 'roomId', 100),
    contractId: requiredString(input, 'contractId', 100),
    fileId: requiredString(input, 'fileId', 200),
    fileName,
    mimeType,
    fileSize,
    signedDate: requiredDate(input, 'signedDate'),
  };
}

export function parseActivateContractDto(value: unknown): ActivateContractDto {
  const input = asRecord(value);
  return {
    roomId: requiredString(input, 'roomId', 100),
    contractId: requiredString(input, 'contractId', 100),
    effectiveDate: requiredDate(input, 'effectiveDate'),
  };
}

export function parseRenewContractDto(value: unknown): RenewContractDto {
  const input = asRecord(value);
  return {
    ...parseContractFields(input),
    sourceContractId: requiredString(input, 'sourceContractId', 100),
  };
}

export function parseTerminateContractDto(value: unknown): TerminateContractDto {
  const input = asRecord(value);
  return {
    roomId: requiredString(input, 'roomId', 100),
    contractId: requiredString(input, 'contractId', 100),
    terminationDate: requiredDate(input, 'terminationDate'),
    reason: requiredString(input, 'reason', 1000),
  };
}

export function parseRoomAndEmployee(value: unknown): { roomId: string; employeeId: string } {
  const input = asRecord(value);
  return {
    roomId: requiredString(input, 'roomId', 100),
    employeeId: requiredString(input, 'employeeId', 100),
  };
}

export function parseSummaryRequest(value: unknown): { roomId: string; employeeIds: string[] } {
  const input = asRecord(value);
  const employeeIds = input.employeeIds;
  if (!Array.isArray(employeeIds) || employeeIds.length > 500 || employeeIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new ContractError('VALIDATION_ERROR', 'employeeIds phải là danh sách tối đa 500 ID hợp lệ.');
  }
  return {
    roomId: requiredString(input, 'roomId', 100),
    employeeIds: [...new Set(employeeIds.map(id => String(id).trim()))],
  };
}

export function parseContractIdRequest(value: unknown): { roomId: string; contractId: string } {
  const input = asRecord(value);
  return {
    roomId: requiredString(input, 'roomId', 100),
    contractId: requiredString(input, 'contractId', 100),
  };
}
