import { describe, expect, it } from 'vitest';

import { OnboardingService } from '../../src/ui/onboarding/services/OnboardingService';
import { uploadFileToPrivos } from '../../src/ui/onboarding/PrivosApi';
import { TrainingRoomService } from '../../src/ui/training-dashboard';
import type { FilesClient, FoldersClient } from '../../src/ui/platform/contracts';

function clients(capable = true) {
  const calls: string[] = [];
  const folders: FoldersClient = {
    capabilities: { ensurePath: capable, findByPath: capable },
    async ensurePath(roomId, segments) { calls.push(`folder:${roomId}:${segments.join('/')}`); return { _id: 'folder-1', name: segments[segments.length - 1] ?? '' }; },
    async findByPath(roomId, segments) { calls.push(`find:${roomId}:${segments.join('/')}`); return { _id: 'folder-1', name: segments[segments.length - 1] ?? '' }; },
  };
  const files: FilesClient = {
    capabilities: { folderScopedRead: capable, folderScopedWrite: capable },
    async listRoomFiles() { calls.push('room-list'); return []; },
    async listFolderFiles(roomId, folderId) { calls.push(`files:${roomId}:${folderId}`); return [{ _id: 'doc-1', name: 'guide.md' }]; },
    async readFile() { return ''; },
    async upload(input) { calls.push(`upload-root:${input.fileName}`); return { _id: 'root', name: input.fileName }; },
    async uploadToFolder(input) { calls.push(`upload:${input.folderId}:${input.fileName}:${input.mimeType}`); return { _id: `file-${input.fileName}`, name: input.fileName }; },
  };
  return { calls, folders, files };
}

describe('training and onboarding browser boundary', () => {
  it('loads training documents only from exact hr-miniapp/dao-tao folder', async () => {
    const fake = clients();
    const service = new TrainingRoomService(fake.files, fake.folders);
    await expect(service.load('room-1')).resolves.toEqual([{ _id: 'doc-1', name: 'guide.md' }]);
    expect(fake.calls).toEqual(['find:room-1:hr-miniapp/dao-tao', 'files:room-1:folder-1']);
  });

  it('fails training and onboarding before transport when folder persistence is unsupported', async () => {
    const fake = clients(false);
    await expect(new TrainingRoomService(fake.files, fake.folders).load('room-1')).rejects.toThrow('không khả dụng');
    await expect(new OnboardingService('room-1', fake.files, fake.folders).handleSubmission({ fullName: 'Alice' })).resolves.toMatchObject({ success: false });
    expect(fake.calls).toEqual([]);
  });

  it('uploads onboarding content through injected Room clients without reading global process configuration', async () => {
    const fake = clients();
    const service = new OnboardingService('room-1', fake.files, fake.folders);
    const result = await service.handleSubmission({ fullName: 'Alice', position: 'Developer' });
    expect(result.success).toBe(true);
    expect(fake.calls).toEqual([
      'folder:room-1:hr-miniapp/employees/Alice',
      expect.stringMatching(/^upload:folder-1:\d{4}-\d{2}-\d{2}_CV_Alice_Developer\.md:text\/markdown$/),
    ]);
  });

  it('keeps the retained upload seam compiling as an injected Room-client function', async () => {
    const fake = clients();
    await uploadFileToPrivos(fake.files, { roomId: 'room-1', folderId: 'folder-1', content: '# Doc', fileName: 'doc.md', mimeType: 'text/markdown' });
    expect(fake.calls).toEqual(['upload:folder-1:doc.md:text/markdown']);
  });
});
