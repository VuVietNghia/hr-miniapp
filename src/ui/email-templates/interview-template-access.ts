import type { FeatureCapabilities } from '../access/feature-capabilities';
import type { FilesClient, FoldersClient } from '../platform/contracts';

interface InterviewTemplateCapabilitySource {
  files: Pick<FilesClient, 'capabilities'>;
  folders: Pick<FoldersClient, 'capabilities'>;
}

export interface InterviewTemplateAccess {
  readonly readable: boolean;
  readonly writable: boolean;
}

export function resolveInterviewTemplateAccess(
  capabilities: FeatureCapabilities,
  source: InterviewTemplateCapabilitySource | null,
): InterviewTemplateAccess {
  return {
    readable: Boolean(
      capabilities.filesReadable
      && source?.files.capabilities.folderScopedRead
      && source.folders.capabilities.findByPath,
    ),
    writable: Boolean(
      capabilities.filesWritable
      && source?.files.capabilities.folderScopedWrite
      && source.folders.capabilities.ensurePath,
    ),
  };
}
