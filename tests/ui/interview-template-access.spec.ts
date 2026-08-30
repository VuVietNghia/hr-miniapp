import { describe, expect, it, vi } from 'vitest';

import type { FeatureCapabilities } from '../../src/ui/access/feature-capabilities';
import { loadActiveInviteTemplate } from '../../src/ui/cv-scored/invite-template-state';
import {
  InterviewEmailTemplateRepository,
  PrivosInterviewEmailTemplateFileGateway,
} from '../../src/ui/email-templates/interview-email-template-repository';
import { resolveInterviewTemplateAccess } from '../../src/ui/email-templates/interview-template-access';
import type { FilesClient, FoldersClient } from '../../src/ui/platform/contracts';

const READ_ONLY: FeatureCapabilities = {
  listsReadable: true,
  listsQueryable: false,
  listsWritable: false,
  filesReadable: true,
  filesWritable: false,
  draftingAvailable: false,
  aiChatReadable: false,
  aiChatWritable: false,
  payrollReadable: false,
  payrollWritable: false,
};

const PLATFORM = {
  files: { capabilities: { folderScopedRead: true, folderScopedWrite: true } },
  folders: { capabilities: { findByPath: true, ensurePath: true } },
};

describe('interview template read/write access', () => {
  it('keeps Email template discovery readable without Files write or Lists write', () => {
    expect(resolveInterviewTemplateAccess(READ_ONLY, PLATFORM)).toEqual({ readable: true, writable: false });
  });

  it('loads an existing CV invite template without initialization when Files write is revoked', async () => {
    const activeTemplate = {
      id: 'existing', fileId: 'file-1', fileName: 'existing.md', name: 'Existing',
      subject: 'Interview', body: 'Body', validationError: null,
    };
    const repository = {
      ensureInitialized: vi.fn(async () => ({ templates: [activeTemplate], activeTemplateId: activeTemplate.id })),
      getActiveTemplate: vi.fn(async () => activeTemplate),
    };
    const states: unknown[] = [];

    await loadActiveInviteTemplate(repository, false, () => true, state => states.push(state));

    expect(repository.ensureInitialized).not.toHaveBeenCalled();
    expect(repository.getActiveTemplate).toHaveBeenCalledOnce();
    expect(states[states.length - 1]).toMatchObject({ activeTemplate, loading: false, error: null });
  });

  it('initializes before loading a CV invite template only with verified Files write access', async () => {
    const calls: string[] = [];
    const activeTemplate = {
      id: 'existing', fileId: 'file-1', fileName: 'existing.md', name: 'Existing',
      subject: 'Interview', body: 'Body', validationError: null,
    };
    const repository = {
      async ensureInitialized() { calls.push('initialize'); return { templates: [activeTemplate], activeTemplateId: activeTemplate.id }; },
      async getActiveTemplate() { calls.push('read'); return activeTemplate; },
    };

    await loadActiveInviteTemplate(repository, true, () => true, () => {});

    expect(calls).toEqual(['initialize', 'read']);
    expect(resolveInterviewTemplateAccess({ ...READ_ONLY, filesWritable: true }, PLATFORM)).toEqual({ readable: true, writable: true });
  });

  it('lists a missing template folder through read discovery without entering the write ensure path', async () => {
    const files: FilesClient = {
      capabilities: { folderScopedRead: true, folderScopedWrite: false },
      async listRoomFiles() { return []; },
      async listFolderFiles() { throw new Error('missing folder should not list'); },
      async readFile() { throw new Error('missing folder should not read'); },
      async upload() { throw new Error('write forbidden'); },
      async uploadToFolder() { throw new Error('write forbidden'); },
    };
    const folders: FoldersClient = {
      capabilities: { findByPath: true, ensurePath: false },
      async findByPath() { return null; },
      async ensurePath() { throw new Error('write forbidden'); },
    };
    const repository = new InterviewEmailTemplateRepository(
      new PrivosInterviewEmailTemplateFileGateway('room-1', files, folders),
      'unused default',
    );

    await expect(repository.listTemplates()).resolves.toEqual({ templates: [], activeTemplateId: null });
  });
});
