import type { FilesClient, UploadedFile } from '../platform/contracts';

export interface BrowserUploadRequest {
  roomId: string;
  folderId: string;
  content: Uint8Array | string;
  fileName: string;
  mimeType: string;
}

function toDataUri(content: Uint8Array | string, mimeType: string): string {
  if (typeof content === 'string' && content.startsWith('data:')) return content;
  if (typeof content === 'string') return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
  let binary = '';
  for (const byte of content) binary += String.fromCharCode(byte);
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function uploadFileToPrivos(
  files: FilesClient,
  request: BrowserUploadRequest,
): Promise<UploadedFile> {
  if (!files.capabilities.folderScopedWrite) {
    throw new Error('Upload theo thư mục không khả dụng trên kết nối PrivOS hiện tại.');
  }
  return files.uploadToFolder({
    roomId: request.roomId,
    folderId: request.folderId,
    fileName: request.fileName,
    base64Data: toDataUri(request.content, request.mimeType),
    mimeType: request.mimeType,
  });
}
