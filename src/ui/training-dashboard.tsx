import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos_ai/app-react';
import type { FilesClient, FoldersClient } from './platform/contracts';
import { createRoomClients } from './platform/create-room-clients';

export interface DocFile { _id: string; name: string; size?: number }

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc file.'));
    reader.readAsDataURL(file);
  });
}

export class TrainingRoomService {
  constructor(private readonly files: FilesClient, private readonly folders: FoldersClient) {}

  get available(): boolean {
    return this.files.capabilities.folderScopedRead
      && this.files.capabilities.folderScopedWrite
      && this.folders.capabilities.findByPath
      && this.folders.capabilities.ensurePath;
  }

  async load(roomId: string): Promise<DocFile[]> {
    if (!this.files.capabilities.folderScopedRead || !this.folders.capabilities.findByPath) {
      throw new Error('Đọc tài liệu đào tạo theo thư mục không khả dụng.');
    }
    const folder = await this.folders.findByPath(roomId, ['hr-miniapp', 'dao-tao']);
    if (!folder) return [];
    return (await this.files.listFolderFiles(roomId, folder._id)).map(file => ({
      _id: file._id,
      name: file.name,
      ...(file.size === undefined ? {} : { size: file.size }),
    }));
  }

  async upload(roomId: string, inputFiles: FileList | File[]): Promise<void> {
    if (!this.files.capabilities.folderScopedWrite || !this.folders.capabilities.ensurePath) {
      throw new Error('Upload tài liệu đào tạo theo thư mục không khả dụng.');
    }
    const folder = await this.folders.ensurePath(roomId, ['hr-miniapp', 'dao-tao']);
    await Promise.all(Array.from(inputFiles).map(async file => {
      await this.files.uploadToFolder({
        roomId,
        folderId: folder._id,
        fileName: file.name,
        base64Data: await readAsDataUri(file),
        mimeType: file.type || 'text/markdown',
      });
    }));
  }
}

export default function TrainingDashboard() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const service = useMemo(() => {
    if (!app) return null;
    const clients = createRoomClients(app);
    return new TrainingRoomService(clients.files, clients.folders);
  }, [app]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!service || !roomId) return;
    setLoading(true);
    try {
      setDocs(await service.load(roomId));
      setStatus('');
    } catch (error: unknown) {
      setDocs([]);
      setStatus(error instanceof Error ? error.message : 'Không thể tải tài liệu đào tạo.');
    } finally {
      setLoading(false);
    }
  }, [roomId, service]);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!service || !roomId || !selected?.length) return;
    setUploading(true);
    try {
      await service.upload(roomId, selected);
      setStatus(`Tải lên thành công ${selected.length} file.`);
      await load();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Không thể tải file.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (!app || !roomId || !service) return <div style={{ padding: 40, textAlign: 'center' }}>Đang kết nối đến PrivOS...</div>;

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h2>Tài Liệu Hướng Dẫn</h2>
        <p>Quản lý tài liệu hướng dẫn và onboarding trong Room hiện tại.</p>
      </header>
      {status && <div className="hr-status-banner hr-status-error">{status}</div>}
      <section className="hr-form-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Thư viện Tài liệu</h3>
          <label className="primary-btn" style={{ cursor: service.available ? 'pointer' : 'not-allowed' }}>
            {uploading ? 'Đang tải...' : 'Upload Files (.md, .pdf)'}
            <input ref={inputRef} type="file" multiple accept=".md,.pdf,.docx,.txt" disabled={uploading || !service.available} onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
        {loading ? <p>Đang tải danh sách...</p> : docs.length === 0 ? <p>Chưa có tài liệu nào trong thư mục dao-tao.</p> : docs.map(doc => (
          <div key={doc._id}>📄 {doc.name}{doc.size ? ` (${Math.round(doc.size / 1024)} KB)` : ''}</div>
        ))}
      </section>
    </div>
  );
}
