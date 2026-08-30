import {
  EMAIL_HISTORY_FIELD_IDS,
  EMAIL_HISTORY_LIST_NAME,
  EMAIL_HISTORY_STAGES,
  parseEmailHistoryItem,
  type EmailHistoryRecord,
  type EmailHistoryStageIds,
  type StoredEmailPayload,
} from '../email-history/email-history-model';
import type { RoomPlatformGateway } from '../platform/hub/RoomPlatformGateway';

export interface EmailHistoryStore {
  listId: string;
  stageIds: EmailHistoryStageIds;
}

export interface EmailHistoryListDiscoveryCapability {
  findList(roomId: string, listName: string): Promise<{ listId: string } | undefined>;
}

export interface EmailHistoryStageLookupCapability {
  getStageIds(roomId: string, listId: string): Promise<EmailHistoryStageIds>;
}

export interface EmailHistoryStageMovementCapability {
  moveItemToStage(roomId: string, itemId: string, stageId: string): Promise<void>;
}

export interface EmailHistoryRepositoryDependencies {
  now: () => string;
  createRecordId: () => string;
}

export interface EmailHistoryRepositoryCapabilities {
  discovery?: EmailHistoryListDiscoveryCapability;
  stageLookup?: EmailHistoryStageLookupCapability;
  stageMovement?: EmailHistoryStageMovementCapability;
}

const FIELD_DEFINITIONS = [
  { _id: EMAIL_HISTORY_FIELD_IDS.recordId, name: 'Mã email', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.source, name: 'Nguồn gửi', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.recipientName, name: 'Tên người nhận', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.recipientEmail, name: 'Email người nhận', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.subject, name: 'Tiêu đề', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.htmlContent, name: 'Nội dung HTML', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.cvItemId, name: 'CV item ID', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.cvListId, name: 'CV list ID', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.jdName, name: 'Tên JD', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.createdAt, name: 'Thời gian tạo', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.updatedAt, name: 'Cập nhật gần nhất', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.sentAt, name: 'Thời gian gửi', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.attemptCount, name: 'Số lần gửi', type: 'NUMBER' },
  { _id: EMAIL_HISTORY_FIELD_IDS.lastError, name: 'Lỗi gần nhất', type: 'TEXT' },
  { _id: EMAIL_HISTORY_FIELD_IDS.requestedBy, name: 'Người gửi', type: 'TEXT' },
] as const;

const STAGE_DEFINITIONS = [
  { name: EMAIL_HISTORY_STAGES.interviewSent, color: '#16a34a' },
  { name: EMAIL_HISTORY_STAGES.interviewFailed, color: '#dc2626' },
  { name: EMAIL_HISTORY_STAGES.employeeSent, color: '#16a34a' },
  { name: EMAIL_HISTORY_STAGES.employeeFailed, color: '#dc2626' },
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim() ? value : undefined;
}

function getObjectId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return nonEmptyString(value._id)
    ?? nonEmptyString(value.id);
}

function getListId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return getObjectId(value) ?? nonEmptyString(value.listId);
}

function getStageId(
  stages: EmailHistoryStageIds,
  source: StoredEmailPayload['source'],
  status: EmailHistoryRecord['status'],
): string {
  if (source === 'cv_scored') {
    return status === 'sent' ? stages.interviewSent : stages.interviewFailed;
  }
  return status === 'sent' ? stages.employeeSent : stages.employeeFailed;
}

function normalizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(accessToken|privateKey|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 1000);
}

function recordToCustomFields(record: EmailHistoryRecord, recordId: string) {
  return [
    { fieldId: EMAIL_HISTORY_FIELD_IDS.recordId, value: recordId },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.source, value: record.source },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.recipientName, value: record.recipientName },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.recipientEmail, value: record.recipientEmail },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.subject, value: record.subject },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.htmlContent, value: record.htmlContent },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.cvItemId, value: record.cvItemId || '' },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.cvListId, value: record.cvListId || '' },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.jdName, value: record.jdName || '' },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.createdAt, value: record.createdAt },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.updatedAt, value: record.updatedAt },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.sentAt, value: record.sentAt || '' },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.attemptCount, value: record.attemptCount },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.lastError, value: record.lastError || '' },
    { fieldId: EMAIL_HISTORY_FIELD_IDS.requestedBy, value: record.requestedBy || '' },
  ];
}

function recordPayload(record: EmailHistoryRecord): StoredEmailPayload {
  return {
    source: record.source,
    recipientName: record.recipientName,
    recipientEmail: record.recipientEmail,
    subject: record.subject,
    htmlContent: record.htmlContent,
    ...(record.cvItemId ? { cvItemId: record.cvItemId } : {}),
    ...(record.cvListId ? { cvListId: record.cvListId } : {}),
    ...(record.jdName ? { jdName: record.jdName } : {}),
  };
}

