import { describe, expect, it } from 'vitest';
import type { McpApp } from '@privos_ai/app-react';

import { OptionalFeatureUnavailableError } from '../../src/ui/privos-rest';
import {
  createRoomClients,
  getCurrentRoomContext,
} from '../../src/ui/platform/create-room-clients';
import type { CreateListInput } from '../../src/ui/platform/contracts';

type BrowserApp = Pick<McpApp, 'rest' | 'uploadFile' | 'callServerTool'>;
type RestRequest = Parameters<BrowserApp['rest']>[0];
type UploadRequest = Parameters<BrowserApp['uploadFile']>[0];
type ToolRequest = Parameters<BrowserApp['callServerTool']>[0];

interface RecordingApp {
  readonly app: BrowserApp;
  readonly restCalls: RestRequest[];
  readonly uploadCalls: UploadRequest[];
  readonly toolCalls: ToolRequest[];
}

function toolResult(result: unknown): unknown {
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}

function recordingApp(options: Readonly<{
  restBodies?: readonly unknown[];
  uploadResults?: readonly unknown[];
  toolResults?: readonly unknown[];
}> = {}): RecordingApp {
  const restCalls: RestRequest[] = [];
  const uploadCalls: UploadRequest[] = [];
  const toolCalls: ToolRequest[] = [];
  const restBodies = [...(options.restBodies ?? [])];
  const uploadResults = [...(options.uploadResults ?? [])];
  const toolResults = [...(options.toolResults ?? [])];
  const app: BrowserApp = {
    async rest(request) {
      restCalls.push(request);
      return { statusCode: 200, body: restBodies.shift() };
    },
    async uploadFile(request) {
      uploadCalls.push(request);
      return uploadResults.shift();
    },
    async callServerTool(request) {
      toolCalls.push(request);
      return toolResults.shift();
    },
  };
  return { app, restCalls, uploadCalls, toolCalls };
}

