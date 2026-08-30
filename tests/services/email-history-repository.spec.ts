import type { AuthorizedHubClient } from '../../src/platform/hub/AgentBotRoomPlatformGateway';
import { AgentBotRoomPlatformGateway } from '../../src/platform/hub/AgentBotRoomPlatformGateway';
import type { EmailHistoryStageIds } from '../../src/email-history/email-history-model';
import {
  EMAIL_HISTORY_FIELD_IDS,
  EMAIL_HISTORY_LIST_NAME,
} from '../../src/email-history/email-history-model';
import {
  EmailHistoryRepository,
  type EmailHistoryListDiscoveryCapability,
  type EmailHistoryStageLookupCapability,
  type EmailHistoryStageMovementCapability,
} from '../../src/services/EmailHistoryRepository';
import { TrackedMailService } from '../../src/services/TrackedMailService';
import { describe, expect, it } from 'vitest';

type AuthorizedFetchInit = Parameters<AuthorizedHubClient['authorizedFetch']>[1];

const stageIds: EmailHistoryStageIds = {
  interviewSent: 'stage-interview-sent',
  interviewFailed: 'stage-interview-failed',
  employeeSent: 'stage-employee-sent',
  employeeFailed: 'stage-employee-failed',
};

const storedPayload = {
  source: 'cv_scored' as const,
  recipientName: 'Candidate',
  recipientEmail: 'candidate@example.test',
  subject: 'Interview',
  htmlContent: 'mail-content',
  cvItemId: 'cv-item-1',
  cvListId: 'cv-list-1',
  jdName: 'Backend Engineer',
};

function toolResponse(result: unknown): Response {
  return new Response(JSON.stringify({
    success: true,
    content: [{ type: 'text', text: JSON.stringify(result) }],
  }), { status: 200 });
}

class ScriptedHubClient implements AuthorizedHubClient {
  readonly calls: Array<{ input: string; init: AuthorizedFetchInit }> = [];

  constructor(private readonly responses: Response[]) {}

  async authorizedFetch(input: string, init: AuthorizedFetchInit): Promise<Response> {
    this.calls.push({ input, init });
    const response = this.responses.shift();
    if (!response) throw new Error('unexpected request');
    return response;
  }
}

class FakeDiscovery implements EmailHistoryListDiscoveryCapability {
  readonly calls: Array<{ roomId: string; listName: string }> = [];
  readonly lists = new Map<string, string | undefined>();

  async findList(roomId: string, listName: string): Promise<{ listId: string } | undefined> {
    this.calls.push({ roomId, listName });
    const listId = this.lists.get(roomId);
    return listId ? { listId } : undefined;
  }
}

class FakeStageLookup implements EmailHistoryStageLookupCapability {
  readonly calls: Array<{ roomId: string; listId: string }> = [];

  async getStageIds(roomId: string, listId: string): Promise<EmailHistoryStageIds> {
    this.calls.push({ roomId, listId });
    return stageIds;
  }
}

class FakeStageMovement implements EmailHistoryStageMovementCapability {
  readonly calls: Array<{ roomId: string; itemId: string; stageId: string }> = [];
  failure: Error | undefined;

  async moveItemToStage(roomId: string, itemId: string, stageId: string): Promise<void> {
    this.calls.push({ roomId, itemId, stageId });
    if (this.failure) throw this.failure;
  }
}

function createRepository(
  responses: Response[],
  options: {
    discovery?: EmailHistoryListDiscoveryCapability;
    stageLookup?: EmailHistoryStageLookupCapability;
    stageMovement?: EmailHistoryStageMovementCapability;
  } = {},
) {
  const hubClient = new ScriptedHubClient(responses);
  const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => 'app-1');
  const repository = new EmailHistoryRepository(gateway, {
    now: () => '2026-08-30T00:00:00.000Z',
    createRecordId: () => 'record-1',
  }, options);
  return { hubClient, repository };
}

function requestBodies(client: ScriptedHubClient): unknown[] {
  return client.calls.map(call => JSON.parse(call.init.body));
}

function rawFailedItem(listId = 'list-1') {
  return {
    id: 'item-1',
    listId,
    stageId: stageIds.interviewFailed,
    customFields: [
      { fieldId: EMAIL_HISTORY_FIELD_IDS.recordId, value: 'record-1' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.source, value: 'cv_scored' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.recipientName, value: storedPayload.recipientName },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.recipientEmail, value: storedPayload.recipientEmail },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.subject, value: storedPayload.subject },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.htmlContent, value: storedPayload.htmlContent },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.cvItemId, value: storedPayload.cvItemId },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.cvListId, value: storedPayload.cvListId },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.jdName, value: storedPayload.jdName },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.createdAt, value: '2026-08-29T00:00:00.000Z' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.updatedAt, value: '2026-08-29T00:00:00.000Z' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.sentAt, value: '' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.attemptCount, value: 1 },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.lastError, value: 'provider unavailable' },
      { fieldId: EMAIL_HISTORY_FIELD_IDS.requestedBy, value: 'verified-user' },
    ],
  };
}