function validateStageIds(value: EmailHistoryStageIds): EmailHistoryStageIds {
  const validated = {
    interviewSent: nonEmptyString(value.interviewSent),
    interviewFailed: nonEmptyString(value.interviewFailed),
    employeeSent: nonEmptyString(value.employeeSent),
    employeeFailed: nonEmptyString(value.employeeFailed),
  };
  if (
    !validated.interviewSent
    || !validated.interviewFailed
    || !validated.employeeSent
    || !validated.employeeFailed
  ) {
    throw new Error('List lịch sử email thiếu cấu hình stage bắt buộc.');
  }
  return {
    interviewSent: validated.interviewSent,
    interviewFailed: validated.interviewFailed,
    employeeSent: validated.employeeSent,
    employeeFailed: validated.employeeFailed,
  };
}

function readItems(response: unknown): readonly unknown[] {
  if (Array.isArray(response)) return response;
  if (isRecord(response) && Array.isArray(response.items)) return response.items;
  throw new Error('Dữ liệu lịch sử email không hợp lệ.');
}

function readCustomFieldValues(item: Readonly<Record<string, unknown>>): ReadonlyMap<string, unknown> {
  const values = new Map<string, unknown>();
  if (!Array.isArray(item.customFields)) return values;
  for (const value of item.customFields) {
    if (!isRecord(value)) continue;
    const fieldId = nonEmptyString(value.fieldId) ?? nonEmptyString(value.fieldDefinitionId);
    if (fieldId) values.set(fieldId, value.value);
  }
  return values;
}

export class EmailHistoryRepository {
  private readonly stores = new Map<string, Promise<EmailHistoryStore>>();

  constructor(
    private readonly gateway: RoomPlatformGateway,
    private readonly dependencies: EmailHistoryRepositoryDependencies,
    private readonly capabilities: EmailHistoryRepositoryCapabilities = {},
  ) {}

  ensureStore(roomId: string): Promise<EmailHistoryStore> {
    const existing = this.stores.get(roomId);
    if (existing) return existing;

    const pending = this.findOrCreateStore(roomId).catch(error => {
      this.stores.delete(roomId);
      throw error;
    });
    this.stores.set(roomId, pending);
    return pending;
  }

  async assertReadyForTrackedWrite(
    roomId: string,
    requiresStageMovement: boolean,
  ): Promise<void> {
    if (!this.capabilities.discovery) {
      throw new Error('Email history List discovery is not available');
    }
    if (!this.capabilities.stageLookup) {
      throw new Error('Email history stage lookup is not available');
    }
    if (requiresStageMovement && !this.capabilities.stageMovement) {
      throw new Error('Email history stage movement is not available');
    }
    await this.ensureStore(roomId);
  }

  async createResult(
    roomId: string,
    payload: StoredEmailPayload,
    status: EmailHistoryRecord['status'],
    error?: unknown,
    requestedBy?: string,
  ): Promise<EmailHistoryRecord> {
    const store = await this.ensureStore(roomId);
    const timestamp = this.dependencies.now();
    const recordId = this.dependencies.createRecordId();
    const stageId = getStageId(store.stageIds, payload.source, status);
    const draft: EmailHistoryRecord = {
      id: '',
      listId: store.listId,
      stageId,
      status,
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
      sentAt: status === 'sent' ? timestamp : undefined,
      attemptCount: 1,
      lastError: status === 'failed' ? normalizeError(error) : undefined,
      requestedBy,
    };

    const response = await this.gateway.call<unknown>({
      roomId,
      requiredScope: 'lists:write',
      toolName: 'mcpapp.lists.createItem',
      arguments: {
        listId: store.listId,
        title: payload.subject,
        stageId,
        customFields: recordToCustomFields(draft, recordId),
      },
    });
    const item = isRecord(response) && response.item !== undefined ? response.item : response;
    const itemId = getObjectId(item);
    if (!itemId) throw new Error('Không lấy được item ID sau khi tạo lịch sử email.');
    return { ...draft, id: itemId };
  }

  async markSent(roomId: string, itemId: string): Promise<EmailHistoryRecord> {
    const store = await this.ensureStore(roomId);
    const current = await this.getRecord(roomId, itemId);
    const timestamp = this.dependencies.now();
    return this.updateRecord(roomId, {
      ...current,
      stageId: getStageId(store.stageIds, current.source, 'sent'),
      status: 'sent',
      updatedAt: timestamp,
      sentAt: timestamp,
      attemptCount: current.attemptCount + 1,
      lastError: undefined,
    });
  }