describe('documented browser Room client mappings', () => {
  it('gets current-user context through the exact documented server-tool call', async () => {
    const recorder = recordingApp({
      toolResults: [toolResult({
        userId: 'user-1',
        roomId: 'room-1',
        roomSlug: 'hr-room',
        appId: 'hr-app',
        appUrl: '/room/hr-room/app/hr-app',
      })],
    });

    await expect(getCurrentRoomContext(recorder.app)).resolves.toEqual({
      userId: 'user-1',
      roomId: 'room-1',
      roomSlug: 'hr-room',
      appId: 'hr-app',
      appUrl: '/room/hr-room/app/hr-app',
    });
    expect(recorder.toolCalls).toEqual([{
      name: 'mcpapp.context.get',
      arguments: {},
    }]);
    expect(recorder.restCalls).toEqual([]);
  });

  it('maps list reads, cursor query, and bounded fallback to exact REST requests', async () => {
    const recorder = recordingApp({ restBodies: [
      { success: true, lists: [{ _id: 'list-1', name: 'Employees' }] },
      { success: true, list: { _id: 'list-1', name: 'Employees' }, stages: [{ _id: 'stage-1', name: 'New' }] },
      { success: true, items: [{ _id: 'item-1', name: 'Alice' }], nextCursor: 'cursor-2' },
      { success: true, items: [{ _id: 'item-2', name: 'Bob' }], truncated: true },
    ] });
    const clients = createRoomClients(recorder.app);

    await expect(clients.lists.listByRoom('room / one')).resolves.toEqual([
      { _id: 'list-1', name: 'Employees' },
    ]);
    await expect(clients.lists.getInfo('list-1')).resolves.toEqual({
      list: { _id: 'list-1', name: 'Employees' },
      stages: [{ _id: 'stage-1', name: 'New' }],
    });
    await expect(clients.lists.queryItems({
      listId: 'list-1',
      text: 'alice',
      updatedAtGte: '2026-08-29T00:00:00.000Z',
      cursor: 'cursor-1',
      count: 20,
    })).resolves.toEqual({
      items: [{ _id: 'item-1', name: 'Alice' }],
      nextCursor: 'cursor-2',
    });
    await expect(clients.lists.listItemsBounded('list-1')).resolves.toEqual({
      items: [{ _id: 'item-2', name: 'Bob' }],
      truncated: true,
    });

    expect(recorder.restCalls).toEqual([
      { method: 'GET', path: 'lists.listByRoomId', query: { roomId: 'room / one' } },
      { method: 'GET', path: 'lists.info', query: { listId: 'list-1' } },
      {
        method: 'POST',
        path: 'items.query',
        body: {
          listId: 'list-1',
          filter: { text: 'alice', updatedAt: { gte: '2026-08-29T00:00:00.000Z' } },
          sort: { field: '_updatedAt', direction: -1 },
          count: 20,
          cursor: 'cursor-1',
        },
      },
      { method: 'GET', path: 'items.listByListId', query: { listId: 'list-1' } },
    ]);
  });

  it('treats an omitted bounded-fallback truncated flag as false', async () => {
    const recorder = recordingApp({
      restBodies: [{ success: true, items: [{ _id: 'item-1', name: 'Alice' }] }],
    });

    await expect(createRoomClients(recorder.app).lists.listItemsBounded('list-1')).resolves.toEqual({
      items: [{ _id: 'item-1', name: 'Alice' }],
      truncated: false,
    });
    expect(recorder.restCalls).toEqual([{
      method: 'GET',
      path: 'items.listByListId',
      query: { listId: 'list-1' },
    }]);
  });

  it('uses the REST create-list boundary when no explicit tool-only property is present', async () => {
    const recorder = recordingApp({ restBodies: [{
      success: true,
      list: { _id: 'list-1', name: 'Employees' },
      defaultStage: { _id: 'stage-1', name: 'New' },
    }] });
    const clients = createRoomClients(recorder.app);

    await expect(clients.lists.createList({
      roomId: 'room-1',
      name: 'Employees',
      description: 'People',
      fieldDefinitions: [{ name: 'Email', type: 'TEXT' }],
    })).resolves.toEqual({
      list: { _id: 'list-1', name: 'Employees' },
      defaultStage: { _id: 'stage-1', name: 'New' },
      stages: [{ _id: 'stage-1', name: 'New' }],
    });
    expect(recorder.restCalls).toEqual([{
      method: 'POST',
      path: 'lists.create',
      body: {
        roomId: 'room-1',
        name: 'Employees',
        description: 'People',
        fieldDefinitions: [{ name: 'Email', type: 'TEXT' }],
      },
    }]);
    expect(recorder.toolCalls).toEqual([]);
  });

  it.each<Readonly<{ label: string; input: CreateListInput }>>([
    {
      label: 'explicit stages',
      input: {
        roomId: 'room-1', name: 'Employees', fieldDefinitions: [],
        stages: [{ name: 'New', color: '#fff' }],
      },
    },
    {
      label: 'explicit field id',
      input: {
        roomId: 'room-1', name: 'Employees',
        fieldDefinitions: [{ fieldId: 'email', name: 'Email', type: 'TEXT' }],
      },
    },
    {
      label: 'explicit isolated-list setting',
      input: {
        roomId: 'room-1', name: 'Employees', fieldDefinitions: [], isolatedList: false,
      },
    },
  ])('uses mcpapp.lists.create for $label without duplicating identifiers', async ({ input }) => {
    const recorder = recordingApp({
      toolResults: [toolResult({
        list: { _id: 'list-1', name: 'Employees' },
        defaultStage: { _id: 'stage-1', name: 'New' },
        stages: [{ _id: 'stage-1', name: 'New' }],
      })],
    });

    await createRoomClients(recorder.app).lists.createList(input);

    expect(recorder.toolCalls).toEqual([{
      name: 'mcpapp.lists.create',
      arguments: {
        roomId: input.roomId,
        name: input.name,
        fieldDefinitions: input.fieldDefinitions,
        ...(input.stages !== undefined ? { stages: input.stages } : {}),
        ...(input.isolatedList !== undefined ? { isolatedList: input.isolatedList } : {}),
      },
    }]);
    expect(JSON.stringify(recorder.toolCalls[0])).not.toContain('"_id"');
    expect(recorder.restCalls).toEqual([]);
  });

  it('maps add/create/update/delete item writes to exact REST routes and names', async () => {
    const recorder = recordingApp({ restBodies: [
      { success: true, field: { _id: 'field-1', name: 'Email', type: 'TEXT' } },
      { success: true, item: { _id: 'item-1', name: 'Alice', stageId: 'stage-1' } },
      { success: true, item: { _id: 'item-1', name: 'Alice B' } },
      { success: true },
    ] });
    const clients = createRoomClients(recorder.app);

    await expect(clients.lists.addField({
      listId: 'list-1', fieldId: 'email', name: 'Email', type: 'TEXT',
    })).resolves.toEqual({ _id: 'field-1', name: 'Email', type: 'TEXT' });
    await expect(clients.lists.createItem({
      listId: 'list-1', title: 'Alice', description: 'Profile', stageId: 'stage-1',
      customFields: [{ fieldId: 'email', value: 'alice@example.test' }],
    })).resolves.toEqual({ _id: 'item-1', name: 'Alice', stageId: 'stage-1' });
    await expect(clients.lists.updateItem({
      itemId: 'item-1', title: 'Alice B', description: 'Updated',
      customFields: [{ fieldId: 'email', value: 'alice.b@example.test' }],
    })).resolves.toEqual({ _id: 'item-1', name: 'Alice B' });
    await expect(clients.lists.deleteItem('item-1')).resolves.toBeUndefined();

    expect(recorder.restCalls).toEqual([
      {
        method: 'POST', path: 'lists.fields.create',
        body: { listId: 'list-1', fieldId: 'email', name: 'Email', type: 'TEXT' },
      },
      {
        method: 'POST', path: 'items.create',
        body: {
          listId: 'list-1', name: 'Alice', description: 'Profile', stageId: 'stage-1',
          customFields: [{ fieldId: 'email', value: 'alice@example.test' }],
        },
      },
      {
        method: 'POST', path: 'items.update',
        body: {
          itemId: 'item-1', name: 'Alice B', description: 'Updated',
          customFields: [{ fieldId: 'email', value: 'alice.b@example.test' }],
        },
      },
      { method: 'POST', path: 'items.delete', body: { itemId: 'item-1' } },
    ]);
  });

  it('maps file list/read/upload with encoded path segments and the exact upload shape', async () => {
    const recorder = recordingApp({
      restBodies: [
        { success: true, files: [{ _id: 'file/1', name: 'cv one.md', size: 12, mimeType: 'text/markdown' }] },
        { success: true, result: '# Profile' },
      ],
      uploadResults: [{ file: { _id: 'file-2', name: 'id.png', size: 42, mimeType: 'image/png' } }],
    });
    const clients = createRoomClients(recorder.app);

    await expect(clients.files.listRoomFiles('room / one')).resolves.toEqual([
      { _id: 'file/1', name: 'cv one.md', size: 12, mimeType: 'text/markdown' },
    ]);
    await expect(clients.files.readFile('file/1', 'cv one.md')).resolves.toBe('# Profile');
    await expect(clients.files.upload({
      roomId: 'room-1', fileName: 'id.png', base64Data: 'data:image/png;base64,AA==', mimeType: 'image/png',
    })).resolves.toEqual({ _id: 'file-2', name: 'id.png', size: 42, mimeType: 'image/png' });

    expect(recorder.restCalls).toEqual([
      { method: 'GET', path: 'file-management.files.channel/room%20%2F%20one' },
      { method: 'GET', path: 'file-management.files/file%2F1/content/cv%20one.md' },
    ]);
    expect(recorder.uploadCalls).toEqual([{
      channelId: 'room-1',
      fileName: 'id.png',
      base64Data: 'data:image/png;base64,AA==',
      mimeType: 'image/png',
    }]);
  });

  it('maps AI send/poll to exact bounded current-user REST requests', async () => {
    const recorder = recordingApp({ restBodies: [
      { success: true, sessionId: 'session-1', aiMessage: { _id: 'message-1' } },
      { success: true, messages: [{ _id: 'message-1', status: 'completed', content: 'Done' }] },
    ] });
    const clients = createRoomClients(recorder.app);

    await expect(clients.sandbox.sendAiMessage({
      roomId: 'room-1', content: 'Score these CVs', sessionId: 'session-0', fileIds: ['file-1', 'file-2'],
    })).resolves.toEqual({ sessionId: 'session-1', aiMessageId: 'message-1' });
    await expect(clients.sandbox.listAiMessages('session-1', 10)).resolves.toEqual([
      { _id: 'message-1', status: 'completed', content: 'Done' },
    ]);

    expect(recorder.restCalls).toEqual([
      {
        method: 'POST', path: 'ai-messages.send',
        body: {
          entityType: 'room-chat', entityId: 'room-1', roomId: 'room-1', flowChatId: 'room-1',
          content: 'Score these CVs', sessionId: 'session-0', fileIds: ['file-1', 'file-2'],
        },
      },
      { method: 'GET', path: 'ai-messages.list', query: { sessionId: 'session-1', count: 10 } },
    ]);
  });
});

