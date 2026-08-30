import { describe, expect, it, vi } from 'vitest';

import {
  projectPipelineCapabilities,
  runPipelineCapabilityAction,
} from '../../src/ui/pipeline-dashboard';

describe('PipelineDashboard capability state', () => {
  it('disables every folder-backed production action and exposes a degraded reason', () => {
    expect(projectPipelineCapabilities({
      files: { capabilities: { folderScopedRead: false, folderScopedWrite: false } },
      folders: { capabilities: { ensurePath: false, findByPath: false } },
      sandbox: {},
    })).toEqual({
      canReadFolderFiles: false,
      canOpenJdGenerator: false,
      canUploadJD: false,
      canUploadCV: false,
      canGenerateJD: false,
      canScoreCV: false,
      canSaveJD: false,
      degradedReason: 'Room chưa hỗ trợ đọc/ghi file theo thư mục và khởi chạy AI.',
    });
  });

  it('enables controls for an injected fake only when folder and AI generation dependencies are verified', () => {
    expect(projectPipelineCapabilities({
      files: { capabilities: { folderScopedRead: true, folderScopedWrite: true } },
      folders: { capabilities: { ensurePath: true, findByPath: true } },
      sandbox: { async startGeneration() {} },
    })).toEqual({
      canReadFolderFiles: true,
      canOpenJdGenerator: true,
      canUploadJD: true,
      canUploadCV: true,
      canGenerateJD: true,
      canScoreCV: true,
      canSaveJD: true,
      degradedReason: null,
    });
  });

  it('fails before invoking a programmatic action when its projected capability is unavailable', () => {
    const operation = vi.fn();

    expect(() => runPipelineCapabilityAction(false, operation)).toThrow('unavailable');
    expect(operation).not.toHaveBeenCalled();
  });
});
