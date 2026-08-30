import { describe, expect, it, vi } from 'vitest';

import { persistDetailedProfileDocuments } from '../../src/ui/lifecycle/components/CreateDetailedProfileForm';
import { sendLifecycleMail } from '../../src/ui/lifecycle/components/EmailComposerModal';
import { resolveAttachedFileName, resolveAttachedFileUrl } from '../../src/ui/lifecycle/components/ProfileCard';
import { PrivOSLifecycleService } from '../../src/ui/lifecycle/services/PrivOSLifecycleService';
import type { FilesClient, FoldersClient, ListsClient } from '../../src/ui/platform/contracts';

function lifecycleLists(options: Readonly<{ createRejects?: boolean; readRejects?: boolean; stageMovement?: boolean }> = {}) {
  const calls: string[] = [];
  const list: ListsClient = {
    capabilities: { stageMovement: options.stageMovement ?? true },
    async listByRoom(roomId) {
      calls.push(`lists:${roomId}`);
      if (options.readRejects) throw new Error('list read rejected');
      return [{ _id: 'employees', name: '[HR-MiniApp] Hồ sơ nhân sự', fieldDefinitions: [{ _id: 'email', name: 'Email', type: 'TEXT' }] }];
    },
    async getInfo(listId) {
      calls.push(`info:${listId}`);
      return { list: { _id: listId, name: '[HR-MiniApp] Hồ sơ nhân sự', fieldDefinitions: [{ _id: 'email', name: 'Email', type: 'TEXT' }] }, stages: [{ _id: 'new', name: 'Mới nhận việc' }, { _id: 'official', name: 'Chính thức' }] };
    },
    async queryItems(input) {
      calls.push(`query:${input.listId}`);
      return { items: [{ _id: 'employee-1', name: 'Alice', stageId: 'official', description: '[fileId:file-1]' }], nextCursor: null };
    },
    async listItemsBounded() { throw new Error('not used'); },
    async createList() { throw new Error('bootstrap unavailable'); },
    async addField() { throw new Error('not used'); },
    async createItem(input) {
      calls.push(`create:${input.title}:${input.stageId}`);
      if (options.createRejects) throw new Error('create rejected');
      return { _id: 'employee-2', name: input.title, stageId: input.stageId, description: input.description };
    },
    async updateItem() { throw new Error('not used'); },
    async moveItemToStage(itemId, stageId) { calls.push(`move:${itemId}:${stageId}`); return { _id: itemId, name: 'Alice', stageId }; },
    async deleteItem(itemId) { calls.push(`delete:${itemId}`); },
  };
  return { calls, list };
}

function documentClients(options: Readonly<{ imageRejects?: boolean; markdownRejects?: boolean }> = {}) {
  const calls: string[] = [];
  const folders: FoldersClient = {
    capabilities: { ensurePath: true, findByPath: true },
    async ensurePath(roomId, segments) { calls.push(`folder:${roomId}:${segments.join('/')}`); return { _id: 'employee-folder', name: 'Alice' }; },
    async findByPath() { return null; },
  };
  const files: FilesClient = {
    capabilities: { folderScopedRead: true, folderScopedWrite: true },
    async listRoomFiles() { return []; }, async listFolderFiles() { return []; }, async readFile() { return ''; },
    async upload() { throw new Error('unscoped upload'); },
    async uploadToFolder(input) {
      calls.push(`upload:${input.folderId}:${input.fileName}:${input.mimeType}`);
      if (input.mimeType.startsWith('image/') && options.imageRejects) throw new Error('image rejected');
      if (input.mimeType === 'text/markdown' && options.markdownRejects) throw new Error('markdown rejected');
      return { _id: input.mimeType === 'text/markdown' ? 'profile-file' : 'image-file', name: input.fileName, mimeType: input.mimeType };
    },
  };
  return { calls, folders, files };
}

