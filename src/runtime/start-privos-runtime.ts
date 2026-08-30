import { createServer as createNodeServer } from 'node:http';

import {
  RuntimeModeError,
  serveApp,
  type AppMcpHandler,
  type ServeAppHandle,
} from '@privos_ai/app-server';

import { buildRelayAppDescriptor, createManifest } from '../manifest';

type ManifestResponse = Readonly<{
  json(body: unknown): unknown;
}>;

type RuntimeHttpApp = Readonly<{
  get(
    path: string,
    handler: (request: unknown, response: ManifestResponse) => void,
  ): unknown;
}>;

export type ManifestOnlyRequest = Readonly<{
  method?: string;
  url?: string;
}>;

export interface ManifestOnlyResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

export type ManifestOnlyRequestHandler = (
  request: ManifestOnlyRequest,
  response: ManifestOnlyResponse,
) => void;

export interface ManifestOnlyServer {
  listen(port: number, host: string, callback: () => void): unknown;
}

type ManifestOnlyDependencies = Readonly<{
  env?: NodeJS.ProcessEnv;
  createServer?: (handler: ManifestOnlyRequestHandler) => ManifestOnlyServer;
  logError?: (message: string) => void;
}>;

export type PrivosRuntimeStartResult =
  | Readonly<{ kind: 'serve-app'; handle: ServeAppHandle }>
  | Readonly<{ kind: 'manifest-only'; server: ManifestOnlyServer }>;

export type PrivosRuntimeDependencies = Readonly<{
  env: Readonly<NodeJS.ProcessEnv>;
  serveApp: typeof serveApp;
  startManifestOnlySurface: (reason: string) => ManifestOnlyServer;
}>;

function respondJson(
  response: ManifestOnlyResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export function startManifestOnlySurface(
  reason: string,
  dependencies: ManifestOnlyDependencies = {},
): ManifestOnlyServer {
  const env = dependencies.env ?? process.env;
  const logError = dependencies.logError ?? console.error;
  const createServer = dependencies.createServer
    ?? ((handler: ManifestOnlyRequestHandler) => createNodeServer(handler));
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/.well-known/mcp/manifest.json') {
      respondJson(response, 200, createManifest());
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      respondJson(response, 200, { ok: true, status: 'alive', degraded: true });
      return;
    }
    if (request.method === 'GET' && request.url === '/ready') {
      respondJson(response, 503, {
        ok: false,
        status: 'not_ready',
        reason: 'PRODUCTION_WITHOUT_IDENTITY',
      });
      return;
    }
    respondJson(response, 404, { error: 'Not found' });
  });
  const port = Number(env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    logError(`No runtime identity: ${reason}`);
    logError(`Serving the manifest only on :${port}; no MCP surface is available.`);
  });
  return server;
}

export function createPrivosRuntimeStarter(
  dependencies: PrivosRuntimeDependencies,
): (handler: AppMcpHandler) => Promise<PrivosRuntimeStartResult> {
  return async (handler) => {
    const transportOverride = dependencies.env.PRIVOS_TRANSPORT === 'relay'
      ? 'relay'
      : undefined;

    try {
      const handle = await dependencies.serveApp({
        descriptor: buildRelayAppDescriptor(),
        createHandler: () => handler,
        port: Number(dependencies.env.PORT || 3000),
        ...(transportOverride ? { transportOverride } : {}),
        resolveManifest: () => createManifest(),
        configure: (app: RuntimeHttpApp) => {
          app.get('/.well-known/mcp/manifest.json', (_request, response) => {
            response.json(createManifest());
          });
        },
      });
      return { kind: 'serve-app', handle };
    } catch (error) {
      if (error instanceof RuntimeModeError && error.code === 'PRODUCTION_WITHOUT_IDENTITY') {
        return {
          kind: 'manifest-only',
          server: dependencies.startManifestOnlySurface(error.message),
        };
      }
      throw error;
    }
  };
}

export function startPrivosRuntime(
  handler: AppMcpHandler,
): Promise<PrivosRuntimeStartResult> {
  return createPrivosRuntimeStarter({
    env: process.env,
    serveApp,
    startManifestOnlySurface,
  })(handler);
}
