import type {
  AppDescriptor,
  AppMcpHandler,
  ApplicationMcpRequest,
  PairingResult,
  RelayHandle,
  ToolCallContext,
  VerifiedActor,
} from '@privos_ai/app-server';
import { RuntimeModeError } from '@privos_ai/app-server';
import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildRelayAppDescriptor } from '../../src/manifest';
import {
  createDevelopmentRelayStarter,
  createRelayMcpHandler,
} from '../../src/relay-transport';
import {
  createPrivosRuntimeStarter,
  startManifestOnlySurface,
  type ManifestOnlyRequest,
  type ManifestOnlyResponse,
  type ManifestOnlyServer,
} from '../../src/runtime/start-privos-runtime';

const request: ApplicationMcpRequest = {
  jsonrpc: '2.0',
  id: 7,
  method: 'tools/list',
};

function relayContext(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    transport: 'relay',
    requestId: 7,
    identityState: 'missing',
    sessionScope: 'relay:test',
    ...overrides,
  };
}

describe('Relay MCP handler adapter', () => {
  it('forwards the verified SDK actor unchanged', async () => {
    const actor: VerifiedActor = Object.freeze({
      userId: 'user-verified',
      username: 'Verified User',
      roomId: 'room-verified',
      claims: Object.freeze({ sub: 'user-verified', rid: 'room-verified' }),
      provenance: 'user-token',
    });
    const handler: AppMcpHandler = async (_request, context) => context.actor;

    const result = await createRelayMcpHandler(handler)(
      request,
      relayContext({ actor, identityState: 'verified' }),
    );

    expect(result).toBe(actor);
  });

  it('keeps a missing actor missing', async () => {
    const handler: AppMcpHandler = async (_request, context) => context.actor;

    const result = await createRelayMcpHandler(handler)(request, relayContext());

    expect(result).toBeUndefined();
  });

  it('never derives an actor from plain request metadata', async () => {
    const metadataRequest: ApplicationMcpRequest = {
      ...request,
      params: {
        _meta: {
          privosUser: {
            userId: 'spoofed-user',
            roomId: 'spoofed-room',
          },
        },
      },
    };
    const handler: AppMcpHandler = async (_request, context) => context.actor;

    const result = await createRelayMcpHandler(handler)(metadataRequest, relayContext());

    expect(result).toBeUndefined();
  });

  it('forwards the SDK room id in the handler context', async () => {
    const handler: AppMcpHandler = async (_request, context) => context.roomId;

    const result = await createRelayMcpHandler(handler)(
      request,
      relayContext({ roomId: 'room-bound-by-sdk' }),
    );

    expect(result).toBe('room-bound-by-sdk');
  });

  it('forwards the SDK abort signal in the handler context', async () => {
    const signal = new AbortController().signal;
    const handler: AppMcpHandler = async (_request, context) => context.signal;

    const result = await createRelayMcpHandler(handler)(
      request,
      relayContext({ signal }),
    );

    expect(result).toBe(signal);
  });
});

