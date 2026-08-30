import type { McpApp } from '@privos_ai/app-react';

import {
  OptionalFeatureUnavailableError,
  PrivosRestError,
  restCall,
} from '../privos-rest';
import type {
  AddFieldInput,
  AiMessage,
  AiMessageDispatch,
  AiMessageInput,
  BoundedItems,
  CreateItemInput,
  CreatedList,
  CreateListInput,
  CurrentRoomContext,
  FieldDefinition,
  FilesClient,
  FoldersClient,
  ItemsPage,
  ItemsQuery,
  ListInfo,
  ListItem,
  ListsClient,
  ListSummary,
  RoomClients,
  RoomFile,
  SandboxClient,
  StageSummary,
  UpdateItemInput,
  UploadedFile,
  UploadInput,
} from './contracts';

type BrowserApp = Pick<McpApp, 'rest' | 'uploadFile' | 'callServerTool'>;
type ContextApp = Pick<McpApp, 'callServerTool'>;

const INVALID_REQUEST_MESSAGE = 'Room client request is invalid.';
const INVALID_RESPONSE_MESSAGE = 'The Room operation returned an invalid response.';
const MAX_PAGE_COUNT = 500;

function invalidRequest(): never {
  throw new Error(INVALID_REQUEST_MESSAGE);
}

function invalidResponse(): never {
  throw new Error(INVALID_RESPONSE_MESSAGE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalidRequest();
  return value;
}

function parsedString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) return invalidResponse();
  return value;
}

function parsedOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalidResponse();
  return value;
}

function parsedOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return invalidResponse();
  return value;
}

function parseFieldDefinition(value: unknown): FieldDefinition {
  if (!isRecord(value)) return invalidResponse();
  return {
    _id: parsedString(value, '_id'),
    name: parsedString(value, 'name'),
    type: parsedString(value, 'type'),
  };
}

function parseFieldDefinitions(value: unknown): readonly FieldDefinition[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return invalidResponse();
  return value.map(parseFieldDefinition);
}

function parseListSummary(value: unknown): ListSummary {
  if (!isRecord(value)) return invalidResponse();
  const fieldDefinitions = parseFieldDefinitions(value.fieldDefinitions);
  return {
    _id: parsedString(value, '_id'),
    name: parsedString(value, 'name'),
    ...(fieldDefinitions === undefined ? {} : { fieldDefinitions }),
  };
}

function parseStageSummary(value: unknown): StageSummary {
  if (!isRecord(value)) return invalidResponse();
  const name = parsedOptionalString(value, 'name');
  return {
    _id: parsedString(value, '_id'),
    ...(name === undefined ? {} : { name }),
  };
}

function parseCustomFields(value: unknown): ListItem['customFields'] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return invalidResponse();
  return value.map((entry) => {
    if (!isRecord(entry) || !Object.prototype.hasOwnProperty.call(entry, 'value')) return invalidResponse();
    return { fieldId: parsedString(entry, 'fieldId'), value: entry.value };
  });
}

function parseListItem(value: unknown): ListItem {
  if (!isRecord(value)) return invalidResponse();
  const stageId = parsedOptionalString(value, 'stageId');
  const customFields = parseCustomFields(value.customFields);
  const description = parsedOptionalString(value, 'description');
  return {
    _id: parsedString(value, '_id'),
    name: parsedString(value, 'name'),
    ...(stageId === undefined ? {} : { stageId }),
    ...(description === undefined ? {} : { description }),
    ...(customFields === undefined ? {} : { customFields }),
  };
}

function parseRecordBody(body: unknown): Record<string, unknown> {
  return isRecord(body) ? body : invalidResponse();
}

function parseListsBody(body: unknown): readonly ListSummary[] {
  const record = parseRecordBody(body);
  if (!Array.isArray(record.lists)) return invalidResponse();
  return record.lists.map(parseListSummary);
}

function parseListInfoBody(body: unknown): ListInfo {
  const record = parseRecordBody(body);
  if (!Array.isArray(record.stages)) return invalidResponse();
  return {
    list: parseListSummary(record.list),
    stages: record.stages.map(parseStageSummary),
  };
}

function parseItems(body: Record<string, unknown>): readonly ListItem[] {
  if (!Array.isArray(body.items)) return invalidResponse();
  return body.items.map(parseListItem);
}

