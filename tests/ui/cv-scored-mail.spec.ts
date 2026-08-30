import { describe, expect, it, vi } from 'vitest';

import { sendScoredCvInvitation } from '../../src/ui/cv-scored/CVScoredTab';
import type { ListsClient } from '../../src/ui/platform/contracts';
import { OptionalFeatureUnavailableError } from '../../src/ui/privos-rest';

function lists(options: Readonly<{ stageAvailable?: boolean; moveRejects?: boolean; operations?: string[] }> = {}): ListsClient {
  const operations = options.operations ?? [];
  return {
    capabilities: { stageMovement: options.stageAvailable ?? true },
    async listByRoom() { return []; },
    async getInfo() { return { list: { _id: 'list-1', name: 'Screening' }, stages: [] }; },
    async queryItems() { return { items: [], nextCursor: null }; },
    async listItemsBounded() { return { items: [], truncated: false }; },
    async createList(input) { return { list: { _id: 'list-1', name: input.name }, stages: [] }; },
    async addField(input) { return { _id: input.fieldId ?? 'field-1', name: input.name, type: input.type }; },
    async createItem(input) { return { _id: 'item-1', name: input.title, stageId: input.stageId }; },
    async updateItem(input) {
      operations.push('update');
      return { _id: input.itemId, name: input.title, customFields: input.customFields };
    },
    async moveItemToStage(itemId, stageId) {
      operations.push('move');
      if (options.moveRejects) throw new Error('stage unavailable');
      return { _id: itemId, name: itemId, stageId };
    },
    async deleteItem() {},
  };
}

describe('scored CV invitation mail', () => {
  it('preserves tracked mail metadata, updates sent status, and moves through injected verified clients', async () => {
    const requests: unknown[] = [];
    const operations: string[] = [];
    const result = await sendScoredCvInvitation({
      roomId: 'room-1', cvItemId: 'cv-1', cvListId: 'list-1', jdName: 'SCREENING_BACKEND',
      candidateName: 'Candidate', email: 'candidate@example.test', subject: 'Interview', body: 'Line 1\nLine 2',
      itemName: 'Candidate', customFields: [], interviewPendingStageId: 'stage-interview',
    }, {
      async send(request) { operations.push('mail'); requests.push(request); },
    }, lists({ operations }));

    expect(requests).toEqual([{
      roomId: 'room-1', source: 'cv_scored', cvItemId: 'cv-1', cvListId: 'list-1',
      jdName: 'SCREENING_BACKEND', toName: 'Candidate', toEmail: 'candidate@example.test',
      subject: 'Interview', htmlContent: 'Line 1<br/>Line 2',
    }]);
    expect(JSON.stringify(requests)).not.toContain('requestedBy');
    expect(result.status).toBe('07_Chua_Phong_Van');
    expect(result.inviteMailSent).toBe(true);
    expect(operations).toEqual(['mail', 'update', 'move']);
  });

  it('preflight-rejects unsupported stage movement before sending mail or updating the item', async () => {
    const send = vi.fn();
    await expect(sendScoredCvInvitation({
      roomId: 'room-1', cvItemId: 'cv-1', cvListId: 'list-1', candidateName: 'Candidate',
      email: 'candidate@example.test', subject: 'Interview', body: 'Body', itemName: 'Candidate',
      customFields: [], interviewPendingStageId: 'stage-interview',
    }, { send }, lists({ stageAvailable: false }))).rejects.toBeInstanceOf(OptionalFeatureUnavailableError);

    expect(send).not.toHaveBeenCalled();
  });

  it('does not mutate the sent marker or stage when mail rejects after capability preflight', async () => {
    const operations: string[] = [];
    const client = lists({ operations });

    await expect(sendScoredCvInvitation({
      roomId: 'room-1', cvItemId: 'cv-1', cvListId: 'list-1', candidateName: 'Candidate',
      email: 'candidate@example.test', subject: 'Interview', body: 'Body', itemName: 'Candidate',
      customFields: [], interviewPendingStageId: 'stage-interview',
    }, {
      async send() { operations.push('mail'); throw new Error('mail rejected'); },
    }, client)).rejects.toThrow('mail rejected');

    expect(operations).toEqual(['mail']);
  });
});