describe('EmailHistoryRepository store gates', () => {
  it('reuses the existing Room List discovered by the verified capability', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-existing');
    const stageLookup = new FakeStageLookup();
    const { hubClient, repository } = createRepository([], { discovery, stageLookup });

    await expect(repository.ensureStore('room-1')).resolves.toEqual({
      listId: 'list-existing',
      stageIds,
    });
    expect(discovery.calls).toEqual([{ roomId: 'room-1', listName: EMAIL_HISTORY_LIST_NAME }]);
    expect(stageLookup.calls).toEqual([{ roomId: 'room-1', listId: 'list-existing' }]);
    expect(hubClient.calls).toEqual([]);
  });

  it('creates one List with all 15 fields and four stages after verified discovery reports missing', async () => {
    const discovery = new FakeDiscovery();
    const stageLookup = new FakeStageLookup();
    const { hubClient, repository } = createRepository([
      toolResponse({ list: { id: 'list-created' } }),
    ], { discovery, stageLookup });

    await expect(repository.ensureStore('room-1')).resolves.toEqual({
      listId: 'list-created',
      stageIds,
    });
    expect(requestBodies(hubClient)).toEqual([{
      mcpAppId: 'app-1',
      roomId: 'room-1',
      toolName: 'mcpapp.lists.create',
      arguments: {
        roomId: 'room-1',
        name: 'Quản lí Email',
        description: 'Lịch sử email dùng chung của HR Mini App. Không xóa List này.',
        fieldDefinitions: [
          { _id: 'email_record_id', name: 'Mã email', type: 'TEXT' },
          { _id: 'source', name: 'Nguồn gửi', type: 'TEXT' },
          { _id: 'recipient_name', name: 'Tên người nhận', type: 'TEXT' },
          { _id: 'recipient_email', name: 'Email người nhận', type: 'TEXT' },
          { _id: 'subject', name: 'Tiêu đề', type: 'TEXT' },
          { _id: 'html_content', name: 'Nội dung HTML', type: 'TEXT' },
          { _id: 'cv_item_id', name: 'CV item ID', type: 'TEXT' },
          { _id: 'cv_list_id', name: 'CV list ID', type: 'TEXT' },
          { _id: 'jd_name', name: 'Tên JD', type: 'TEXT' },
          { _id: 'created_at', name: 'Thời gian tạo', type: 'TEXT' },
          { _id: 'updated_at', name: 'Cập nhật gần nhất', type: 'TEXT' },
          { _id: 'sent_at', name: 'Thời gian gửi', type: 'TEXT' },
          { _id: 'attempt_count', name: 'Số lần gửi', type: 'NUMBER' },
          { _id: 'last_error', name: 'Lỗi gần nhất', type: 'TEXT' },
          { _id: 'requested_by', name: 'Người gửi', type: 'TEXT' },
        ],
        stages: [
          { name: 'Email Phỏng vấn - Đã gửi', color: '#16a34a' },
          { name: 'Email Phỏng vấn - Gửi lỗi', color: '#dc2626' },
          { name: 'Email Nhân sự - Đã gửi', color: '#16a34a' },
          { name: 'Email Nhân sự - Gửi lỗi', color: '#dc2626' },
        ],
      },
    }]);
    expect(stageLookup.calls).toEqual([{ roomId: 'room-1', listId: 'list-created' }]);
  });

  it('fails before writes when discovery or stage lookup is unavailable', async () => {
    const withoutDiscovery = createRepository([]);
    await expect(withoutDiscovery.repository.ensureStore('room-1')).rejects.toThrow(
      'Email history List discovery is not available',
    );
    expect(withoutDiscovery.hubClient.calls).toEqual([]);

    const withoutStages = createRepository([], { discovery: new FakeDiscovery() });
    await expect(withoutStages.repository.ensureStore('room-1')).rejects.toThrow(
      'Email history stage lookup is not available',
    );
    expect(withoutStages.hubClient.calls).toEqual([]);
  });

  it('does not create a duplicate List from a malformed discovery result', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', '   ');
    const { hubClient, repository } = createRepository([], {
      discovery,
      stageLookup: new FakeStageLookup(),
    });

    await expect(repository.ensureStore('room-1')).rejects.toThrow(
      'Email history List discovery returned an invalid List id',
    );
    expect(hubClient.calls).toEqual([]);
  });

  it('rejects retry before store creation and delivery when stage movement is unavailable', async () => {
    const discovery = new FakeDiscovery();
    let deliveryCalls = 0;
    const { hubClient, repository } = createRepository([
      toolResponse({ list: { id: 'list-created' } }),
    ], { discovery, stageLookup: new FakeStageLookup() });
    const service = new TrackedMailService(repository, {
      async queueMail() {
        deliveryCalls += 1;
      },
    });

    await expect(service.retry('room-1', 'item-1')).rejects.toThrow(
      'Email history stage movement is not available',
    );
    expect(hubClient.calls).toEqual([]);
    expect(deliveryCalls).toBe(0);
  });

  it('never reuses Room A cached store for Room B', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-a', 'list-a');
    discovery.lists.set('room-b', 'list-b');
    const stageLookup = new FakeStageLookup();
    const { repository } = createRepository([], { discovery, stageLookup });

    await expect(repository.ensureStore('room-a')).resolves.toMatchObject({ listId: 'list-a' });
    await expect(repository.ensureStore('room-b')).resolves.toMatchObject({ listId: 'list-b' });
    expect(discovery.calls.map(call => call.roomId)).toEqual(['room-a', 'room-b']);
  });
});

