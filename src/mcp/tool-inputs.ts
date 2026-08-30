import type { EmailSource } from '../email-history/email-history-model';
import {
  parsePayrollRecordId,
  parsePayrollRecordInput,
  type PayrollRecordInput,
} from '../payroll/payroll-types';

export interface DashboardInput {
  roomId?: string;
}

export interface MailSendInput {
  toName: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
  roomId?: string;
  source?: EmailSource;
  cvItemId?: string;
  cvListId?: string;
  jdName?: string;
}

export interface MailRetryInput {
  roomId: string;
  itemId: string;
}

export interface PayrollCreateInput {
  record: PayrollRecordInput;
}

export interface PayrollUpdateInput {
  id: string;
  record: PayrollRecordInput;
}

export interface PayrollDeleteInput {
  id: string;
}

const DASHBOARD_KEYS = Object.freeze(['roomId'] as const);
const MAIL_SEND_KEYS = Object.freeze([
  'toName',
  'toEmail',
  'subject',
  'htmlContent',
  'roomId',
  'source',
  'cvItemId',
  'cvListId',
  'jdName',
] as const);
const MAIL_RETRY_KEYS = Object.freeze(['roomId', 'itemId'] as const);
const PAYROLL_CREATE_KEYS = Object.freeze(['record'] as const);
const PAYROLL_UPDATE_KEYS = Object.freeze(['id', 'record'] as const);
const PAYROLL_DELETE_KEYS = Object.freeze(['id'] as const);

type ParsedProperties = ReadonlyMap<string, unknown>;

function invalidToolArguments(): never {
  throw new TypeError('Invalid tool arguments');
}

function parseSafely<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    return invalidToolArguments();
  }
}

function readExactObject(
  value: unknown,
  allowedKeys: readonly string[],
): ParsedProperties {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return invalidToolArguments();
  }

  const properties = new Map<string, unknown>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowedKeys.includes(key)) {
      return invalidToolArguments();
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      return invalidToolArguments();
    }
    properties.set(key, descriptor.value);
  }
  return properties;
}

function requiredString(properties: ParsedProperties, key: string): string {
  const value = properties.get(key);
  if (!properties.has(key) || typeof value !== 'string') {
    return invalidToolArguments();
  }
  return value;
}

function optionalString(properties: ParsedProperties, key: string): string | undefined {
  if (!properties.has(key)) return undefined;
  const value = properties.get(key);
  if (typeof value !== 'string') return invalidToolArguments();
  return value;
}


function optionalEmailSource(
  properties: ParsedProperties,
  key: string,
): EmailSource | undefined {
  if (!properties.has(key)) return undefined;
  const value = properties.get(key);
  if (value !== 'cv_scored' && value !== 'lifecycle') {
    return invalidToolArguments();
  }
  return value;
}

function assignOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

export function parseDashboardInput(value: unknown): DashboardInput {
  return parseSafely(() => {
    const properties = readExactObject(value, DASHBOARD_KEYS);
    const input: DashboardInput = {};
    assignOptional(input, 'roomId', optionalString(properties, 'roomId'));
    return input;
  });
}

export function parsePayrollQueryInput(value: unknown): Record<string, never> {
  return parseSafely(() => {
    readExactObject(value, []);
    return {};
  });
}

export function parseMailSendInput(value: unknown): MailSendInput {
  return parseSafely(() => {
    const properties = readExactObject(value, MAIL_SEND_KEYS);
    const input: MailSendInput = {
      toName: requiredString(properties, 'toName'),
      toEmail: requiredString(properties, 'toEmail'),
      subject: requiredString(properties, 'subject'),
      htmlContent: requiredString(properties, 'htmlContent'),
    };
    assignOptional(input, 'roomId', optionalString(properties, 'roomId'));
    assignOptional(input, 'source', optionalEmailSource(properties, 'source'));
    assignOptional(input, 'cvItemId', optionalString(properties, 'cvItemId'));
    assignOptional(input, 'cvListId', optionalString(properties, 'cvListId'));
    assignOptional(input, 'jdName', optionalString(properties, 'jdName'));
    return input;
  });
}

export function parseMailRetryInput(value: unknown): MailRetryInput {
  return parseSafely(() => {
    const properties = readExactObject(value, MAIL_RETRY_KEYS);
    return {
      roomId: requiredString(properties, 'roomId'),
      itemId: requiredString(properties, 'itemId'),
    };
  });
}

export function parsePayrollCreateInput(value: unknown): PayrollCreateInput {
  return parseSafely(() => {
    const properties = readExactObject(value, PAYROLL_CREATE_KEYS);
    if (!properties.has('record')) return invalidToolArguments();
    return { record: parsePayrollRecordInput(properties.get('record')) };
  });
}

export function parsePayrollUpdateInput(value: unknown): PayrollUpdateInput {
  return parseSafely(() => {
    const properties = readExactObject(value, PAYROLL_UPDATE_KEYS);
    if (!properties.has('record')) return invalidToolArguments();
    return {
      id: parsePayrollRecordId(requiredString(properties, 'id')),
      record: parsePayrollRecordInput(properties.get('record')),
    };
  });
}

export function parsePayrollDeleteInput(value: unknown): PayrollDeleteInput {
  return parseSafely(() => {
    const properties = readExactObject(value, PAYROLL_DELETE_KEYS);
    return { id: parsePayrollRecordId(requiredString(properties, 'id')) };
  });
}
