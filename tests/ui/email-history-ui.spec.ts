import { describe, expect, it } from 'vitest';

import { EMAIL_HISTORY_LIST_NAME, EMAIL_HISTORY_STAGES } from '../../src/email-history/email-history-model';
import { EmailHistoryService } from '../../src/ui/email-history/email-history-service';
import type { ListsClient } from '../../src/ui/platform/contracts';

function listClient(options: Readonly<{ rejectRead?: boolean }> = {}): ListsClient {
  return {
    capabilities: { stageMovement: false },
    async listByRoom() {
      if (options.rejectRead) throw new Error('permission denied');
      return [{ _id: 'mail-list', name: EMAIL_HISTORY_LIST_NAME }];
    },
    async getInfo() {
      return {
        list: { _id: 'mail-list', name: EMAIL_HISTORY_LIST_NAME },
        stages: Object.values(EMAIL_HISTORY_STAGES).map((name, index) => ({ _id: `stage-${index}`, name })),
      };
    },
    async queryItems() { return { items: [], nextCursor: null }; },
    async listItemsBounded() { return { items: [], truncated: false }; },
    async createList() { throw new Error('not used'); },
    async addField() { throw new Error('not used'); },
    async createItem() { throw new Error('not used'); },
    async updateItem() { throw new Error('not used'); },
    async moveItemToStage() { throw new Error('not used'); },
    async deleteItem() {},
  };
}

describe('email history UI service', () => {
  it('propagates Lists permission denial instead of returning an empty successful mailbox', async () => {
    const service = new EmailHistoryService(listClient({ rejectRead: true }), { async retry() {} });
    await expect(service.load('room-1')).rejects.toThrow('permission denied');
  });

  it('keeps hrm.mail.retry behind an injected app-owned mail boundary', async () => {
    const calls: unknown[] = [];
    const service = new EmailHistoryService(listClient(), {
      async retry(input) { calls.push(input); },
    });

    await service.retry('room-1', 'mail-item-1');
    expect(calls).toEqual([{ roomId: 'room-1', itemId: 'mail-item-1' }]);
  });
});
