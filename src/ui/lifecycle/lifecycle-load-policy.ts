import type { ProfileLoadResult } from './types';

export interface ProfileLoadStatusMessage {
  code?: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface ProfileLoadRetryOptions {
  retryDelaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
}

const PROFILE_LOAD_ERROR: ProfileLoadStatusMessage = {
  code: 'PROFILE_LOAD_FAILED',
  text: 'Không thể tải danh sách hồ sơ nhân sự.',
  type: 'error',
};

const DEFAULT_RETRY_DELAYS_MS = [300, 700] as const;

export async function loadProfilesWithRetry(
  load: () => Promise<ProfileLoadResult>,
  options: ProfileLoadRetryOptions = {},
): Promise<ProfileLoadResult> {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? wait;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    const result = await loadOnce(load);
    if (result.status !== 'failed' || attempt === retryDelaysMs.length) return result;
    await sleep(retryDelaysMs[attempt]);
  }

  return PROFILE_LOAD_FAILED_RESULT;
}

export function reconcileProfileLoadStatus(
  current: ProfileLoadStatusMessage | null,
  loadSucceeded: boolean,
): ProfileLoadStatusMessage | null {
  if (!loadSucceeded) return PROFILE_LOAD_ERROR;
  return current?.code === PROFILE_LOAD_ERROR.code ? null : current;
}

const PROFILE_LOAD_FAILED_RESULT: ProfileLoadResult = {
  status: 'failed',
  errorCode: 'PROFILE_LOAD_FAILED',
  message: PROFILE_LOAD_ERROR.text,
};

async function loadOnce(load: () => Promise<ProfileLoadResult>): Promise<ProfileLoadResult> {
  try {
    return await load();
  } catch {
    return PROFILE_LOAD_FAILED_RESULT;
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
