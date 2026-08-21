import assert from 'node:assert/strict';
import test from 'node:test';
import { DraftingRequestCoordinator } from '../src/ui/drafting/services/DraftingRequestCoordinator';
import { sanitizeDraftingLogMessage } from '../src/ui/drafting/services/DraftingLogSanitizer';

test('allows only one drafting request at a time', () => {
  const coordinator = new DraftingRequestCoordinator();
  const firstRequestId = coordinator.start();

  assert.equal(firstRequestId, 1);
  assert.equal(coordinator.start(), null);
  assert.equal(coordinator.isCurrent(firstRequestId as number), true);

  coordinator.finish(firstRequestId as number);
  assert.equal(coordinator.start(), 2);
});

test('invalidates an in-flight request after disposal', () => {
  const coordinator = new DraftingRequestCoordinator();
  const requestId = coordinator.start() as number;

  coordinator.dispose();

  assert.equal(coordinator.isCurrent(requestId), false);
  assert.equal(coordinator.start(), null);
});

test('redacts session IDs and raw pipeline errors from drafting logs', () => {
  assert.equal(
    sanitizeDraftingLogMessage('Đã khởi tạo Session: private-session-id'),
    '[AI DRAFTING] PIPELINE_EVENT',
  );
  assert.equal(
    sanitizeDraftingLogMessage('Lỗi mạng: raw private prompt'),
    '[AI DRAFTING] PIPELINE_EVENT',
  );
});
