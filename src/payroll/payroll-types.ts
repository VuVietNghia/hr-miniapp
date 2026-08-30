export const PAYROLL_COLLECTION_NAME = 'payroll_records' as const;

export interface PayrollRecordInput {
  employeeId: string;
  baseSalary: number;
  taxId: string;
  bankAccount: string;
  bankName?: string;
  contractType?: string;
  applyProbationRate?: boolean;
  probationRate?: number;
}

export interface StoredPayrollRecord extends PayrollRecordInput {
  _id: string;
  roomId: string;
  _createdAt?: string;
  _updatedAt?: string;
}

const PAYROLL_RECORD_KEYS = Object.freeze([
  'employeeId',
  'baseSalary',
  'taxId',
  'bankAccount',
  'bankName',
  'contractType',
  'applyProbationRate',
  'probationRate',
] as const);

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_BASE_SALARY = 999_999_999_999;
const TAX_ID_PATTERN = /^(?:|\d{10}|\d{12}|\d{10}-?\d{3})$/;
const BANK_ACCOUNT_PATTERN = /^(?:|[0-9-]{6,24})$/;

type Properties = ReadonlyMap<string, unknown>;

function invalidRecord(): never {
  throw new TypeError('Invalid payroll record');
}

function invalidRecordId(): never {
  throw new TypeError('Invalid payroll record id');
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function readProperties(
  value: unknown,
  allowedKeys: readonly string[],
  rejectUnknown: boolean,
): Properties {
  if (!isPlainObject(value)) return invalidRecord();
  const properties = new Map<string, unknown>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (rejectUnknown && !allowedKeys.includes(key))) {
      return invalidRecord();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      return invalidRecord();
    }
    properties.set(key, descriptor.value);
  }
  return properties;
}

function requiredTrimmedString(properties: Properties, key: string): string {
  const value = properties.get(key);
  if (!properties.has(key) || typeof value !== 'string') return invalidRecord();
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) return invalidRecord();
  return normalized;
}

function requiredNormalizedString(
  properties: Properties,
  key: string,
  pattern: RegExp,
): string {
  const value = properties.get(key);
  if (!properties.has(key) || typeof value !== 'string') return invalidRecord();
  const normalized = value.replace(/\s/g, '');
  if (!pattern.test(normalized)) return invalidRecord();
  return normalized;
}

function optionalTrimmedString(properties: Properties, key: string): string | undefined {
  if (!properties.has(key)) return undefined;
  const value = properties.get(key);
  if (typeof value !== 'string') return invalidRecord();
  const normalized = value.trim();
  if (normalized.length > MAX_IDENTIFIER_LENGTH) return invalidRecord();
  return normalized;
}

function assignOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

export function parsePayrollRecordInput(value: unknown): PayrollRecordInput {
  const properties = readProperties(value, PAYROLL_RECORD_KEYS, true);
  const baseSalary = properties.get('baseSalary');
  if (
    !properties.has('baseSalary')
    || typeof baseSalary !== 'number'
    || !Number.isInteger(baseSalary)
    || baseSalary < 0
    || baseSalary > MAX_BASE_SALARY
  ) {
    return invalidRecord();
  }

  const record: PayrollRecordInput = {
    employeeId: requiredTrimmedString(properties, 'employeeId'),
    baseSalary,
    taxId: requiredNormalizedString(properties, 'taxId', TAX_ID_PATTERN),
    bankAccount: requiredNormalizedString(properties, 'bankAccount', BANK_ACCOUNT_PATTERN),
  };
  assignOptional(record, 'bankName', optionalTrimmedString(properties, 'bankName'));
  assignOptional(record, 'contractType', optionalTrimmedString(properties, 'contractType'));

  if (properties.has('applyProbationRate')) {
    const applyProbationRate = properties.get('applyProbationRate');
    if (typeof applyProbationRate !== 'boolean') return invalidRecord();
    record.applyProbationRate = applyProbationRate;
  }
  if (properties.has('probationRate')) {
    const probationRate = properties.get('probationRate');
    if (
      typeof probationRate !== 'number'
      || !Number.isFinite(probationRate)
      || probationRate < 0
      || probationRate > 100
    ) {
      return invalidRecord();
    }
    record.probationRate = probationRate;
  }
  return record;
}

export function parsePayrollRecordId(value: unknown): string {
  if (typeof value !== 'string') return invalidRecordId();
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) return invalidRecordId();
  return normalized;
}

function readStoredValue(properties: Properties, key: string): unknown {
  return properties.has(key) ? properties.get(key) : undefined;
}

export function parseStoredPayrollRecord(
  value: unknown,
  expectedRoomId: string,
): StoredPayrollRecord {
  const properties = readProperties(value, [], false);
  const roomId = parsePayrollRecordId(readStoredValue(properties, 'roomId'));
  if (roomId !== parsePayrollRecordId(expectedRoomId)) return invalidRecord();

  const candidate: Record<string, unknown> = {
    employeeId: readStoredValue(properties, 'employeeId'),
    baseSalary: readStoredValue(properties, 'baseSalary'),
    taxId: properties.has('taxId') ? readStoredValue(properties, 'taxId') : '',
    bankAccount: properties.has('bankAccount') ? readStoredValue(properties, 'bankAccount') : '',
  };
  for (const key of [
    'bankName',
    'contractType',
    'applyProbationRate',
    'probationRate',
  ] as const) {
    if (properties.has(key)) candidate[key] = readStoredValue(properties, key);
  }
  const input = parsePayrollRecordInput(candidate);
  const stored: StoredPayrollRecord = {
    ...input,
    _id: parsePayrollRecordId(readStoredValue(properties, '_id')),
    roomId,
  };
  for (const key of ['_createdAt', '_updatedAt'] as const) {
    if (!properties.has(key)) continue;
    const timestamp = readStoredValue(properties, key);
    if (typeof timestamp !== 'string') return invalidRecord();
    stored[key] = timestamp;
  }
  return stored;
}
