/**
 * Thin wrapper around `app.rest()` — the REST-first way to talk to the hub.
 *
 * `app.rest()` resolves `{ statusCode, body }` where `body` is the hub's
 * API.v1 payload (e.g. `{ success: true, lists: [...] }`). This helper unwraps
 * that, throwing on HTTP errors or `success: false` so callers can `try/catch`
 * the same way they did with the legacy `callServerTool` tools.
 *
 * Every call runs as the logged-in user and is gated server-side by the app's
 * granted scopes (declared in package.json `scopes`), so no bespoke tools needed.
 */
import type { McpApp, RestRequestParams } from '@privos/app-react';

export async function restCall<T = any>(
  app: McpApp,
  method: RestRequestParams['method'],
  path: string,
  opts?: { query?: Record<string, string | number | boolean>; body?: any; timeoutMs?: number },
): Promise<T> {
  const res = await app.rest({ method, path, query: opts?.query, body: opts?.body, timeoutMs: opts?.timeoutMs });
  const body: any = res?.body ?? res;
  if (res?.statusCode && res.statusCode >= 400) {
    throw new Error(body?.error || body?.message || `Request failed (${res.statusCode})`);
  }
  if (body && body.success === false) {
    throw new Error(body.error || body.message || 'Request failed');
  }
  return body as T;
}

export async function getFileContent(app: McpApp, path: string): Promise<string> {
  try {
    const res = await app.rest({
      method: 'GET',
      path: 'api/files/content',
      query: {
        path: path,
        basePath: '/app/data/projects/workspace/RoomFiles'
      }
    } as any);
    const body: any = res?.body ?? res;
    return body?.content || '';
  } catch (err) {
    console.error('Failed to get file content', err);
    return '';
  }
}

export async function ensureFolderPath(app: McpApp, channelId: string, folderNames: string[]): Promise<string | undefined> {
  let currentParentId: string | undefined = undefined;

  for (const folderName of folderNames) {
    if (!folderName) continue;
    
    // 1. Lấy danh sách folder con trong currentParentId
    const args: any = { channelId, limit: 100 };
    if (currentParentId) {
      args.parentId = currentParentId;
    }
    
    const getRes: any = await app.callServerTool({
      name: 'privos.folders.getByChannel',
      arguments: args
    });
    
    let folders: any[] = [];
    try {
      const text = getRes?.content?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        folders = Array.isArray(parsed) ? parsed : (parsed?.folders || []);
      }
    } catch (e) {
      console.error('Failed to parse getByChannel response', e);
    }
    
    const existingFolder = folders.find((f: any) => f.name === folderName);
    
    if (existingFolder && existingFolder._id) {
      currentParentId = existingFolder._id;
    } else {
      // 2. Tạo folder nếu chưa tồn tại
      const createArgs: any = { channelId, name: folderName };
      if (currentParentId) {
        createArgs.parentId = currentParentId;
      }
      const createRes: any = await app.callServerTool({
        name: 'privos.folders.create',
        arguments: createArgs
      });
      
      try {
        const text = createRes?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          currentParentId = parsed?._id;
        }
      } catch (e) {
        console.error('Failed to parse create folder response', e);
      }
      
      if (!currentParentId) {
        throw new Error(`Failed to create folder: ${folderName}`);
      }
    }
  }

  return currentParentId;
}

export async function createOrUpdateFile(app: McpApp, path: string, content: string): Promise<boolean> {
  try {
    // path is expected to be `${roomId}/path/to/file`
    const parts = path.split('/');
    const roomId = parts[0];
    const fileName = parts[parts.length - 1];
    const folderNames = parts.slice(1, parts.length - 1);
    
    // Tự động tạo cây thư mục
    const targetFolderId = await ensureFolderPath(app, roomId, folderNames);
    
    // Xử lý base64 encode chuẩn cho chuỗi UTF-8 (tiếng Việt)
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    
    const uploadArgs: any = {
      channelId: roomId,
      fileName: fileName,
      base64Data: 'data:text/markdown;base64,' + base64Content,
      mimeType: 'text/markdown',
      duplicateAction: 'replace'
    };
    
    if (targetFolderId) {
      uploadArgs.folderId = targetFolderId;
    }
    
    const res: any = await app.uploadFile(uploadArgs);
    
    if (!res) throw new Error("No response from uploadFile");
    return true;
  } catch (err: any) {
    console.error('Failed to create/update file', err);
    throw new Error(`Failed to create/update file: ${err.message || err}`);
  }
}