  async markFailed(roomId: string, itemId: string, error: unknown): Promise<EmailHistoryRecord> {
    const store = await this.ensureStore(roomId);
    const current = await this.getRecord(roomId, itemId);
    return this.updateRecord(roomId, {
      ...current,
      stageId: getStageId(store.stageIds, current.source, 'failed'),
      status: 'failed',
      updatedAt: this.dependencies.now(),
      attemptCount: current.attemptCount + 1,
      lastError: normalizeError(error),
    });
  }

  async prepareRetry(
    roomId: string,
    itemId: string,
  ): Promise<{ record: EmailHistoryRecord; payload: StoredEmailPayload }> {
    const current = await this.getRecord(roomId, itemId);
    if (current.status !== 'failed') {
      throw new Error('Chỉ có thể gửi lại email ở trạng thái Gửi lỗi.');
    }
    return { record: current, payload: recordPayload(current) };
  }

  async getRecord(roomId: string, itemId: string): Promise<EmailHistoryRecord> {
    const store = await this.ensureStore(roomId);
    const item = await this.getRawRecordItem(roomId, store.listId, itemId);
    const record = parseEmailHistoryItem(item, store.stageIds);
    if (!record) throw new Error('Dữ liệu lịch sử email không hợp lệ.');
    return record;
  }

  private async findOrCreateStore(roomId: string): Promise<EmailHistoryStore> {
    if (!roomId.trim()) throw new Error('Email history Room is required');
    const discovery = this.capabilities.discovery;
    if (!discovery) throw new Error('Email history List discovery is not available');
    const stageLookup = this.capabilities.stageLookup;
    if (!stageLookup) throw new Error('Email history stage lookup is not available');

    const discovered = await discovery.findList(roomId, EMAIL_HISTORY_LIST_NAME);
    let listId: string;
    if (discovered !== undefined) {
      const discoveredListId = nonEmptyString(discovered.listId);
      if (!discoveredListId) {
        throw new Error('Email history List discovery returned an invalid List id');
      }
      listId = discoveredListId;
    } else {
      const created = await this.gateway.call<unknown>({
        roomId,
        requiredScope: 'lists:write',
        toolName: 'mcpapp.lists.create',
        arguments: {
          roomId,
          name: EMAIL_HISTORY_LIST_NAME,
          description: 'Lịch sử email dùng chung của HR Mini App. Không xóa List này.',
          fieldDefinitions: FIELD_DEFINITIONS,
          stages: STAGE_DEFINITIONS,
        },
      });
      const list = isRecord(created) && created.list !== undefined ? created.list : created;
      const createdListId = getListId(list);
      if (!createdListId) throw new Error('Không thể khởi tạo List lịch sử email.');
      listId = createdListId;
    }

    const stageIds = validateStageIds(await stageLookup.getStageIds(roomId, listId));
    return { listId, stageIds };
  }

  private async updateRecord(
    roomId: string,
    record: EmailHistoryRecord,
  ): Promise<EmailHistoryRecord> {
    const currentItem = await this.getRawRecordItem(roomId, record.listId, record.id);
    const currentStageId = nonEmptyString(currentItem.stageId);
    if (currentStageId !== record.stageId) {
      const stageMovement = this.capabilities.stageMovement;
      if (!stageMovement) {
        throw new Error('Email history stage movement is not available');
      }
      await stageMovement.moveItemToStage(roomId, record.id, record.stageId);
    }

    const currentValues = readCustomFieldValues(currentItem);
    const recordId = nonEmptyString(currentValues.get(EMAIL_HISTORY_FIELD_IDS.recordId)) ?? record.id;
    const desiredFields = recordToCustomFields(record, recordId);
    for (const field of desiredFields) {
      if (field.fieldId === EMAIL_HISTORY_FIELD_IDS.recordId) continue;
      if (Object.is(currentValues.get(field.fieldId), field.value)) continue;
      await this.gateway.call<unknown>({
        roomId,
        requiredScope: 'lists:write',
        toolName: 'mcpapp.lists.updateCustomField',
        arguments: {
          itemId: record.id,
          fieldId: field.fieldId,
          value: field.value,
        },
      });
    }
    return record;
  }

  private async getRawRecordItem(
    roomId: string,
    listId: string,
    itemId: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    const response = await this.gateway.call<unknown>({
      roomId,
      requiredScope: 'lists:read',
      toolName: 'mcpapp.lists.getItems',
      arguments: { listId, count: 1000 },
    });
    const item = readItems(response).find(candidate => (
      isRecord(candidate)
      && getObjectId(candidate) === itemId
      && nonEmptyString(candidate.listId) === listId
    ));
    if (!isRecord(item)) throw new Error('Không tìm thấy email trong Room hiện tại.');
    return item;
  }
}
