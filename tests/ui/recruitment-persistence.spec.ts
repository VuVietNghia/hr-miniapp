import { describe, expect, it, vi } from 'vitest';

import {
  persistRecruitmentJD,
  isRecruitmentPersistenceAvailable,
  upsertPersistedRecruitmentJob,
  type RecruitmentPersistenceJob,
} from '../../src/ui/recruitment-panel';
import type { FilesClient } from '../../src/ui/platform/contracts';

const job: RecruitmentPersistenceJob = { title: 'Backend Engineer' };

function verifiedClients(options: Readonly<{ rejectUpload?: boolean }> = {}) {
  const calls: string[] = [];
  const folders = {
    capabilities: { ensurePath: true, findByPath: true },
    async ensurePath(roomId: string, segments: readonly string[]) {
      calls.push(`folder:${roomId}:${segments.join('/')}`);
      return { _id: 'folder-jds', name: 'jds' };
    },
  };
  const files = {
    capabilities: { folderScopedRead: true, folderScopedWrite: true },
    async upload(input: Parameters<FilesClient['upload']>[0]) {
      calls.push(`unscoped-upload:${input.fileName}:${input.mimeType}`);
      if (options.rejectUpload) throw new Error('upload rejected');
      return { _id: 'file-jd', name: input.fileName, mimeType: input.mimeType };
    },
    async uploadToFolder(input: { folderId: string; fileName: string; mimeType: string }) {
      calls.push(`folder-upload:${input.folderId}:${input.fileName}:${input.mimeType}`);
      if (options.rejectUpload) throw new Error('upload rejected');
      return { _id: 'file-jd', name: input.fileName, mimeType: input.mimeType };
    },
  };
  return { calls, folders, files };
}

describe('recruitment JD persistence', () => {
  it('commits UI state only after verified folder persistence and Markdown upload succeed', async () => {
    const clients = verifiedClients();
    const committed: RecruitmentPersistenceJob[] = [];

    await persistRecruitmentJD({
      roomId: 'room-1', fileName: 'JD_Backend_Engineer.md', content: '# JD', job,
    }, clients, persisted => committed.push(persisted));

    expect(clients.calls).toEqual([
      'folder:room-1:hr-miniapp/jds',
      'folder-upload:folder-jds:JD_Backend_Engineer.md:text/markdown',
    ]);
    expect(committed).toEqual([job]);
  });

  it('keeps the form state uncommitted when upload rejects', async () => {
    const clients = verifiedClients({ rejectUpload: true });
    const commit = vi.fn();

    await expect(persistRecruitmentJD({
      roomId: 'room-1', fileName: 'JD_Backend_Engineer.md', content: '# JD', job,
    }, clients, commit)).rejects.toThrow('upload rejected');

    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects a missing Room before folder or upload calls', async () => {
    const clients = verifiedClients();
    const commit = vi.fn();

    await expect(persistRecruitmentJD({
      roomId: '', fileName: 'JD_Backend_Engineer.md', content: '# JD', job,
    }, clients, commit)).rejects.toThrow('Room');

    expect(clients.calls).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it('replaces a duplicate persisted job instead of appending a local duplicate', () => {
    const previous = [{ title: 'Backend Engineer', summary: 'old' }, { title: 'QA Engineer' }];

    expect(upsertPersistedRecruitmentJob(previous, { title: 'Backend Engineer', summary: 'new' })).toEqual([
      { title: 'Backend Engineer', summary: 'new' },
      { title: 'QA Engineer' },
    ]);
  });

  it('reports recruitment persistence unavailable when folder-scoped writes are unavailable', () => {
    expect(isRecruitmentPersistenceAvailable({
      files: { capabilities: { folderScopedRead: false, folderScopedWrite: false } },
      folders: { capabilities: { ensurePath: false, findByPath: false } },
    })).toBe(false);
  });
});
