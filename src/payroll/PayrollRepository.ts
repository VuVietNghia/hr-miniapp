import type { RoomPlatformGateway } from '../platform/hub/RoomPlatformGateway';
import {
  PAYROLL_COLLECTION_NAME,
  parsePayrollRecordId,
  parsePayrollRecordInput,
  parseStoredPayrollRecord,
  type PayrollRecordInput,
  type StoredPayrollRecord,
} from './payroll-types';

export const PAYROLL_SCHEMA_FIELDS = [
  { name: 'employeeId', type: 'string', required: true, maxLength: 200 },
  { name: 'baseSalary', type: 'number', required: true },
  { name: 'taxId', type: 'string', required: false, maxLength: 200 },
  { name: 'bankAccount', type: 'string', required: false, maxLength: 200 },
  { name: 'bankName', type: 'string', required: false, maxLength: 200 },
  { name: 'contractType', type: 'string', required: false, maxLength: 200 },
  { name: 'applyProbationRate', type: 'boolean', required: false },
  { name: 'probationRate', type: 'number', required: false },
  { name: 'roomId', type: 'string', required: true, maxLength: 200 },
] as const;

export const PAYROLL_QUERY_PROJECTION = [
  '_id',
  'employeeId',
  'baseSalary',
  'taxId',
  'bankAccount',
  'bankName',
  'contractType',
  'applyProbationRate',
  'probationRate',
  'roomId',
  '_createdAt',
  '_updatedAt',
] as const;

export interface FixedPayrollQuery {
  collection: typeof PAYROLL_COLLECTION_NAME;
  where: readonly [{ readonly field: 'roomId'; readonly op: '=='; readonly value: string }];
  orderBy: readonly [{ readonly field: 'employeeId'; readonly direction: 'asc' }];
  limit: 200;
}

export interface PayrollQueryPageRequest {
  roomId: string;
  query: FixedPayrollQuery;
  projection: typeof PAYROLL_QUERY_PROJECTION;
  cursor?: unknown;
}

export interface PayrollQueryCapability {
  queryPage(gateway: RoomPlatformGateway, request: PayrollQueryPageRequest): Promise<unknown>;
  cursorFingerprint(cursor: unknown): string | undefined;
}

export type PayrollSchemaState =
  | { readonly status: 'missing' }
  | { readonly status: 'compatible' }
  | { readonly status: 'requires-evolution' }
  | { readonly status: 'incompatible' };

export interface PayrollRoomEmployeeIndexEvidence {
  fields: readonly ['roomId', 'employeeId'];
  descriptor: unknown;
}

export interface PayrollSchemaCapability {
  roomEmployeeIndex: PayrollRoomEmployeeIndexEvidence;
  classifySchema(schema: unknown): PayrollSchemaState;
  evolveSchema?(
    gateway: RoomPlatformGateway,
    request: Readonly<{
      roomId: string;
      collection: typeof PAYROLL_COLLECTION_NAME;
      fields: typeof PAYROLL_SCHEMA_FIELDS;
      index: PayrollRoomEmployeeIndexEvidence;
    }>,
  ): Promise<void>;
}

export interface PayrollCreateResponseCapability {
  readCreatedRecord(response: unknown): unknown;
}

export interface PayrollUpdateRequest {
  roomId: string;
  id: string;
  record: PayrollRecordInput;
}

export interface PayrollDeleteRequest {
  roomId: string;
  id: string;
}

export interface PayrollMutationCapability {
  update(gateway: RoomPlatformGateway, request: PayrollUpdateRequest): Promise<unknown>;
  delete(gateway: RoomPlatformGateway, request: PayrollDeleteRequest): Promise<void>;
}

export interface PayrollRepositoryCapabilities {
  schema?: PayrollSchemaCapability;
  query?: PayrollQueryCapability;
  createResponse?: PayrollCreateResponseCapability;
  mutation?: PayrollMutationCapability;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRoomId(roomId: string): string {
  try {
    return parsePayrollRecordId(roomId);
  } catch {
    throw new Error('Payroll Room is invalid');
  }
}

function fixedQuery(roomId: string): FixedPayrollQuery {
  return {
    collection: PAYROLL_COLLECTION_NAME,
    where: [{ field: 'roomId', op: '==', value: roomId }],
    orderBy: [{ field: 'employeeId', direction: 'asc' }],
    limit: 200,
  };
}

function validateIndexEvidence(
  evidence: PayrollRoomEmployeeIndexEvidence,
): PayrollRoomEmployeeIndexEvidence {
  if (
    evidence.fields.length !== 2
    || evidence.fields[0] !== 'roomId'
    || evidence.fields[1] !== 'employeeId'
    || evidence.descriptor === undefined
    || evidence.descriptor === null
  ) {
    throw new Error('Payroll Room/employee index is not verified');
  }
  return evidence;
}

export class PayrollRepository {
  constructor(
    private readonly gateway: RoomPlatformGateway,
    private readonly capabilities: PayrollRepositoryCapabilities = {},
  ) {}