describe('lifecycle persistence', () => {
  it('creates and reloads a profile through injected List clients while preserving file-link parsing', async () => {
    const fake = lifecycleLists();
    const service = new PrivOSLifecycleService(fake.list);
    await expect(service.createProfile('room-1', { name: 'Bob', email: 'bob@example.test', attachedFileObj: { _id: 'profile-file', name: 'profile.md' } })).resolves.toMatchObject({ _id: 'employee-2', name: 'Bob', status: 'Mới nhận việc' });
    await expect(service.loadProfiles('room-1')).resolves.toEqual([{ _id: 'employee-1', name: 'Alice', status: 'Chính thức', attachedFileId: 'file-1' }]);
    expect(fake.calls).toEqual(['lists:room-1', 'info:employees', 'create:Bob:new', 'lists:room-1', 'info:employees', 'query:employees']);
  });

  it('ignores an unrelated app-owned List that precedes the exact employee lifecycle List', async () => {
    const fake = lifecycleLists();
    const client: ListsClient = {
      ...fake.list,
      async listByRoom(roomId) {
        fake.calls.push(`lists:${roomId}`);
        return [
          { _id: 'other-list', name: '[HR-MiniApp] Other workflow' },
          { _id: 'employees', name: '[HR-MiniApp] Hồ sơ nhân sự' },
        ];
      },
    };

    await new PrivOSLifecycleService(client).createProfile('room-1', { name: 'Bob' });
    expect(fake.calls).toEqual(['lists:room-1', 'info:employees', 'create:Bob:new']);
  });

  it.each([
    [{ _id: 'file-id', id: 'legacy-id', name: 'profile.md' }, '/group/room-1/file-viewer/file-id', 'profile.md'],
    [{ downloadUrl: 'https://files.test/download', url: 'https://files.test/url', title: 'Offer' }, 'https://files.test/url', 'Offer'],
    [{ link: 'https://files.test/link', fileName: 'linked.md' }, 'https://files.test/link', 'linked.md'],
    [{ fileUrl: '/files/profile', name: 'named.md' }, '/files/profile', 'named.md'],
  ] as const)('reloads every validated attachment variant without degrading its view link', async (attachment, expectedUrl, expectedName) => {
    const fake = lifecycleLists();
    const client: ListsClient = {
      ...fake.list,
      async getInfo(listId) {
        fake.calls.push(`info:${listId}`);
        return {
          list: { _id: listId, name: '[HR-MiniApp] Hồ sơ nhân sự', fieldDefinitions: [{ _id: 'document', name: 'Hồ sơ đính kèm', type: 'DOCUMENT' }] },
          stages: [{ _id: 'new', name: 'Mới nhận việc' }],
        };
      },
      async queryItems(input) {
        fake.calls.push(`query:${input.listId}`);
        return { items: [{ _id: 'employee-1', name: 'Alice', stageId: 'new', customFields: [{ fieldId: 'document', value: [attachment] }] }], nextCursor: null };
      },
    };

    const [profile] = await new PrivOSLifecycleService(client).loadProfiles('room-1');
    expect(profile.attachedFileObj).toEqual(attachment);
    expect(resolveAttachedFileUrl(profile, 'room-1')).toBe(expectedUrl);
    expect(resolveAttachedFileName(profile)).toBe(expectedName);
  });

  it('propagates create rejection and never fabricates a local success id or deletes/recreates the List', async () => {
    const fake = lifecycleLists({ createRejects: true });
    const service = new PrivOSLifecycleService(fake.list);
    await expect(service.createProfile('room-1', { name: 'Bob' })).rejects.toThrow('create rejected');
    expect(fake.calls).toEqual(['lists:room-1', 'info:employees', 'create:Bob:new']);
    expect(fake.calls.some(call => call.startsWith('delete:'))).toBe(false);
  });

  it('rejects a missing Room and surfaces reload failure instead of empty-success', async () => {
    const fake = lifecycleLists({ readRejects: true });
    const service = new PrivOSLifecycleService(fake.list);
    await expect(service.createProfile('', { name: 'Bob' })).rejects.toThrow('Room');
    await expect(service.loadProfiles('room-1')).rejects.toThrow('list read rejected');
  });

  it('fails unsupported stage movement before a client mutation and preserves verified movement', async () => {
    const unsupported = lifecycleLists({ stageMovement: false });
    await expect(new PrivOSLifecycleService(unsupported.list).updateProfileStatus('room-1', 'employee-1', 'Chính thức')).rejects.toThrow('không khả dụng');
    expect(unsupported.calls).toEqual([]);

    const supported = lifecycleLists();
    await new PrivOSLifecycleService(supported.list).updateProfileStatus('room-1', 'employee-1', 'Chính thức');
    expect(supported.calls).toEqual(['lists:room-1', 'info:employees', 'move:employee-1:official']);
  });

  it('does not treat retained HR or employee support Lists as recruitment screening Lists', async () => {
    const fake = lifecycleLists();
    const client: ListsClient = {
      ...fake.list,
      async listByRoom(roomId) {
        fake.calls.push(`lists:${roomId}`);
        return [{ _id: 'benefits', name: 'Employee Benefits' }];
      },
    };

    await expect(new PrivOSLifecycleService(client).loadPassedCandidates('room-1')).resolves.toEqual([]);
    expect(fake.calls).toEqual(['lists:room-1']);
  });

  it.each([
    ['image', { imageRejects: true }, 'image rejected'],
    ['Markdown', { markdownRejects: true }, 'markdown rejected'],
  ])('stops detailed profile persistence when %s upload rejects', async (_label, options, message) => {
    const fake = documentClients(options);
    const commit = vi.fn();
    await expect(persistDetailedProfileDocuments({
      roomId: 'room-1', department: 'IT', employeeName: 'Alice', markdownFileName: 'profile.md', markdownContent: '# Alice',
      image: { fileName: 'alice.png', base64Data: 'data:image/png;base64,AA==', mimeType: 'image/png' },
    }, fake, commit)).rejects.toThrow(message);
    expect(commit).not.toHaveBeenCalled();
  });

  it('persists optional image then Markdown and commits the uploaded Markdown identity', async () => {
    const fake = documentClients();
    const committed: unknown[] = [];
    await persistDetailedProfileDocuments({ roomId: 'room-1', department: 'IT', employeeName: 'Alice', markdownFileName: 'profile.md', markdownContent: '# Alice' }, fake, file => committed.push(file));
    expect(fake.calls).toEqual(['folder:room-1:hr-miniapp/employees/IT/Alice', 'upload:employee-folder:profile.md:text/markdown']);
    expect(committed).toEqual([{ _id: 'profile-file', name: 'profile.md', mimeType: 'text/markdown' }]);
  });

  it('sends lifecycle mail only through the injected app-owned boundary', async () => {
    const calls: unknown[] = [];
    await sendLifecycleMail({ roomId: 'room-1', profile: { name: 'Alice', email: 'alice@example.test' }, subject: 'Welcome', content: 'Line 1\nLine 2' }, { async send(input) { calls.push(input); } });
    expect(calls).toEqual([{ roomId: 'room-1', source: 'lifecycle', toName: 'Alice', toEmail: 'alice@example.test', subject: 'Welcome', htmlContent: 'Line 1<br/>Line 2' }]);
  });
});
