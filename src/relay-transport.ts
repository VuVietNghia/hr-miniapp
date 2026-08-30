import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import {
  connectRelay,
  pairFromDescriptor,
  type AppDescriptor,
  type AppMcpHandler,
  type ApplicationMcpRequest,
  type RelayHandle,
  type ToolCallContext,
} from '@privos_ai/app-server';
import WebSocket from 'ws';

import { buildRelayAppDescriptor } from './manifest';

export type DevelopmentCredentialCache = Readonly<{
  PRIVOS_URL: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  MCP_APP_ID?: string;
}>;

export type DevelopmentRelayDependencies = Readonly<{
  env: Readonly<NodeJS.ProcessEnv>;
  createDescriptor: () => AppDescriptor;
  pairFromDescriptor: typeof pairFromDescriptor;
  connectRelay: typeof connectRelay;
  WebSocketImpl: typeof WebSocket;
  prompt: (question: string) => Promise<string>;
  writeCredentialCache: (credentials: DevelopmentCredentialCache) => void;
  logger: (event: string, fields: Record<string, unknown>) => void;
}>;

export function createRelayMcpHandler(handler: AppMcpHandler): AppMcpHandler {
  return async (
    request: ApplicationMcpRequest,
    context: ToolCallContext,
  ): Promise<unknown> => handler(request, context);
}

function relayLogger(prefix: string): (event: string, fields: Record<string, unknown>) => void {
  return (event) => {
    if (event.includes('error') || event.includes('fail') || event.includes('rejected')) {
      console.error(`${prefix} - ${event}`);
      return;
    }
    console.log(`${prefix} - ${event}`);
  };
}

function prompt(question: string): Promise<string> {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    terminal.question(question, (answer) => {
      terminal.close();
      resolve(answer.trim());
    });
  });
}

function saveDevelopmentCredentials(variables: DevelopmentCredentialCache): void {
  const envPath = path.join(process.cwd(), '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  const cacheEntries: Array<readonly [string, string]> = [
    ['PRIVOS_URL', variables.PRIVOS_URL],
    ['CLIENT_ID', variables.CLIENT_ID],
    ['CLIENT_SECRET', variables.CLIENT_SECRET],
  ];
  if (variables.MCP_APP_ID !== undefined) {
    cacheEntries.push(['MCP_APP_ID', variables.MCP_APP_ID]);
  }

  for (const [key, value] of cacheEntries) {
    const line = `${key}=${value}`;
    const existingKey = new RegExp(`^${key}=.*$`, 'm');
    content = existingKey.test(content)
      ? content.replace(existingKey, line)
      : `${content}${content === '' || content.endsWith('\n') ? '' : '\n'}${line}\n`;
  }

  fs.writeFileSync(envPath, content);
}

export function createDevelopmentRelayStarter(
  dependencies: DevelopmentRelayDependencies,
): (handler: AppMcpHandler) => Promise<RelayHandle> {
  return async (handler) => {
    const descriptor = dependencies.createDescriptor();
    let privosUrl = dependencies.env.PRIVOS_URL;
    let clientId = dependencies.env.CLIENT_ID;
    let clientSecret = dependencies.env.CLIENT_SECRET;

    if (!privosUrl || !clientId || !clientSecret) {
      dependencies.logger('development_pairing.required', {});
      const pairUrl = await dependencies.prompt('Enter the PrivOS Relay pairing URL: ');
      if (!pairUrl) {
        throw new Error('No pairing URL provided');
      }

      const paired = await dependencies.pairFromDescriptor(
        pairUrl,
        descriptor,
        dependencies.WebSocketImpl,
        { persistIdentityFile: false },
      );
      privosUrl = paired.privosUrl;
      clientId = paired.clientId;
      clientSecret = paired.clientSecret;

      const cachedCredentials: DevelopmentCredentialCache = {
        PRIVOS_URL: privosUrl,
        CLIENT_ID: clientId,
        CLIENT_SECRET: clientSecret,
        ...(paired.mcpAppId === undefined ? {} : { MCP_APP_ID: paired.mcpAppId }),
      };
      dependencies.writeCredentialCache(cachedCredentials);
      dependencies.logger('development_pairing.cached', {});
    }

    const handle = dependencies.connectRelay({
      privosUrl,
      clientId,
      clientSecret,
      descriptor,
      handler: createRelayMcpHandler(handler),
      logger: dependencies.logger,
    });
    await handle.whenConnected();
    dependencies.logger('development_relay.connected', {});
    return handle;
  };
}

export function startDevelopmentRelay(handler: AppMcpHandler): Promise<RelayHandle> {
  return createDevelopmentRelayStarter({
    env: process.env,
    createDescriptor: buildRelayAppDescriptor,
    pairFromDescriptor,
    connectRelay,
    WebSocketImpl: WebSocket,
    prompt,
    writeCredentialCache: saveDevelopmentCredentials,
    logger: relayLogger('[Relay]'),
  })(handler);
}
