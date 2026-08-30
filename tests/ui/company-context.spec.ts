import { describe, expect, it } from 'vitest';

import { CompanyContextProvider } from '../../src/ui/drafting/services/CompanyContextProvider';
import type { FilesClient, FoldersClient } from '../../src/ui/platform/contracts';

function clients(options: Readonly<{ folderExists?: boolean; capable?: boolean }> = {}) {
  const calls: string[] = [];
  const folders: FoldersClient = {
    capabilities: { ensurePath: false, findByPath: options.capable ?? true },
    async ensurePath() { throw new Error('not used'); },
    async findByPath(roomId, segments) {
      calls.push(`folder:${roomId}:${segments.join('/')}`);
      return options.folderExists === false ? null : { _id: 'company-folder', name: 'company' };
    },
  };
  const filesClient: FilesClient = {
    capabilities: { folderScopedRead: options.capable ?? true, folderScopedWrite: false },
    async listRoomFiles() { calls.push('room-list'); return []; },
    async listFolderFiles(roomId, folderId) {
      calls.push(`files:${roomId}:${folderId}`);
      return [
        { _id: 'file-b', name: 'culture.md' },
        { _id: 'file-a', name: 'overview.md' },
      ];
    },
    async readFile() { return ''; },
    async upload() { throw new Error('not used'); },
    async uploadToFolder() { throw new Error('not used'); },
  };
  return { calls, folders, files: filesClient };
}

describe('CompanyContextProvider', () => {
  it('resolves the exact current-Room hr-miniapp/company folder and returns sorted references', async () => {
    const fake = clients();
    const provider = new CompanyContextProvider(fake.files, fake.folders, 'room-1');

    await expect(provider.getContext()).resolves.toBe([
      '@Files:room-1/hr-miniapp/company/culture.md',
      '@Files:room-1/hr-miniapp/company/overview.md',
    ].join('\n'));
    expect(fake.calls).toEqual([
      'folder:room-1:hr-miniapp/company',
      'files:room-1:company-folder',
    ]);
  });

  it('aborts visibly when exact folder resolution is unavailable without Room-wide fallback', async () => {
    const fake = clients({ folderExists: false });
    const provider = new CompanyContextProvider(fake.files, fake.folders, 'room-1');

    await expect(provider.getContext()).rejects.toThrow('hr-miniapp/company');
    expect(fake.calls).toEqual(['folder:room-1:hr-miniapp/company']);
  });

  it('fails before transport when production folder-scoped capabilities are unavailable', async () => {
    const fake = clients({ capable: false });
    const provider = new CompanyContextProvider(fake.files, fake.folders, 'room-1');

    await expect(provider.getContext()).rejects.toThrow('không khả dụng');
    expect(fake.calls).toEqual([]);
  });
});