function parseItemsPage(body: unknown): ItemsPage {
  const record = parseRecordBody(body);
  if (record.nextCursor !== null && typeof record.nextCursor !== 'string') return invalidResponse();
  return { items: parseItems(record), nextCursor: record.nextCursor };
}

function parseBoundedItems(body: unknown): BoundedItems {
  const record = parseRecordBody(body);
  if (record.truncated !== undefined && typeof record.truncated !== 'boolean') return invalidResponse();
  return { items: parseItems(record), truncated: record.truncated ?? false };
}

function parseCreatedList(body: unknown): CreatedList {
  const record = parseRecordBody(body);
  const list = parseListSummary(record.list);
  const defaultStage = record.defaultStage === undefined ? undefined : parseStageSummary(record.defaultStage);
  const stages = record.stages === undefined
    ? (defaultStage === undefined ? [] : [defaultStage])
    : Array.isArray(record.stages)
      ? record.stages.map(parseStageSummary)
      : invalidResponse();
  return {
    list,
    ...(defaultStage === undefined ? {} : { defaultStage }),
    stages,
  };
}

function parseWrappedField(body: unknown): FieldDefinition {
  const record = parseRecordBody(body);
  return parseFieldDefinition(record.field);
}

function parseWrappedItem(body: unknown): ListItem {
  const record = parseRecordBody(body);
  return parseListItem(record.item);
}

function parseRoomFile(value: unknown): RoomFile {
  if (!isRecord(value)) return invalidResponse();
  const size = parsedOptionalNumber(value, 'size') ?? parsedOptionalNumber(value, 'file_size');
  const mimeType = parsedOptionalString(value, 'mimeType') ?? parsedOptionalString(value, 'file_type');
  return {
    _id: parsedString(value, '_id'),
    name: parsedString(value, 'name'),
    ...(size === undefined ? {} : { size }),
    ...(mimeType === undefined ? {} : { mimeType }),
  };
}

function parseRoomFiles(body: unknown): readonly RoomFile[] {
  const candidate = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.files)
      ? body.files
      : isRecord(body) && Array.isArray(body.data)
        ? body.data
        : invalidResponse();
  return candidate.map(parseRoomFile);
}

function parseFileContent(body: unknown): string {
  if (typeof body === 'string') return body;
  if (!isRecord(body) || typeof body.result !== 'string') return invalidResponse();
  return body.result;
}

function parseUploadedFile(value: unknown): UploadedFile {
  if (!isRecord(value)) return invalidResponse();
  return parseRoomFile(value.file);
}

function parseAiDispatch(body: unknown): AiMessageDispatch {
  const record = parseRecordBody(body);
  const sessionId = parsedString(record, 'sessionId');
  if (record.aiMessage !== undefined && !isRecord(record.aiMessage)) return invalidResponse();
  const aiMessageId = isRecord(record.aiMessage)
    ? parsedOptionalString(record.aiMessage, '_id')
    : undefined;
  return {
    sessionId,
    ...(aiMessageId === undefined ? {} : { aiMessageId }),
  };
}

function parseAiMessage(value: unknown): AiMessage {
  if (!isRecord(value)) return invalidResponse();
  const status = parsedOptionalString(value, 'status');
  const content = parsedOptionalString(value, 'content');
  const createdAt = parsedOptionalString(value, 'createdAt');
  return {
    _id: parsedString(value, '_id'),
    ...(status === undefined ? {} : { status }),
    ...(content === undefined ? {} : { content }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
}

function parseAiMessages(body: unknown): readonly AiMessage[] {
  const record = parseRecordBody(body);
  if (!Array.isArray(record.messages)) return invalidResponse();
  return record.messages.map(parseAiMessage);
}

function parseToolBody(value: unknown): unknown {
  if (!isRecord(value)) return invalidResponse();
  if (value.isError === true) throw new PrivosRestError();
  if (!Array.isArray(value.content) || value.content.length === 0 || !isRecord(value.content[0])) {
    return invalidResponse();
  }
  const text = value.content[0].text;
  if (typeof text !== 'string' || text.trim().length === 0) return invalidResponse();
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return invalidResponse();
  }
}

function validatePageCount(count: number): number {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_PAGE_COUNT) return invalidRequest();
  return count;
}

function validateOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value);
}

function buildFieldDefinitions(input: CreateListInput['fieldDefinitions']): readonly Record<string, unknown>[] {
  if (!Array.isArray(input)) return invalidRequest();
  return input.map((field) => ({
    ...(field.fieldId === undefined ? {} : { fieldId: requiredString(field.fieldId) }),
    name: requiredString(field.name),
    type: requiredString(field.type),
  }));
}