describe('development Relay startup', () => {
  it.each([
    { mcpAppId: 'installed-app-id', expectedMcpAppId: 'installed-app-id' },
    { mcpAppId: undefined, expectedMcpAppId: undefined },
  ])('injects pairing and caches only the exact credential boundary', async ({
    mcpAppId,
    expectedMcpAppId,
  }) => {
    const descriptor: AppDescriptor = buildRelayAppDescriptor();
    const paired: PairingResult = {
      state: 'legacy-complete',
      privosUrl: 'https://hub.example.test',
      clientId: 'client-from-pairing',
      clientSecret: 'secret-from-pairing',
      ...(mcpAppId === undefined ? {} : { mcpAppId }),
    };
    let cachedCredentials: Readonly<Record<string, string>> | undefined;
    let whenConnectedCalled = false;
    let releaseConnection: (() => void) | undefined;
    const connectionGate = new Promise<void>((resolve) => {
      releaseConnection = resolve;
    });
    const relayHandle: RelayHandle = {
      stop: async () => undefined,
      whenConnected: () => {
        whenConnectedCalled = true;
        return connectionGate;
      },
      isConnected: () => false,
    };
    const logger = (_event: string, _fields: Record<string, unknown>): void => undefined;
    const appHandler: AppMcpHandler = async (_request, context) => context.roomId;
    let pairCalls = 0;
    let connectCalls = 0;
    let forwardedHandlerResult: Promise<unknown> | undefined;

    const startRelay = createDevelopmentRelayStarter({
      env: {},
      createDescriptor: () => descriptor,
      pairFromDescriptor: async (pairUrl, actualDescriptor, WebSocketImpl, options) => {
        pairCalls += 1;
        expect(pairUrl).toBe('wss://pair.example.test/token');
        expect(actualDescriptor).toBe(descriptor);
        expect(WebSocketImpl).toBe(WebSocket);
        expect(options).toEqual({ persistIdentityFile: false });
        return paired;
      },
      connectRelay: (options) => {
        connectCalls += 1;
        expect(options.privosUrl).toBe('https://hub.example.test');
        expect(options.clientId).toBe('client-from-pairing');
        expect(options.clientSecret).toBe('secret-from-pairing');
        expect(options.descriptor).toBe(descriptor);
        expect(options.logger).toBe(logger);
        forwardedHandlerResult = options.handler(
          request,
          relayContext({ roomId: 'room-through-adapter' }),
        );
        return relayHandle;
      },
      WebSocketImpl: WebSocket,
      prompt: async (question) => {
        expect(question).toContain('pairing URL');
        return 'wss://pair.example.test/token';
      },
      writeCredentialCache: (credentials) => {
        cachedCredentials = credentials;
      },
      logger,
    });

    let startupSettled = false;
    const startup = startRelay(appHandler).then((handle) => {
      startupSettled = true;
      return handle;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(pairCalls).toBe(1);
    expect(connectCalls).toBe(1);
    await expect(forwardedHandlerResult).resolves.toBe('room-through-adapter');
    expect(whenConnectedCalled).toBe(true);
    expect(startupSettled).toBe(false);
    expect(cachedCredentials).toEqual({
      PRIVOS_URL: 'https://hub.example.test',
      CLIENT_ID: 'client-from-pairing',
      CLIENT_SECRET: 'secret-from-pairing',
      ...(expectedMcpAppId === undefined ? {} : { MCP_APP_ID: expectedMcpAppId }),
    });

    releaseConnection?.();
    await expect(startup).resolves.toBe(relayHandle);
  });
});

describe('production runtime without identity', () => {
  it('exposes only manifest and health while readiness fails closed', () => {
    let requestHandler:
      | ((request: ManifestOnlyRequest, response: ManifestOnlyResponse) => void)
      | undefined;
    let listenedPort: number | undefined;
    const server: ManifestOnlyServer = {
      listen(port, _host, callback) {
        listenedPort = port;
        callback();
      },
    };

    startManifestOnlySurface('identity missing', {
      env: { PORT: '3456' },
      createServer(handler) {
        requestHandler = handler;
        return server;
      },
      logError: () => undefined,
    });

    expect(listenedPort).toBe(3456);
    expect(requestHandler).toBeDefined();

    const invoke = (url: string): Readonly<{ statusCode: number; body: unknown }> => {
      let statusCode = 0;
      let body: unknown;
      const response: ManifestOnlyResponse = {
        set statusCode(value: number) {
          statusCode = value;
        },
        get statusCode() {
          return statusCode;
        },
        setHeader: () => undefined,
        end(value) {
          body = value === undefined ? undefined : JSON.parse(value);
        },
      };
      requestHandler?.({ method: 'GET', url }, response);
      return { statusCode, body };
    };

    expect(invoke('/.well-known/mcp/manifest.json')).toMatchObject({
      statusCode: 200,
      body: { name: 'ai.privos.demo-hr-management-ws' },
    });
    expect(invoke('/health')).toEqual({
      statusCode: 200,
      body: { ok: true, status: 'alive', degraded: true },
    });
    expect(invoke('/ready')).toEqual({
      statusCode: 503,
      body: {
        ok: false,
        status: 'not_ready',
        reason: 'PRODUCTION_WITHOUT_IDENTITY',
      },
    });
    expect(invoke('/mcp')).toEqual({ statusCode: 404, body: { error: 'Not found' } });
  });

  it('selects the manifest-only surface only for production without identity', async () => {
    const missingIdentity = new RuntimeModeError(
      'PRODUCTION_WITHOUT_IDENTITY',
      'production identity is missing',
    );
    const manifestOnlyServer: ManifestOnlyServer = {
      listen: () => undefined,
    };
    let fallbackReason: string | undefined;
    const handler: AppMcpHandler = async () => ({});
    const startRuntime = createPrivosRuntimeStarter({
      env: {},
      serveApp: async () => {
        throw missingIdentity;
      },
      startManifestOnlySurface: (reason) => {
        fallbackReason = reason;
        return manifestOnlyServer;
      },
    });

    await expect(startRuntime(handler)).resolves.toEqual({
      kind: 'manifest-only',
      server: manifestOnlyServer,
    });
    expect(fallbackReason).toBe(missingIdentity.message);
  });

  it('does not catch ambiguous runtime identity errors', async () => {
    const ambiguousIdentity = new RuntimeModeError(
      'AMBIGUOUS_RUNTIME_IDENTITY',
      'managed and standalone identities are both present',
    );
    const handler: AppMcpHandler = async () => ({});
    let fallbackCalled = false;
    const startRuntime = createPrivosRuntimeStarter({
      env: {},
      serveApp: async () => {
        throw ambiguousIdentity;
      },
      startManifestOnlySurface: () => {
        fallbackCalled = true;
        return { listen: () => undefined };
      },
    });

    await expect(startRuntime(handler)).rejects.toBe(ambiguousIdentity);
    expect(fallbackCalled).toBe(false);
  });
});