describe('closed and strict browser Room client behavior', () => {
  it('fails unsupported folders and stage movement before making a request', async () => {
    const recorder = recordingApp();
    const clients = createRoomClients(recorder.app);

    await expect(clients.folders.ensurePath('room-1', ['hr-miniapp'])).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    await expect(clients.folders.findByPath('room-1', ['hr-miniapp'])).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    await expect(clients.lists.moveItemToStage('item-1', 'stage-1')).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    expect(clients.files.capabilities).toEqual({ folderScopedRead: false, folderScopedWrite: false });
    expect(clients.folders.capabilities).toEqual({ ensurePath: false, findByPath: false });
    expect(clients.lists.capabilities).toEqual({ stageMovement: false });
    await expect(clients.files.listFolderFiles('room-1', 'folder-1')).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    await expect(clients.files.uploadToFolder({
      roomId: 'room-1', folderId: 'folder-1', fileName: 'jd.md',
      base64Data: 'data:text/markdown;base64,IyBKRA==', mimeType: 'text/markdown',
    })).rejects.toBeInstanceOf(OptionalFeatureUnavailableError);
    expect(recorder.restCalls).toEqual([]);
    expect(recorder.uploadCalls).toEqual([]);
    expect(recorder.toolCalls).toEqual([]);
  });

  it('rejects invalid count and cursor before making a request', async () => {
    const recorder = recordingApp();
    const clients = createRoomClients(recorder.app);

    await expect(clients.lists.queryItems({ listId: 'list-1', count: 0 })).rejects.toThrow(
      'Room client request is invalid.',
    );
    await expect(clients.lists.queryItems({ listId: 'list-1', count: 20, cursor: '   ' })).rejects.toThrow(
      'Room client request is invalid.',
    );
    await expect(clients.sandbox.listAiMessages('session-1', -1)).rejects.toThrow(
      'Room client request is invalid.',
    );
    expect(recorder.restCalls).toEqual([]);
  });

  it.each([
    ['room lists', { success: true, lists: [{ _id: 'list-1' }] }, 'listByRoom'],
    ['list info', { success: true, list: { _id: 'list-1', name: 'Employees' }, stages: [{}] }, 'getInfo'],
    ['query page', { success: true, items: [], nextCursor: 42 }, 'queryItems'],
    ['bounded list', { success: true, items: [], truncated: 'yes' }, 'listItemsBounded'],
  ] as const)('rejects a malformed %s response instead of returning response details', async (_label, body, operation) => {
    const recorder = recordingApp({ restBodies: [body] });
    const clients = createRoomClients(recorder.app);
    const invoke = operation === 'listByRoom'
      ? clients.lists.listByRoom('room-1')
      : operation === 'getInfo'
        ? clients.lists.getInfo('list-1')
        : operation === 'queryItems'
          ? clients.lists.queryItems({ listId: 'list-1', count: 20 })
          : clients.lists.listItemsBounded('list-1');

    await expect(invoke).rejects.toThrow('The Room operation returned an invalid response.');
  });

  it('rejects malformed mutation, upload, content, context, and AI responses with stable text', async () => {
    const recorder = recordingApp({
      restBodies: [
        { success: true, field: { _id: 'field-1', name: 'Email' } },
        { success: true, result: { private: 'content' } },
        { success: true, sessionId: '', aiMessage: {} },
      ],
      uploadResults: [{ file: { name: 'missing-id.png' } }],
      toolResults: [toolResult({ userId: 'user-1', roomId: 'room-1', roomSlug: 'hr-room', appId: 'hr-app', appUrl: 42 })],
    });
    const clients = createRoomClients(recorder.app);

    await expect(clients.lists.addField({ listId: 'list-1', name: 'Email', type: 'TEXT' })).rejects.toThrow(
      'The Room operation returned an invalid response.',
    );
    await expect(clients.files.upload({
      roomId: 'room-1', fileName: 'id.png', base64Data: 'AA==', mimeType: 'image/png',
    })).rejects.toThrow('The Room operation returned an invalid response.');
    await expect(clients.files.readFile('file-1', 'private.md')).rejects.toThrow(
      'The Room operation returned an invalid response.',
    );
    await expect(clients.sandbox.sendAiMessage({ roomId: 'room-1', content: 'Hello' })).rejects.toThrow(
      'The Room operation returned an invalid response.',
    );
    await expect(getCurrentRoomContext(recorder.app)).rejects.toThrow(
      'The Room operation returned an invalid response.',
    );
  });
});
