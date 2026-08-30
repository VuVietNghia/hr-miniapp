import { describe, expect, it } from 'vitest';
import type { McpApp } from '@privos_ai/app-react';

import { buildCompactJDChatHistory } from '../../src/ui/jd-chat-history';
import {
  extractJDPositionName,
  formatGeneratedJDName,
  projectJDChatbotCapabilities,
  runJDChatbotCapabilityAction,
} from '../../src/ui/jd-chatbot-functional';
import { PrivosInterviewEmailTemplateFileGateway } from '../../src/ui/email-templates/interview-email-template-repository';
import type { FilesClient, FoldersClient } from '../../src/ui/platform/contracts';
import { OptionalFeatureUnavailableError } from '../../src/ui/privos-rest';
import { createRoomClients } from '../../src/ui/platform/create-room-clients';
import type { FeatureCapabilities } from '../../src/ui/access/feature-capabilities';

const COMPLETE_CAPABILITIES: FeatureCapabilities = {
  listsReadable: true,
  listsQueryable: true,
  listsWritable: true,
  filesReadable: true,
  filesWritable: true,
  draftingAvailable: true,
  aiChatReadable: true,
  aiChatWritable: true,
  payrollReadable: true,
  payrollWritable: true,
};

describe('JD chat contracts', () => {
  it('keeps compact history free of internal generated content while retaining the newest user request', () => {
    const history = buildCompactJDChatHistory([
      { role: 'ai', content: 'Draft <jd_content>private draft</jd_content><saved_file>JD_AI_Test.md</saved_file>' },
      { role: 'user', content: 'Bá»• sung Ä‘á»‹a Ä‘iá»ƒm HÃ  Ná»™i' },
    ]);

    expect(history).toContain('Bá»• sung Ä‘á»‹a Ä‘iá»ƒm HÃ  Ná»™i');
    expect(history).not.toContain('private draft');
    expect(history).not.toContain('JD_AI_Test.md');
  });

  it('preserves generated JD position parsing and filename format', () => {
    expect(extractJDPositionName('<position_name>Backend Engineer</position_name>', '')).toBe('Backend Engineer');
    expect(formatGeneratedJDName('Backend Engineer')).toBe('JD_AI_BackendEngineer.md');
  });

  it('preflight-disables interview-template folder persistence before file transport', async () => {
    const calls: string[] = [];
    const folders: FoldersClient = {
      capabilities: { ensurePath: false, findByPath: false },
      async ensurePath() { throw new Error('folder unavailable'); },
      async findByPath() { throw new Error('folder unavailable'); },
    };
    const files: FilesClient = {
      capabilities: { folderScopedRead: false, folderScopedWrite: false },
      async listRoomFiles() { calls.push('list'); return []; },
      async listFolderFiles() { calls.push('folder-list'); return []; },
      async readFile() { calls.push('read'); return ''; },
      async upload(input) { calls.push('upload'); return { _id: 'file-1', name: input.fileName }; },
      async uploadToFolder(input) { calls.push('folder-upload'); return { _id: 'file-1', name: input.fileName }; },
    };
    const gateway = new PrivosInterviewEmailTemplateFileGateway('room-1', files, folders);

    await expect(gateway.ensureFolder()).rejects.toBeInstanceOf(OptionalFeatureUnavailableError);
    expect(calls).toEqual([]);
  });

  it('keeps every folder/generation-backed JD action disabled for production clients with a complete scope grant', () => {
    type BrowserApp = Pick<McpApp, 'rest' | 'uploadFile' | 'callServerTool'>;
    const app: BrowserApp = {
      async rest() { throw new Error('transport must not run'); },
      async uploadFile() { throw new Error('transport must not run'); },
      async callServerTool() { throw new Error('transport must not run'); },
    };
    const projection = projectJDChatbotCapabilities(COMPLETE_CAPABILITIES, createRoomClients(app));
    let operations = 0;

    expect(projection).toEqual({
      canReadLibrary: false,
      canWriteJD: false,
      canGenerateWithAI: false,
    });
    for (const available of Object.values(projection)) {
      expect(() => runJDChatbotCapabilityAction(available, () => { operations += 1; })).toThrow('JD chatbot action is unavailable.');
    }
    expect(operations).toBe(0);
  });

  it('allows a verified injected platform fake to opt into JD folder and native-generation actions', () => {
    const projection = projectJDChatbotCapabilities(COMPLETE_CAPABILITIES, {
      files: { capabilities: { folderScopedRead: true, folderScopedWrite: true } },
      folders: { capabilities: { findByPath: true, ensurePath: true } },
      sandbox: { startGeneration() {} },
    });

    expect(projection).toEqual({
      canReadLibrary: true,
      canWriteJD: true,
      canGenerateWithAI: true,
    });
  });
});
