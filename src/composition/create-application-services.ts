import { randomUUID } from 'node:crypto';

import {
  createAgentBotHubClient,
  type AppMcpHandler,
} from '@privos_ai/app-server';

import { readEmailJsConfig } from '../config/emailjs-config';
import { createMcpHandler } from '../mcp/create-mcp-handler';
import { FileSystemUiAssetReader, resolveUiAssetsDirectory } from '../mcp/FileSystemUiAssetReader';
import { createUiResourceProvider, type HrUiResourceProvider, type UiAssetReader } from '../mcp/ui-resource';
import { PayrollApplicationService } from '../payroll/PayrollApplicationService';
import { createProvenPayrollAuthorizationPolicy } from '../payroll/PayrollAuthorizationPolicy';
import { PayrollRepository } from '../payroll/PayrollRepository';
import { AgentBotRoomPlatformGateway, type AuthorizedHubClient } from '../platform/hub/AgentBotRoomPlatformGateway';
import { resolveHubOrigin } from '../platform/hub/resolve-hub-origin';
import { resolveOwnMcpAppId } from '../platform/hub/resolve-own-mcp-app-id';
import { EmailHistoryRepository } from '../services/EmailHistoryRepository';
import { EmailJsMailClient } from '../services/EmailJsMailClient';
import { MailService } from '../services/MailService';
import { MailToolApplicationService } from '../services/MailToolApplicationService';
import { TrackedMailService } from '../services/TrackedMailService';
import { TaskQueue } from '../utils/TaskQueue';

export interface ApplicationServiceGraph {
  mcpHandler: AppMcpHandler;
  ui: HrUiResourceProvider;
}

export interface ApplicationCompositionDependencies {
  environment?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  hubClient?: AuthorizedHubClient;
  resolveMcpAppId?: () => Promise<string | undefined>;
  uiAssetReader?: UiAssetReader;
  now?: () => string;
  createEmailRecordId?: () => string;
}

export function createApplicationServices(
  dependencies: ApplicationCompositionDependencies = {},
): Readonly<ApplicationServiceGraph> {
  const environment = dependencies.environment ?? process.env;
  const fetchFn = dependencies.fetchFn ?? fetch;
  const emailConfig = readEmailJsConfig(environment);
  const queue = new TaskQueue({ delayMs: 1500 });
  const emailClient = new EmailJsMailClient(emailConfig, fetchFn);
  const mailDelivery = new MailService(queue, emailClient);

  const hubClient = dependencies.hubClient ?? createAgentBotHubClient({ resolveHubOrigin });
  const roomPlatform = new AgentBotRoomPlatformGateway(
    hubClient,
    dependencies.resolveMcpAppId ?? resolveOwnMcpAppId,
  );
  const emailHistory = new EmailHistoryRepository(roomPlatform, {
    now: dependencies.now ?? (() => new Date().toISOString()),
    createRecordId: dependencies.createEmailRecordId ?? randomUUID,
  });
  const trackedMail = new TrackedMailService(emailHistory, mailDelivery);
  const mail = new MailToolApplicationService(trackedMail, mailDelivery);

  const payrollRepository = new PayrollRepository(roomPlatform);
  const payrollAuthorization = createProvenPayrollAuthorizationPolicy({
    roomPlatform,
    hubClient,
  });
  const payroll = new PayrollApplicationService(payrollRepository, payrollAuthorization);

  const uiAssetReader = dependencies.uiAssetReader
    ?? new FileSystemUiAssetReader(resolveUiAssetsDirectory());
  const ui = createUiResourceProvider({ assetReader: uiAssetReader });
  const mcpHandler = createMcpHandler({ mail, payroll, ui });

  return Object.freeze({ mcpHandler, ui });
}
