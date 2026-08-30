import { describe, expect, it } from 'vitest';
import type { McpApp } from '@privos_ai/app-react';

import {
  createOrUpdateFile,
  ensureFolderPath,
  getFileContent,
  OptionalFeatureUnavailableError,
  PrivosRestError,
  restCall,
  safeFeatureError,
} from '../../src/ui/privos-rest';

type RestApp = Pick<McpApp, 'rest'>;
type RestResponse = Awaited<ReturnType<RestApp['rest']>>;
type UnsupportedHelperApp = Pick<McpApp, 'rest' | 'callServerTool' | 'uploadFile'>;

function fakeRestApp(response: RestResponse): RestApp {
  return { rest: async () => response };
}

function recordingUnsupportedHelperApp(): Readonly<{
  app: UnsupportedHelperApp;
  restCalls: unknown[];
  toolCalls: unknown[];
  uploadCalls: unknown[];
}> {
  const restCalls: unknown[] = [];
  const toolCalls: unknown[] = [];
  const uploadCalls: unknown[] = [];
  return {
    app: {
      async rest(request) {
        restCalls.push(request);
        return { statusCode: 200, body: { success: true, content: 'fabricated empty success' } };
      },
      async callServerTool(request) {
        toolCalls.push(request);
        return { content: [{ type: 'text', text: JSON.stringify({ folders: [] }) }] };
      },
      async uploadFile(request) {
        uploadCalls.push(request);
        return { file: { _id: 'local-file', name: request.fileName } };
      },
    },
    restCalls,
    toolCalls,
    uploadCalls,
  };
}

describe('restCall', () => {
  it('unwraps the REST envelope and returns only the typed body', async () => {
    const body = await restCall<{ success: true; lists: readonly unknown[] }>(
      fakeRestApp({ statusCode: 200, body: { success: true, lists: [] } }),
      'GET',
      'lists.listByRoomId',
      { query: { roomId: 'room-1' } },
    );

    expect(body).toEqual({ success: true, lists: [] });
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('body');
  });

  it('maps a 403 to the stable optional-feature error without leaking its body', async () => {
    const app = fakeRestApp({
      statusCode: 403,
      body: {
        success: false,
        error: 'forbidden for user alice and bearer secret-token',
        errorType: 'error-not-authorized',
      },
    });

    let caught: unknown;
    try {
      await restCall(app, 'GET', 'lists.listByRoomId');
      expect.unreachable('expected restCall to reject');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OptionalFeatureUnavailableError);
    expect(caught).toMatchObject({ errorType: 'error-not-authorized' });
    const message = caught instanceof Error ? caught.message : String(caught);
    expect(message).toBe('This optional feature is disabled because its permission was not granted. An administrator can enable it in app settings.');
    expect(message).not.toContain('alice');
    expect(message).not.toContain('secret-token');
  });

  it('preserves errorType separately while returning stable text for HTTP failures', async () => {
    const app = fakeRestApp({
      statusCode: 409,
      body: {
        success: false,
        error: 'private employee record employee@example.test',
        errorType: 'duplicate-record',
      },
    });

    let caught: unknown;
    try {
      await restCall(app, 'POST', 'items.create');
      expect.unreachable('expected restCall to reject');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PrivosRestError);
    expect(caught).toMatchObject({ statusCode: 409, errorType: 'duplicate-record' });
    expect(caught instanceof Error ? caught.message : '').toBe('The Room operation could not be completed.');
    expect(caught instanceof Error ? caught.message : '').not.toContain('employee@example.test');
  });

  it('rejects a success:false body even when the HTTP status is successful', async () => {
    const app = fakeRestApp({
      statusCode: 200,
      body: { success: false, error: 'internal file contents', errorType: 'write-conflict' },
    });

    await expect(restCall(app, 'POST', 'items.update')).rejects.toMatchObject({
      name: 'PrivosRestError',
      statusCode: 200,
      errorType: 'write-conflict',
      message: 'The Room operation could not be completed.',
    });
  });

  it('does not misclassify permission-related text in a successful body as a failure', async () => {
    const app = fakeRestApp({
      statusCode: 200,
      body: { success: true, message: 'The optional scope is granted.' },
    });

    await expect(restCall(app, 'GET', 'capabilities')).resolves.toEqual({
      success: true,
      message: 'The optional scope is granted.',
    });
  });

  it.each([
    { statusCode: 401, body: { success: false, error: 'unauthorized' } },
    { statusCode: 400, body: { success: false, message: 'Required scope was not granted' } },
    { statusCode: 200, body: { success: false, errorType: 'error-forbidden' } },
  ])('maps permission-looking failure $statusCode to the stable degraded feature error', async (response) => {
    await expect(restCall(fakeRestApp(response), 'GET', 'some.route')).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
  });

  it.each([
    null,
    { statusCode: '200', body: { success: true } },
    { statusCode: 200 },
  ])('rejects malformed REST envelope without echoing it: %j', async (response) => {
    const invokeWithUncheckedApp = (app: unknown): Promise<unknown> => Reflect.apply(
      restCall,
      undefined,
      [app, 'GET', 'some.route'],
    );
    await expect(invokeWithUncheckedApp({ rest: async () => response })).rejects.toThrow(
      'The Room operation returned an invalid response.',
    );
  });
});

describe('safeFeatureError', () => {
  it('does not expose arbitrary error text and preserves the stable permission message', () => {
    const degraded = new OptionalFeatureUnavailableError(undefined, 'error-forbidden');
    expect(safeFeatureError(degraded, 'The feature failed.')).toBe(degraded.message);
    expect(safeFeatureError(new Error('token=secret employee@example.test'), 'The feature failed.')).toBe(
      'The feature failed.',
    );
  });
});

describe('unsupported legacy Room helpers', () => {
  it('rejects retained start-generation dependency before REST transport', async () => {
    const recorder = recordingUnsupportedHelperApp();

    await expect(restCall(recorder.app, 'POST', 'ai-messages.startGeneration', {
      body: { messageId: 'message-1' },
    })).rejects.toBeInstanceOf(OptionalFeatureUnavailableError);
    expect(recorder.restCalls).toEqual([]);
    expect(recorder.toolCalls).toEqual([]);
    expect(recorder.uploadCalls).toEqual([]);
  });

  it('rejects path-based content reads before REST and never fabricates an empty-string success', async () => {
    const recorder = recordingUnsupportedHelperApp();

    await expect(getFileContent(recorder.app, 'room-1/hr-miniapp/file.md')).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    expect(recorder.restCalls).toEqual([]);
    expect(recorder.toolCalls).toEqual([]);
    expect(recorder.uploadCalls).toEqual([]);
  });

  it('rejects legacy folder traversal before any server-tool request', async () => {
    const recorder = recordingUnsupportedHelperApp();

    await expect(ensureFolderPath(recorder.app, 'room-1', ['hr-miniapp'])).rejects.toBeInstanceOf(
      OptionalFeatureUnavailableError,
    );
    expect(recorder.restCalls).toEqual([]);
    expect(recorder.toolCalls).toEqual([]);
    expect(recorder.uploadCalls).toEqual([]);
  });

  it('rejects create-or-update file mutation before folder or upload transport', async () => {
    const recorder = recordingUnsupportedHelperApp();

    await expect(createOrUpdateFile(
      recorder.app,
      'room-1/hr-miniapp/file.md',
      '# Private employee profile',
    )).rejects.toBeInstanceOf(OptionalFeatureUnavailableError);
    expect(recorder.restCalls).toEqual([]);
    expect(recorder.toolCalls).toEqual([]);
    expect(recorder.uploadCalls).toEqual([]);
  });
});
