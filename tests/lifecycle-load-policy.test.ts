import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadProfilesWithRetry,
  reconcileProfileLoadStatus,
} from '../src/ui/lifecycle/lifecycle-load-policy';
import type { ProfileLoadResult } from '../src/ui/lifecycle/types';

const failedResult: ProfileLoadResult = {
  status: 'failed',
  errorCode: 'PROFILE_LOAD_FAILED',
  message: 'temporary failure',
};

test('retries an initial profile load before surfacing a transient failure', async () => {
  let attempts = 0;
  const result = await loadProfilesWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) return failedResult;
      return { status: 'success', records: [], isComplete: true };
    },
    {
      retryDelaysMs: [0, 0],
      sleep: async () => undefined,
    },
  );

  assert.equal(result.status, 'success');
  assert.equal(attempts, 3);
});

test('keeps the final profile failure after the retry budget is exhausted', async () => {
  let attempts = 0;
  const result = await loadProfilesWithRetry(
    async () => {
      attempts += 1;
      return failedResult;
    },
    {
      retryDelaysMs: [0, 0],
      sleep: async () => undefined,
    },
  );

  assert.equal(result.status, 'failed');
  assert.equal(attempts, 3);
});

test('clears only a stale profile-load error after data recovers', () => {
  const profileError = {
    code: 'PROFILE_LOAD_FAILED' as const,
    text: 'Không thể tải danh sách hồ sơ nhân sự.',
    type: 'error' as const,
  };
  const operationError = {
    code: 'PROFILE_STATUS_UPDATE_FAILED' as const,
    text: 'Không thể đồng bộ trạng thái.',
    type: 'error' as const,
  };

  assert.equal(reconcileProfileLoadStatus(profileError, true), null);
  assert.deepEqual(reconcileProfileLoadStatus(operationError, true), operationError);
  assert.deepEqual(reconcileProfileLoadStatus(null, false), profileError);
});