function buildStages(input: NonNullable<CreateListInput['stages']>): readonly Record<string, unknown>[] {
  if (!Array.isArray(input)) return invalidRequest();
  return input.map((stage) => ({
    name: requiredString(stage.name),
    ...(stage.color === undefined ? {} : { color: requiredString(stage.color) }),
  }));
}

function buildCustomFields(
  input: CreateItemInput['customFields'] | UpdateItemInput['customFields'],
): readonly Readonly<{ fieldId: string; value: unknown }>[] {
  if (!Array.isArray(input)) return invalidRequest();
  return input.map((field) => ({ fieldId: requiredString(field.fieldId), value: field.value }));
}

function usesToolCreateBoundary(input: CreateListInput): boolean {
  return input.stages !== undefined
    || input.isolatedList !== undefined
    || input.fieldDefinitions.some((field) => field.fieldId !== undefined);
}

function createListsClient(app: BrowserApp): ListsClient {
  return {
    capabilities: { stageMovement: false },
    async listByRoom(roomId) {
      const body: unknown = await restCall(app, 'GET', 'lists.listByRoomId', {
        query: { roomId: requiredString(roomId) },
      });
      return parseListsBody(body);
    },

    async getInfo(listId) {
      const body: unknown = await restCall(app, 'GET', 'lists.info', {
        query: { listId: requiredString(listId) },
      });
      return parseListInfoBody(body);
    },

    async queryItems(input: ItemsQuery) {
      const listId = requiredString(input.listId);
      const count = validatePageCount(input.count);
      const text = validateOptionalString(input.text);
      const updatedAtGte = validateOptionalString(input.updatedAtGte);
      const cursor = validateOptionalString(input.cursor);
      const filter = {
        ...(text === undefined ? {} : { text }),
        ...(updatedAtGte === undefined ? {} : { updatedAt: { gte: updatedAtGte } }),
      };
      const body: unknown = await restCall(app, 'POST', 'items.query', {
        body: {
          listId,
          ...(Object.keys(filter).length === 0 ? {} : { filter }),
          sort: updatedAtGte === undefined
            ? { field: 'order', direction: 1 }
            : { field: '_updatedAt', direction: -1 },
          count,
          ...(cursor === undefined ? {} : { cursor }),
        },
      });
      return parseItemsPage(body);
    },

    async listItemsBounded(listId) {
      const body: unknown = await restCall(app, 'GET', 'items.listByListId', {
        query: { listId: requiredString(listId) },
      });
      return parseBoundedItems(body);
    },

    async createList(input) {
      const roomId = requiredString(input.roomId);
      const name = requiredString(input.name);
      const description = validateOptionalString(input.description);
      const fieldDefinitions = buildFieldDefinitions(input.fieldDefinitions);
      if (usesToolCreateBoundary(input)) {
        const stages = input.stages === undefined ? undefined : buildStages(input.stages);
        const result: unknown = await app.callServerTool({
          name: 'mcpapp.lists.create',
          arguments: {
            roomId,
            name,
            ...(description === undefined ? {} : { description }),
            fieldDefinitions,
            ...(stages === undefined ? {} : { stages }),
            ...(input.isolatedList === undefined ? {} : { isolatedList: input.isolatedList }),
          },
        });
        return parseCreatedList(parseToolBody(result));
      }
      const body: unknown = await restCall(app, 'POST', 'lists.create', {
        body: {
          roomId,
          name,
          ...(description === undefined ? {} : { description }),
          fieldDefinitions,
        },
      });
      return parseCreatedList(body);
    },

    async addField(input: AddFieldInput) {
      const body: unknown = await restCall(app, 'POST', 'lists.fields.create', {
        body: {
          listId: requiredString(input.listId),
          ...(input.fieldId === undefined ? {} : { fieldId: requiredString(input.fieldId) }),
          name: requiredString(input.name),
          type: requiredString(input.type),
        },
      });
      return parseWrappedField(body);
    },

    async createItem(input: CreateItemInput) {
      const body: unknown = await restCall(app, 'POST', 'items.create', {
        body: {
          listId: requiredString(input.listId),
          name: requiredString(input.title),
          ...(input.description === undefined ? {} : { description: input.description }),
          stageId: requiredString(input.stageId),
          customFields: buildCustomFields(input.customFields),
        },
      });
      return parseWrappedItem(body);
    },

    async updateItem(input: UpdateItemInput) {
      const body: unknown = await restCall(app, 'POST', 'items.update', {
        body: {
          itemId: requiredString(input.itemId),
          name: requiredString(input.title),
          ...(input.description === undefined ? {} : { description: input.description }),
          customFields: buildCustomFields(input.customFields),
        },
      });
      return parseWrappedItem(body);
    },

    async moveItemToStage(_itemId, _stageId) {
      throw new OptionalFeatureUnavailableError('lists:write');
    },

    async deleteItem(itemId) {
      const body: unknown = await restCall(app, 'POST', 'items.delete', {
        body: { itemId: requiredString(itemId) },
      });
      const record = parseRecordBody(body);
      if (record.success !== true) return invalidResponse();
    },
  };
}

