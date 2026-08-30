import type { McpApp } from '@privos_ai/app-react';
import defaultTemplateMarkdown from '../data/email-templates/moi-phong-van-mac-dinh.md?raw';
import {
  InterviewEmailTemplateRepository,
  PrivosInterviewEmailTemplateFileGateway,
} from './interview-email-template-repository';
import { createRoomClients } from '../platform/create-room-clients';
import type { FilesClient, FoldersClient } from '../platform/contracts';

export { defaultTemplateMarkdown };

export function createInterviewEmailTemplateRepository(app: McpApp, roomId: string) {
  const clients = createRoomClients(app);
  return createInterviewEmailTemplateRepositoryWithClients(roomId, clients.files, clients.folders);
}

export function createInterviewEmailTemplateRepositoryWithClients(
  roomId: string,
  files: FilesClient,
  folders: FoldersClient,
) {
  return new InterviewEmailTemplateRepository(
    new PrivosInterviewEmailTemplateFileGateway(roomId, files, folders),
    defaultTemplateMarkdown,
  );
}