  async query(untrustedRoomId: string): Promise<readonly StoredPayrollRecord[]> {
    const queryCapability = this.capabilities.query;
    if (!queryCapability) throw new Error('Payroll query is not verified');
    const schema = this.capabilities.schema;
    if (!schema) throw new Error('Payroll schema is not verified');
    const roomId = validateRoomId(untrustedRoomId);
    await this.ensureCompatibleSchema(roomId, schema);

    const records: StoredPayrollRecord[] = [];
    const seenCursors = new Set<string>();
    let cursor: unknown;
    do {
      const page = await queryCapability.queryPage(this.gateway, {
        roomId,
        query: fixedQuery(roomId),
        projection: PAYROLL_QUERY_PROJECTION,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (!isRecord(page) || !Array.isArray(page.records)) {
        throw new Error('Payroll query returned a malformed page');
      }
      for (const rawRecord of page.records) {
        records.push(parseStoredPayrollRecord(rawRecord, roomId));
      }
      if (!Object.prototype.hasOwnProperty.call(page, 'nextCursor') || page.nextCursor === undefined) {
        cursor = undefined;
        continue;
      }
      const fingerprint = queryCapability.cursorFingerprint(page.nextCursor);
      if (!fingerprint) throw new Error('Payroll query returned a malformed cursor');
      if (seenCursors.has(fingerprint)) throw new Error('Payroll query returned a repeated cursor');
      seenCursors.add(fingerprint);
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    return records;
  }

  async create(untrustedRoomId: string, input: PayrollRecordInput): Promise<StoredPayrollRecord> {
    const createResponse = this.capabilities.createResponse;
    if (!createResponse) throw new Error('Payroll create is not verified');
    const schema = this.capabilities.schema;
    if (!schema) throw new Error('Payroll schema is not verified');
    const roomId = validateRoomId(untrustedRoomId);
    const record = parsePayrollRecordInput(input);
    await this.ensureCompatibleSchema(roomId, schema);
    const response = await this.gateway.call<unknown>({
      roomId,
      requiredScope: 'db:write',
      toolName: 'mcpapp.db.create',
      arguments: {
        collection: PAYROLL_COLLECTION_NAME,
        data: { ...record, roomId },
      },
    });
    return parseStoredPayrollRecord(createResponse.readCreatedRecord(response), roomId);
  }

  async update(
    untrustedRoomId: string,
    untrustedId: string,
    input: PayrollRecordInput,
  ): Promise<StoredPayrollRecord> {
    const mutation = this.capabilities.mutation;
    if (!mutation) throw new Error('Payroll update is not verified');
    const schema = this.capabilities.schema;
    if (!schema) throw new Error('Payroll schema is not verified');
    const roomId = validateRoomId(untrustedRoomId);
    const id = parsePayrollRecordId(untrustedId);
    const record = parsePayrollRecordInput(input);
    await this.ensureCompatibleSchema(roomId, schema);
    const updated = await mutation.update(this.gateway, { roomId, id, record });
    return parseStoredPayrollRecord(updated, roomId);
  }

  async delete(untrustedRoomId: string, untrustedId: string): Promise<void> {
    const mutation = this.capabilities.mutation;
    if (!mutation) throw new Error('Payroll delete is not verified');
    const schema = this.capabilities.schema;
    if (!schema) throw new Error('Payroll schema is not verified');
    const roomId = validateRoomId(untrustedRoomId);
    const id = parsePayrollRecordId(untrustedId);
    await this.ensureCompatibleSchema(roomId, schema);
    await mutation.delete(this.gateway, { roomId, id });
  }

  private async ensureCompatibleSchema(
    roomId: string,
    capability: PayrollSchemaCapability,
  ): Promise<void> {
    const index = validateIndexEvidence(capability.roomEmployeeIndex);
    const schema = await this.gateway.call<unknown>({
      roomId,
      requiredScope: 'db:schema:read',
      toolName: 'mcpapp.db.getSchema',
      arguments: { collection: PAYROLL_COLLECTION_NAME },
    });
    const state = capability.classifySchema(schema);
    if (state.status === 'compatible') return;
    if (state.status === 'missing') {
      await this.gateway.call<unknown>({
        roomId,
        requiredScope: 'db:schema:write',
        toolName: 'mcpapp.db.registerCollection',
        arguments: {
          collection: PAYROLL_COLLECTION_NAME,
          scope: 'room',
          fields: PAYROLL_SCHEMA_FIELDS,
          indexes: [index.descriptor],
        },
      });
      return;
    }
    if (state.status === 'requires-evolution' && capability.evolveSchema) {
      await capability.evolveSchema(this.gateway, {
        roomId,
        collection: PAYROLL_COLLECTION_NAME,
        fields: PAYROLL_SCHEMA_FIELDS,
        index,
      });
      const evolved = await this.gateway.call<unknown>({
        roomId,
        requiredScope: 'db:schema:read',
        toolName: 'mcpapp.db.getSchema',
        arguments: { collection: PAYROLL_COLLECTION_NAME },
      });
      if (capability.classifySchema(evolved).status === 'compatible') return;
    }
    throw new Error('Payroll schema is not compatible');
  }
}
