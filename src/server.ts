import { pathToFileURL } from 'node:url';

import type { AppMcpHandler } from '@privos_ai/app-server';

import {
  createApplicationServices,
  type ApplicationServiceGraph,
} from './composition/create-application-services';
import { startDevelopmentRelay } from './relay-transport';
import { startPrivosRuntime } from './runtime/start-privos-runtime';

export interface ApplicationStartDependencies {
  environment: Readonly<NodeJS.ProcessEnv>;
  createServices: () => Readonly<ApplicationServiceGraph>;
  startRuntime: (handler: AppMcpHandler) => Promise<unknown>;
  startRelay: (handler: AppMcpHandler) => Promise<unknown>;
  startDevUi?: () => Promise<Readonly<{ publicUrl: string }>>;
}

function isDevelopmentRelay(environment: Readonly<NodeJS.ProcessEnv>): boolean {
  return environment.NODE_ENV !== 'production' && environment.PRIVOS_TRANSPORT === 'relay';
}

export async function startApplication(
  dependencies: ApplicationStartDependencies,
): Promise<void> {
  const services = dependencies.createServices();
  if (isDevelopmentRelay(dependencies.environment)) {
    if (dependencies.environment.PRIVOS_DEV_UI === '1' && dependencies.startDevUi) {
      const devUi = await dependencies.startDevUi();
      services.ui.setDevPublicUrl(devUi.publicUrl);
    }
    await dependencies.startRelay(services.mcpHandler);
    return;
  }
  await dependencies.startRuntime(services.mcpHandler);
}

async function main(): Promise<void> {
  await import('dotenv/config');
  await startApplication({
    environment: process.env,
    createServices: createApplicationServices,
    startRuntime: startPrivosRuntime,
    startRelay: startDevelopmentRelay,
    startDevUi: async () => {
      const { startDevUiServer } = await import('./dev-server');
      return startDevUiServer();
    },
  });
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  void main().catch(() => {
    console.error('Application startup failed.');
    process.exitCode = 1;
  });
}
