import { afterEach, describe, expect, it, vi } from 'vitest';

import { PipelineService, type KanbanBatchResult } from '../../src/ui/pipeline-service';
import { createRoomClients } from '../../src/ui/platform/create-room-clients';
import type {
  AiMessageInput,
  FilesClient,
  FoldersClient,
  ListsClient,
  SandboxClient,
} from '../../src/ui/platform/contracts';
import type { McpApp } from '@privos_ai/app-react';

function inertFiles(): FilesClient {
  return {
    capabilities: { folderScopedRead: true, folderScopedWrite: true },
    async listRoomFiles() { return []; },
    async listFolderFiles() { return []; },
    async readFile() { return ''; },
    async upload(input) { return { _id: 'file-1', name: input.fileName }; },
    async uploadToFolder(input) { return { _id: 'file-1', name: input.fileName }; },
  };
}

function verifiedFolders(): FoldersClient {
  return {
    capabilities: { ensurePath: true, findByPath: true },
    async ensurePath(_roomId, segments) { return { _id: `folder-${segments.length}`, name: segments[segments.length - 1] ?? '' }; },
    async findByPath(_roomId, segments) { return { _id: `folder-${segments.length}`, name: segments[segments.length - 1] ?? '' }; },
  };
}

function recordingLists(active: { current: number; maximum: number }, rejectedIndex?: number): ListsClient {
  let itemIndex = 0;
  return {
    capabilities: { stageMovement: true },
    async listByRoom() { return []; },
    async getInfo() { return { list: { _id: 'list-1', name: 'Screening' }, stages: [] }; },
    async queryItems() { return { items: [], nextCursor: null }; },
    async listItemsBounded() { return { items: [], truncated: false }; },
    async createList(input) {
      return {
        list: { _id: 'list-1', name: input.name, fieldDefinitions: input.fieldDefinitions.map((field, index) => ({ _id: field.fieldId ?? `field-${index}`, name: field.name, type: field.type })) },
        stages: (input.stages ?? []).map((stage, index) => ({ _id: `stage-${index + 1}`, name: stage.name })),
      };
    },
    async addField(input) { return { _id: input.fieldId ?? 'field-1', name: input.name, type: input.type }; },
    async createItem(input) {
      if (input.title.includes('[Hệ thống]')) {
        return { _id: 'system-item', name: input.title, stageId: input.stageId };
      }
      const index = itemIndex++;
      active.current += 1;
      active.maximum = Math.max(active.maximum, active.current);
      await new Promise(resolve => setTimeout(resolve, 5));
      active.current -= 1;
      if (index === rejectedIndex) throw new Error('item rejected');
      return { _id: `item-${index}`, name: input.title, stageId: input.stageId, customFields: input.customFields };
    },
    async updateItem(input) { return { _id: input.itemId, name: input.title, customFields: input.customFields }; },
    async moveItemToStage(itemId, stageId) { return { _id: itemId, name: itemId, stageId }; },
    async deleteItem() {},
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PipelineService Room client adapter', () => {
  it('preflight-disables production AI generation before ai-messages.send', async () => {
    const calls: string[] = [];
    const app: Pick<McpApp, 'rest' | 'uploadFile' | 'callServerTool'> = {
      async rest(request) { calls.push(`rest:${request.path}`); return { statusCode: 200, body: {} }; },
      async uploadFile() { calls.push('upload'); return {}; },
      async callServerTool(request) { calls.push(`tool:${request.name}`); return {}; },
    };
    const clients = createRoomClients(app);
    const service = new PipelineService('room-1', clients.lists, clients.files, clients.folders, clients.sandbox);

    await expect(service.askAI('score')).rejects.toThrow('generation');
    expect(calls).toEqual([]);
  });

  it('uses verified AI send/start/list capability and completes by status with 3-second polling', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const sandbox: SandboxClient & { startGeneration(messageId: string): Promise<void> } = {
      async sendAiMessage(input: AiMessageInput) {
        calls.push(`send:${input.roomId}:${input.flowChatId ?? ''}`);
        return { sessionId: 'session-1', aiMessageId: 'message-1' };
      },
      async startGeneration(messageId) { calls.push(`start:${messageId}`); },
      async listAiMessages(sessionId) {
        calls.push(`list:${sessionId}`);
        return [{ _id: 'message-1', status: 'completed', content: 'done' }];
      },
    };
    const active = { current: 0, maximum: 0 };
    const service = new PipelineService('room-1', recordingLists(active), inertFiles(), verifiedFolders(), sandbox);

    const pending = service.askAI('score', undefined, undefined, undefined, 'flow-1');
    await vi.advanceTimersByTimeAsync(3000);

    await expect(pending).resolves.toEqual({ text: 'done' });
    expect(calls).toEqual(['send:room-1:flow-1', 'start:message-1', 'list:session-1']);
  });

  it('correlates polling to the dispatched AI message instead of accepting a stale completion', async () => {
    vi.useFakeTimers();
    let pollCount = 0;
    const sandbox: SandboxClient & { startGeneration(messageId: string): Promise<void> } = {
      async sendAiMessage() { return { sessionId: 'session-1', aiMessageId: 'message-current' }; },
      async startGeneration() {},
      async listAiMessages() {
        pollCount += 1;
        return pollCount === 1
          ? [
              { _id: 'message-stale', status: 'completed', content: 'stale' },
              { _id: 'message-current', status: 'pending' },
            ]
          : [
              { _id: 'message-stale', status: 'completed', content: 'stale' },
              { _id: 'message-current', status: 'completed', content: 'current' },
            ];
      },
    };
    const active = { current: 0, maximum: 0 };
    const service = new PipelineService('room-1', recordingLists(active), inertFiles(), verifiedFolders(), sandbox);

    const pending = service.askAI('score');
    await vi.advanceTimersByTimeAsync(6000);

    await expect(pending).resolves.toEqual({ text: 'current' });
    expect(pollCount).toBe(2);
  });

  it.each(['failed', 'cancelled'])('does not treat %s as a successful bot reply', async (status) => {
    vi.useFakeTimers();
    const active = { current: 0, maximum: 0 };
    const service = new PipelineService('room-1', recordingLists(active), inertFiles(), verifiedFolders(), {
      async sendAiMessage() { return { sessionId: 'session-1' }; },
      async listAiMessages() { return [{ _id: 'message-current', status }]; },
    });

    const pending = service.waitForBotReply('session-1', 'message-current');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBe(false);
  });

  it('uses verified folder identity for CV/JD reads and uploads without Room-wide fallback', async () => {
    class DataUriFileReader {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(): void {
        this.result = 'data:application/pdf;base64,Y3Y=';
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', DataUriFileReader);
    const calls: string[] = [];
    const files = {
      capabilities: { folderScopedRead: true, folderScopedWrite: true },
      async listRoomFiles() { calls.push('room-list'); return [{ _id: 'unrelated', name: 'unrelated.md' }]; },
      async listFolderFiles(_roomId: string, folderId: string) {
        calls.push(`folder-list:${folderId}`);
        return folderId === 'folder-jds' ? [{ _id: 'jd-1', name: 'JD_Backend.md' }] : [];
      },
      async readFile(fileId: string) { calls.push(`read:${fileId}`); return '# JD'; },
      async upload(input: { fileName: string }) { calls.push(`room-upload:${input.fileName}`); return { _id: 'root', name: input.fileName }; },
      async uploadToFolder(input: { folderId: string; fileName: string }) {
        calls.push(`folder-upload:${input.folderId}:${input.fileName}`);
        return { _id: 'uploaded', name: input.fileName };
      },
    };
    const folders = {
      capabilities: { ensurePath: true, findByPath: true },
      async ensurePath(_roomId: string, segments: readonly string[]) {
        const leaf = segments[segments.length - 1];
        const id = leaf === 'raws-cv' ? 'folder-raws' : 'folder-jds';
        calls.push(`ensure:${segments.join('/')}`);
        return { _id: id, name: leaf ?? '' };
      },
      async findByPath(_roomId: string, segments: readonly string[]) {
        const leaf = segments[segments.length - 1];
        const id = leaf === 'raws-cv' ? 'folder-raws' : 'folder-jds';
        calls.push(`find:${segments.join('/')}`);
        return { _id: id, name: leaf ?? '' };
      },
    };
    const active = { current: 0, maximum: 0 };
    const service = new PipelineService('room-1', recordingLists(active), files, folders, {
      async sendAiMessage() { return { sessionId: 'session-1' }; },
      async listAiMessages() { return []; },
    });

    await expect(service.fetchAvailableJDs()).resolves.toEqual([{ _id: 'jd-1', name: 'JD_Backend.md' }]);
    await service.uploadCV(new File(['cv'], 'candidate.pdf', { type: 'application/pdf' }));

    expect(calls).toEqual([
      'find:hr-miniapp/jds',
      'folder-list:folder-jds',
      'ensure:hr-miniapp/raws-cv',
      'folder-list:folder-raws',
      'folder-upload:folder-raws:candidate.pdf',
    ]);
  });

  it('falls back to createItem at concurrency four and reports deterministic success/failure operation ids', async () => {
    vi.useFakeTimers();
    const active = { current: 0, maximum: 0 };
    const service = new PipelineService(
      'room-1', recordingLists(active, 2), inertFiles(), verifiedFolders(), {
        async sendAiMessage() { return { sessionId: 'session-1' }; },
        async listAiMessages() { return []; },
      },
    );
    const pending = service.createKanbanBatchViaAI(
      Array.from({ length: 6 }, (_, index) => ({
        fileId: `source-${index}`,
        originalName: `candidate-${index}.pdf`,
        score: 80,
        category: 'Äáº T',
      })),
      'JD_Backend.md',
    );
    await vi.runAllTimersAsync();
    const result: KanbanBatchResult = await pending;

    expect(active.maximum).toBe(4);
    expect(result.succeededOperationIds).toEqual([
      'room-1:source-0:list-1:0',
      'room-1:source-1:list-1:1',
      'room-1:source-3:list-1:3',
      'room-1:source-4:list-1:4',
      'room-1:source-5:list-1:5',
    ]);
    expect(result.failedOperationIds).toEqual(['room-1:source-2:list-1:2']);
  });
});
