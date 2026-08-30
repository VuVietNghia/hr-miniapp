import { describe, expect, it } from 'vitest';

import { runKanbanBatch } from '../../src/ui/pipeline-dashboard';

describe('pipeline dashboard Kanban outcome', () => {
  it.each([
    [{ succeededOperationIds: ['op-1', 'op-2'], failedOperationIds: [] }, 'success'],
    [{ succeededOperationIds: ['op-1'], failedOperationIds: ['op-2'] }, 'partial'],
    [{ succeededOperationIds: [], failedOperationIds: ['op-1'] }, 'failure'],
  ] as const)('maps persisted batch counts to a distinct %s outcome', async (result, expectedKind) => {
    await expect(runKanbanBatch(async () => result)).resolves.toMatchObject({
      kind: expectedKind,
      succeeded: result.succeededOperationIds.length,
      failed: result.failedOperationIds.length,
    });
  });

  it('maps a thrown Kanban operation to failure without a success result', async () => {
    await expect(runKanbanBatch(async () => { throw new Error('list rejected'); })).resolves.toEqual({
      kind: 'failure', succeeded: 0, failed: 0,
    });
  });
});