describe('EmailHistoryRepository persistence requests', () => {
  it('creates a history item with the exact ordered 15 custom field values', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-1');
    const { hubClient, repository } = createRepository([
      toolResponse({ item: { id: 'item-1' } }),
    ], { discovery, stageLookup: new FakeStageLookup() });

    await expect(repository.createResult(
      'room-1',
      storedPayload,
      'sent',
      undefined,
      'verified-user',
    )).resolves.toMatchObject({ id: 'item-1', status: 'sent' });

    expect(requestBodies(hubClient)).toEqual([{
      mcpAppId: 'app-1',
      toolName: 'mcpapp.lists.createItem',
      roomId: 'room-1',
      arguments: {
        listId: 'list-1',
        title: 'Interview',
        stageId: 'stage-interview-sent',
        customFields: [
          { fieldId: 'email_record_id', value: 'record-1' },
          { fieldId: 'source', value: 'cv_scored' },
          { fieldId: 'recipient_name', value: 'Candidate' },
          { fieldId: 'recipient_email', value: 'candidate@example.test' },
          { fieldId: 'subject', value: 'Interview' },
          { fieldId: 'html_content', value: 'mail-content' },
          { fieldId: 'cv_item_id', value: 'cv-item-1' },
          { fieldId: 'cv_list_id', value: 'cv-list-1' },
          { fieldId: 'jd_name', value: 'Backend Engineer' },
          { fieldId: 'created_at', value: '2026-08-30T00:00:00.000Z' },
          { fieldId: 'updated_at', value: '2026-08-30T00:00:00.000Z' },
          { fieldId: 'sent_at', value: '2026-08-30T00:00:00.000Z' },
          { fieldId: 'attempt_count', value: 1 },
          { fieldId: 'last_error', value: '' },
          { fieldId: 'requested_by', value: 'verified-user' },
        ],
      },
    }]);
  });

  it('requires the server item id before reporting create success', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-1');
    const { repository } = createRepository([
      toolResponse({ item: { listId: 'list-1' } }),
    ], { discovery, stageLookup: new FakeStageLookup() });

    await expect(repository.createResult('room-1', storedPayload, 'sent')).rejects.toThrow(
      'Không lấy được item ID sau khi tạo lịch sử email.',
    );
  });

  it('rejects a stage-movement failure and never reports the retry transition', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-1');
    const movement = new FakeStageMovement();
    movement.failure = new Error('move unavailable');
    const item = rawFailedItem();
    const { hubClient, repository } = createRepository([
      toolResponse({ items: [item] }),
      toolResponse({ items: [item] }),
    ], { discovery, stageLookup: new FakeStageLookup(), stageMovement: movement });

    await expect(repository.markSent('room-1', 'item-1')).rejects.toThrow('move unavailable');
    expect(movement.calls).toEqual([{
      roomId: 'room-1',
      itemId: 'item-1',
      stageId: stageIds.interviewSent,
    }]);
    expect(requestBodies(hubClient)).toHaveLength(2);
  });

  it('rejects a documented per-field update failure without rewriting the immutable record id', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-1');
    const item = rawFailedItem();
    const { hubClient, repository } = createRepository([
      toolResponse({ items: [item] }),
      toolResponse({ items: [item] }),
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    ], {
      discovery,
      stageLookup: new FakeStageLookup(),
      stageMovement: new FakeStageMovement(),
    });

    await expect(repository.markSent('room-1', 'item-1')).rejects.toThrow(
      'mcpapp.lists.updateCustomField',
    );
    const updateCalls = requestBodies(hubClient).slice(2);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        arguments: expect.objectContaining({ fieldId: EMAIL_HISTORY_FIELD_IDS.recordId }),
      }),
    ]));
  });

  it('rejects an item whose returned list id is outside the Room-scoped store', async () => {
    const discovery = new FakeDiscovery();
    discovery.lists.set('room-1', 'list-1');
    const { repository } = createRepository([
      toolResponse({ items: [rawFailedItem('list-other')] }),
    ], { discovery, stageLookup: new FakeStageLookup() });

    await expect(repository.getRecord('room-1', 'item-1')).rejects.toThrow(
      'Không tìm thấy email trong Room hiện tại.',
    );
  });
});
