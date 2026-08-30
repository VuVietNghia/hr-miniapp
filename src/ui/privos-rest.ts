/**
 * Thin wrapper around `app.rest()` — the REST-first way to talk to the hub.
 *
 * `app.rest()` resolves `{ statusCode, body }` where `body` is the hub's
 * API.v1 payload (e.g. `{ success: true, lists: [...] }`). This helper unwraps
 * that, throwing on HTTP errors or `success: false` so callers can `try/catch`
 * the same way they did with the legacy `callServerTool` tools.
 *
 * Every call runs as the logged-in user and is gated server-side by the app's
 * granted scopes (declared in package.json `scopes`), so no bespoke tools needed.
 */
import type { McpApp, RestRequestParams } from '@privos_ai/app-react';

const OPTIONAL_FEATURE_MESSAGE = 'This optional feature is disabled because its permission was not granted. An administrator can enable it in app settings.';
const ROOM_OPERATION_FAILED_MESSAGE = 'The Room operation could not be completed.';
const INVALID_RESPONSE_MESSAGE = 'The Room operation returned an invalid response.';
const PERMISSION_PATTERN = /permission|forbidden|unauthori[sz]ed|scope|not.granted|access.denied|\b401\b|\b403\b/i;

type RestApp = Pick<McpApp, 'rest'>;

export interface RestCallOptions {
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  timeoutMs?: number;
}

export class OptionalFeatureUnavailableError extends Error {
  readonly code = 'OPTIONAL_PERMISSION_NOT_GRANTED';

  constructor(
    readonly scope?: string,
    readonly errorType?: string,
  ) {
    super(OPTIONAL_FEATURE_MESSAGE);
    this.name = 'OptionalFeatureUnavailableError';
  }
}

export class PrivosRestError extends Error {
  constructor(
    readonly statusCode?: number,
    readonly errorType?: string,
  ) {
    super(ROOM_OPERATION_FAILED_MESSAGE);
    this.name = 'PrivosRestError';
  }
}

export function safeFeatureError(error: unknown, fallback: string): string {
  return error instanceof OptionalFeatureUnavailableError ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRestEnvelope(value: unknown): value is Readonly<{ statusCode: number; body: unknown }> {
  return isRecord(value)
    && typeof value.statusCode === 'number'
    && Number.isInteger(value.statusCode)
    && value.statusCode >= 100
    && value.statusCode <= 599
    && Object.prototype.hasOwnProperty.call(value, 'body');
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function failureMetadata(body: unknown): Readonly<{
  failed: boolean;
  errorType?: string;
  permissionLooking: boolean;
}> {
  if (!isRecord(body)) return { failed: false, permissionLooking: false };
  const error = optionalString(body, 'error');
  const message = optionalString(body, 'message');
  const errorType = optionalString(body, 'errorType');
  const permissionLooking = [error, message, errorType]
    .some((candidate) => candidate !== undefined && PERMISSION_PATTERN.test(candidate));
  return {
    failed: body.success === false,
    ...(errorType === undefined ? {} : { errorType }),
    permissionLooking,
  };
}

/**
 * The overload preserves pre-migration call sites until Tasks 10-11 inject the strict clients.
 * New platform clients treat this result as unknown and validate/project every success body.
 */
export function restCall<T = unknown>(
  app: RestApp,
  method: RestRequestParams['method'],
  path: string,
  opts?: RestCallOptions,
): Promise<T>;
export async function restCall(
  app: RestApp,
  method: RestRequestParams['method'],
  path: string,
  opts?: RestCallOptions,
): Promise<unknown> {
  if (path === 'ai-messages.startGeneration') {
    throw new OptionalFeatureUnavailableError('sandbox:ai-chat:write');
  }
  const request: RestRequestParams = {
    method,
    path,
    ...(opts?.query === undefined ? {} : { query: opts.query }),
    ...(opts?.body === undefined ? {} : { body: opts.body }),
    ...(opts?.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }),
  };
  const response: unknown = await app.rest(request);
  if (!isRestEnvelope(response)) throw new Error(INVALID_RESPONSE_MESSAGE);

  const metadata = failureMetadata(response.body);
  if (
    response.statusCode === 403
    || ((response.statusCode >= 400 || metadata.failed) && metadata.permissionLooking)
  ) {
    throw new OptionalFeatureUnavailableError(undefined, metadata.errorType);
  }
  if (response.statusCode >= 400 || metadata.failed) {
    throw new PrivosRestError(response.statusCode, metadata.errorType);
  }
  return response.body;
}

type LegacyContentApp = Pick<McpApp, 'rest'>;
type LegacyFolderApp = Pick<McpApp, 'callServerTool'>;
type LegacyFileMutationApp = Pick<McpApp, 'callServerTool' | 'uploadFile'>;

/** Path-based file reads have no approved Step 3 mapping and fail before transport. */
export async function getFileContent(_app: LegacyContentApp, _path: string): Promise<string> {
  throw new OptionalFeatureUnavailableError('files:read');
}

/** Folder traversal and creation have no approved Step 3 mapping and fail before transport. */
export async function ensureFolderPath(
  _app: LegacyFolderApp,
  _channelId: string,
  _folderNames: readonly string[],
): Promise<string | undefined> {
  throw new OptionalFeatureUnavailableError('files:write');
}

/** Replace-by-path depends on unsupported folders/file mutation and remains disabled. */
export async function createOrUpdateFile(
  _app: LegacyFileMutationApp,
  _path: string,
  _content: string,
): Promise<unknown> {
  throw new OptionalFeatureUnavailableError('files:write');
}

