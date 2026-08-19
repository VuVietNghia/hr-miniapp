import { ContractError } from '../errors';
import {
  ContractDocument,
  ContractEvent,
  EmployeeContract,
} from '../types';
import {
  IContractRepository,
  ContractPatch,
  NewContract,
  NewContractDocument,
  NewContractEvent,
} from './IContractRepository';

type HubToolCaller = (name: string, args: Record<string, unknown>) => Promise<unknown>;

interface QueryResponse<T> {
  records?: T[];
  total?: number;
}

const CONTRACT_COLLECTION = 'employee_contracts';
const DOCUMENT_COLLECTION = 'contract_documents';
const EVENT_COLLECTION = 'contract_events';

export class PrivOSContractRepository implements IContractRepository {
  private initializationPromise: Promise<void> | null = null;

  public constructor(private readonly callHubTool: HubToolCaller) {}

  public initializeSchemas(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.registerSchemas().catch(error => {
        this.initializationPromise = null;
        throw error;
      });
    }
    return this.initializationPromise;
  }

  public async listByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]> {
    const contracts = await this.query<EmployeeContract>(CONTRACT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'employeeId', op: '==', value: employeeId },
    ], [{ field: 'startDate', direction: 'desc' }]);
    return contracts.map(contract => this.normalizeContract(contract));
  }

  public async listByEmployeeIds(roomId: string, employeeIds: string[]): Promise<EmployeeContract[]> {
    if (employeeIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let index = 0; index < employeeIds.length; index += 100) {
      chunks.push(employeeIds.slice(index, index + 100));
    }
    const results = await Promise.all(chunks.map(ids => this.query<EmployeeContract>(CONTRACT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'employeeId', op: 'in', value: ids },
    ], [{ field: 'startDate', direction: 'desc' }])));
    return results.flat().map(contract => this.normalizeContract(contract));
  }

  public async getById(roomId: string, contractId: string): Promise<EmployeeContract | null> {
    await this.initializeSchemas();
    try {
      const result = await this.execute<EmployeeContract>('privos.db.get', {
        collection: CONTRACT_COLLECTION,
        id: contractId,
      });
      if (!result || result.roomId !== roomId) return null;
      return this.normalizeContract(result);
    } catch (error) {
      if (this.isNotFound(error)) return null;
      throw error;
    }
  }

  public async findByNumber(roomId: string, contractNumber: string): Promise<EmployeeContract | null> {
    const records = await this.query<EmployeeContract>(CONTRACT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'contractNumber', op: '==', value: contractNumber },
    ], undefined, 1);
    return records[0] ? this.normalizeContract(records[0]) : null;
  }

  public async listActiveByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]> {
    const contracts = await this.query<EmployeeContract>(CONTRACT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'employeeId', op: '==', value: employeeId },
      { field: 'status', op: '==', value: 'ACTIVE' },
    ]);
    return contracts.map(contract => this.normalizeContract(contract));
  }

  public async create(contract: NewContract): Promise<EmployeeContract> {
    await this.initializeSchemas();
    const created = await this.execute<EmployeeContract>('privos.db.create', {
      collection: CONTRACT_COLLECTION,
      data: contract,
    });
    return this.normalizeContract(created);
  }

  public async update(
    roomId: string,
    contractId: string,
    data: ContractPatch,
  ): Promise<EmployeeContract> {
    await this.initializeSchemas();
    const existing = await this.getById(roomId, contractId);
    if (!existing) throw new ContractError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng.', 404);

    const safeData = { ...data } as Record<string, unknown>;
    delete safeData._id;
    delete safeData.roomId;
    delete safeData.employeeId;
    delete safeData.createdBy;
    delete safeData._createdAt;
    delete safeData._updatedAt;

    await this.execute('privos.db.update', {
      collection: CONTRACT_COLLECTION,
      id: contractId,
      data: safeData,
    });
    const updated = await this.getById(roomId, contractId);
    if (!updated) throw new ContractError('CONTRACT_NOT_FOUND', 'Không thể tải lại hợp đồng sau khi cập nhật.', 404);
    return updated;
  }

  public async createDocument(document: NewContractDocument): Promise<ContractDocument> {
    await this.initializeSchemas();
    return this.execute<ContractDocument>('privos.db.create', {
      collection: DOCUMENT_COLLECTION,
      data: document,
    });
  }

  public async listDocuments(roomId: string, contractId: string): Promise<ContractDocument[]> {
    return this.query<ContractDocument>(DOCUMENT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'contractId', op: '==', value: contractId },
    ], [{ field: 'version', direction: 'desc' }]);
  }

  public async createEvent(event: NewContractEvent): Promise<ContractEvent> {
    await this.initializeSchemas();
    return this.execute<ContractEvent>('privos.db.create', {
      collection: EVENT_COLLECTION,
      data: event,
    });
  }

  public async listEvents(roomId: string, contractId: string): Promise<ContractEvent[]> {
    return this.query<ContractEvent>(EVENT_COLLECTION, [
      { field: 'roomId', op: '==', value: roomId },
      { field: 'contractId', op: '==', value: contractId },
    ], [{ field: 'occurredAt', direction: 'desc' }]);
  }

  private async registerSchemas(): Promise<void> {
    await this.ensureCollection(CONTRACT_COLLECTION, [
      { name: 'roomId', type: 'string', required: true, maxLength: 100 },
      { name: 'employeeId', type: 'string', required: true, maxLength: 100 },
      { name: 'contractNumber', type: 'string', required: true, maxLength: 100 },
      { name: 'contractType', type: 'string', required: true, enum: ['FIXED_TERM', 'INDEFINITE'] },
      { name: 'status', type: 'string', required: true, enum: ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'TERMINATED', 'CANCELLED'] },
      { name: 'startDate', type: 'string', required: true, maxLength: 10 },
      { name: 'endDate', type: 'string', maxLength: 10 },
      { name: 'signedDate', type: 'string', maxLength: 10 },
      { name: 'effectiveDate', type: 'string', maxLength: 10 },
      { name: 'position', type: 'string', required: true, maxLength: 200 },
      { name: 'department', type: 'string', required: true, maxLength: 200 },
      { name: 'workLocation', type: 'string', required: true, maxLength: 300 },
      { name: 'baseSalary', type: 'number', required: true, min: 1 },
      { name: 'currency', type: 'string', required: true, enum: ['VND'] },
      { name: 'currentSignedFileId', type: 'string', maxLength: 200 },
      { name: 'currentSignedFileName', type: 'string', maxLength: 255 },
      { name: 'previousContractId', type: 'string', maxLength: 100 },
      { name: 'terminationDate', type: 'string', maxLength: 10 },
      { name: 'terminationReason', type: 'string', maxLength: 1000 },
      { name: 'revision', type: 'number', required: true, min: 1 },
      { name: 'createdBy', type: 'string', required: true, maxLength: 100 },
      { name: 'updatedBy', type: 'string', required: true, maxLength: 100 },
    ], [
      { fields: { roomId: 1, contractNumber: 1 }, unique: true },
      { fields: { roomId: 1, employeeId: 1, status: 1 } },
      { fields: { roomId: 1, endDate: 1 } },
    ]);

    await this.ensureCollection(DOCUMENT_COLLECTION, [
      { name: 'roomId', type: 'string', required: true, maxLength: 100 },
      { name: 'contractId', type: 'string', required: true, maxLength: 100 },
      { name: 'documentType', type: 'string', required: true, enum: ['DRAFT', 'SIGNED', 'ANNEX', 'TERMINATION'] },
      { name: 'version', type: 'number', required: true, min: 1 },
      { name: 'fileId', type: 'string', required: true, maxLength: 200 },
      { name: 'fileName', type: 'string', required: true, maxLength: 255 },
      { name: 'mimeType', type: 'string', required: true, maxLength: 100 },
      { name: 'fileSize', type: 'number', required: true, min: 1 },
      { name: 'uploadedBy', type: 'string', required: true, maxLength: 100 },
      { name: 'uploadedAt', type: 'string', required: true, maxLength: 30 },
    ], [
      { fields: { roomId: 1, contractId: 1, documentType: 1, version: 1 }, unique: true },
    ]);

    await this.ensureCollection(EVENT_COLLECTION, [
      { name: 'roomId', type: 'string', required: true, maxLength: 100 },
      { name: 'contractId', type: 'string', required: true, maxLength: 100 },
      { name: 'action', type: 'string', required: true },
      { name: 'actorUserId', type: 'string', required: true, maxLength: 100 },
      { name: 'detail', type: 'string', required: true, maxLength: 2000 },
      { name: 'occurredAt', type: 'string', required: true, maxLength: 30 },
    ], [{ fields: { roomId: 1, contractId: 1, occurredAt: -1 } }]);
  }

  private async ensureCollection(
    collection: string,
    fields: Array<Record<string, unknown>>,
    indexes: Array<Record<string, unknown>>,
  ): Promise<void> {
    try {
      await this.execute('privos.db.getSchema', { collection });
      return;
    } catch (error) {
      if (!this.isNotFound(error) && !this.isMissingSchema(error)) throw error;
    }
    await this.execute('privos.db.registerCollection', {
      collection,
      scope: 'global',
      fields,
      indexes,
    });
  }

  private async query<T>(
    collection: string,
    where: Array<Record<string, unknown>>,
    orderBy?: Array<Record<string, unknown>>,
    maxRecords?: number,
  ): Promise<T[]> {
    await this.initializeSchemas();
    const records: T[] = [];
    const pageSize = Math.min(1000, maxRecords ?? 1000);
    let offset = 0;

    while (maxRecords === undefined || records.length < maxRecords) {
      const limit = Math.min(pageSize, (maxRecords ?? Number.POSITIVE_INFINITY) - records.length);
      const result = await this.execute<QueryResponse<T>>('privos.db.query', {
        collection,
        where,
        ...(orderBy ? { orderBy } : {}),
        limit,
        offset,
      });
      const page = Array.isArray(result) ? result : (result.records ?? []);
      records.push(...page);
      const total = Array.isArray(result) ? undefined : result.total;
      if (page.length < limit || (typeof total === 'number' && records.length >= total)) break;
      offset += page.length;
    }

    return records;
  }

  private async execute<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const raw = await this.callHubTool(name, args);
    const parsed = this.parseHubResult(raw);
    if (this.isErrorResult(parsed)) {
      throw new ContractError(
        'PRIVOS_DB_ERROR',
        typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error),
        502,
      );
    }
    return this.unwrapRecord(parsed) as T;
  }

  private normalizeContract(contract: EmployeeContract): EmployeeContract {
    return {
      ...contract,
      endDate: contract.endDate ?? undefined,
      signedDate: contract.signedDate ?? undefined,
      effectiveDate: contract.effectiveDate ?? undefined,
      currentSignedFileId: contract.currentSignedFileId ?? undefined,
      currentSignedFileName: contract.currentSignedFileName ?? undefined,
      previousContractId: contract.previousContractId ?? undefined,
      terminationDate: contract.terminationDate ?? undefined,
      terminationReason: contract.terminationReason ?? undefined,
    };
  }

  private parseHubResult(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const value = raw as Record<string, unknown>;
    const content = value.content;
    if (Array.isArray(content)) {
      const first = content[0] as Record<string, unknown> | undefined;
      if (first && typeof first.text === 'string') {
        try {
          return JSON.parse(first.text);
        } catch {
          return first.text;
        }
      }
    }
    return value;
  }

  private unwrapRecord(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return record.record ?? record.data ?? value;
  }

  private isErrorResult(value: unknown): value is { error: unknown } {
    return Boolean(value && typeof value === 'object' && 'error' in value);
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof Error && /not found|không tìm thấy|record not found/i.test(error.message);
  }

  private isMissingSchema(error: unknown): boolean {
    return error instanceof Error && /schema|collection.*(not|chưa).*exist|unknown collection/i.test(error.message);
  }
}