function createFilesClient(app: BrowserApp): FilesClient {
  return {
    capabilities: { folderScopedRead: false, folderScopedWrite: false },
    async listRoomFiles(roomId) {
      const encodedRoomId = encodeURIComponent(requiredString(roomId));
      const body: unknown = await restCall(app, 'GET', `file-management.files.channel/${encodedRoomId}`);
      return parseRoomFiles(body);
    },

    async listFolderFiles(_roomId, _folderId) {
      throw new OptionalFeatureUnavailableError('files:read:folder');
    },

    async readFile(fileId, fileName) {
      const encodedFileId = encodeURIComponent(requiredString(fileId));
      const encodedFileName = encodeURIComponent(requiredString(fileName));
      const body: unknown = await restCall(
        app,
        'GET',
        `file-management.files/${encodedFileId}/content/${encodedFileName}`,
      );
      return parseFileContent(body);
    },

    async upload(input: UploadInput) {
      const result: unknown = await app.uploadFile({
        channelId: requiredString(input.roomId),
        fileName: requiredString(input.fileName),
        base64Data: requiredString(input.base64Data),
        mimeType: requiredString(input.mimeType),
      });
      return parseUploadedFile(result);
    },

    async uploadToFolder(_input) {
      throw new OptionalFeatureUnavailableError('files:write:folder');
    },
  };
}

function createFoldersClient(): FoldersClient {
  return {
    capabilities: { ensurePath: false, findByPath: false },
    async ensurePath(_roomId, _segments) {
      throw new OptionalFeatureUnavailableError('files:write');
    },
    async findByPath(_roomId, _segments) {
      throw new OptionalFeatureUnavailableError('files:read');
    },
  };
}

function createSandboxClient(app: BrowserApp): SandboxClient {
  return {
    async sendAiMessage(input: AiMessageInput) {
      const roomId = requiredString(input.roomId);
      const content = requiredString(input.content);
      const sessionId = validateOptionalString(input.sessionId);
      const flowChatId = validateOptionalString(input.flowChatId) ?? roomId;
      const fileIds = input.fileIds === undefined
        ? undefined
        : input.fileIds.map(requiredString);
      const body: unknown = await restCall(app, 'POST', 'ai-messages.send', {
        body: {
          entityType: 'room-chat',
          entityId: roomId,
          roomId,
          flowChatId,
          content,
          ...(sessionId === undefined ? {} : { sessionId }),
          ...(fileIds === undefined ? {} : { fileIds }),
        },
      });
      return parseAiDispatch(body);
    },

    async listAiMessages(sessionId, count) {
      const body: unknown = await restCall(app, 'GET', 'ai-messages.list', {
        query: {
          sessionId: requiredString(sessionId),
          count: validatePageCount(count),
        },
      });
      return parseAiMessages(body);
    },
  };
}

export function createRoomClients(app: BrowserApp): RoomClients {
  return {
    lists: createListsClient(app),
    files: createFilesClient(app),
    folders: createFoldersClient(),
    sandbox: createSandboxClient(app),
  };
}

export async function getCurrentRoomContext(app: ContextApp): Promise<CurrentRoomContext> {
  const result: unknown = await app.callServerTool({
    name: 'mcpapp.context.get',
    arguments: {},
  });
  const record = parseRecordBody(parseToolBody(result));
  return {
    userId: parsedString(record, 'userId'),
    roomId: parsedString(record, 'roomId'),
    roomSlug: parsedString(record, 'roomSlug'),
    appId: parsedString(record, 'appId'),
    appUrl: parsedString(record, 'appUrl'),
  };
}
