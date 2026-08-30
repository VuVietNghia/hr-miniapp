import { useMemo, useState, type FormEvent } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos_ai/app-react';
import type { FilesClient, FoldersClient } from './platform/contracts';
import { createRoomClients } from './platform/create-room-clients';
import { FEATURE_DEGRADED_BEHAVIOR, type FeatureCapabilities } from './access/feature-capabilities';

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc tài liệu.'));
    reader.readAsDataURL(file);
  });
}

export class CompanyWorkspaceService {
  constructor(private readonly files: FilesClient, private readonly folders: FoldersClient) {}

  get uploadAvailable(): boolean {
    return this.files.capabilities.folderScopedWrite && this.folders.capabilities.ensurePath;
  }

  get websiteCrawlAvailable(): boolean {
    return false;
  }

  async upload(roomId: string, documents: readonly File[]): Promise<void> {
    if (!this.uploadAvailable) throw new Error('Upload dữ liệu công ty theo thư mục không khả dụng.');
    const folder = await this.folders.ensurePath(roomId, ['hr-miniapp', 'company']);
    for (const document of documents) {
      await this.files.uploadToFolder({
        roomId, folderId: folder._id, fileName: document.name,
        base64Data: await readAsDataUri(document),
        mimeType: document.type || 'application/octet-stream',
      });
    }
  }

  async crawlWebsite(): Promise<never> {
    throw new Error('AI generation cho website chưa được xác minh và đang tắt.');
  }
}

export interface CompanyHomeProps {
  capabilities: FeatureCapabilities;
}

export default function CompanyHome({ capabilities }: CompanyHomeProps) {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const service = useMemo(() => {
    if (!app) return null;
    const clients = createRoomClients(app);
    return new CompanyWorkspaceService(clients.files, clients.folders);
  }, [app]);
  const [website, setWebsite] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleCrawl = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || !roomId || !website.trim() || !capabilities.draftingAvailable || !capabilities.aiChatReadable || !capabilities.aiChatWritable) return;
    setBusy(true);
    try { await service.crawlWebsite(); } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể đọc website.');
    } finally { setBusy(false); }
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || !roomId || selectedFiles.length === 0 || !capabilities.filesWritable) return;
    setBusy(true); setError('');
    try {
      await service.upload(roomId, selectedFiles);
      setStatus(`Đã tải ${selectedFiles.length} tài liệu vào RoomFiles/hr-miniapp/company.`);
      setSelectedFiles([]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải tài liệu.');
    } finally { setBusy(false); }
  };

  if (!service || !roomId) return <main className="hr-terminal-ui">Đang kết nối đến PrivOS...</main>;
  const uploadAvailable = capabilities.filesWritable && service.uploadAvailable;
  const websiteCrawlAvailable = capabilities.draftingAvailable
    && capabilities.aiChatReadable
    && capabilities.aiChatWritable
    && service.websiteCrawlAvailable;
  const degraded = !uploadAvailable || !websiteCrawlAvailable;
  return (
    <main className="hr-terminal-ui" style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <header className="hr-header-block"><h1 className="hr-title">Dữ liệu Công ty</h1><p className="hr-subtitle">Dữ liệu được lưu đúng tại RoomFiles/hr-miniapp/company.</p></header>
      {degraded && <div className="hr-status-banner hr-status-error">Một số thao tác đang tắt vì folder/AI generation chưa được xác minh.</div>}
      {!capabilities.filesWritable && <div className="hr-status-banner hr-status-error">{FEATURE_DEGRADED_BEHAVIOR.filesWritable}</div>}
      {status && <div className="hr-status-banner hr-status-success">{status}</div>}
      {error && <div className="hr-status-banner hr-status-error">{error}</div>}
      <section className="hr-form-panel">
        <h2>1. Thu thập dữ liệu từ Website</h2>
        <form onSubmit={handleCrawl}>
          <input type="url" className="hr-input" value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://company.com" />
          <button type="submit" className="hr-btn hr-btn-accent" disabled={busy || !websiteCrawlAvailable}>Đọc & Lưu dữ liệu</button>
        </form>
      </section>
      <section className="hr-form-panel">
        <h2>2. Tải lên tài liệu</h2>
        <form onSubmit={handleUpload}>
          <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx" onChange={event => setSelectedFiles(Array.from(event.target.files || []))} />
          <button type="submit" className="hr-btn hr-btn-accent" disabled={busy || selectedFiles.length === 0 || !uploadAvailable}>Tải lên tài liệu</button>
        </form>
      </section>
    </main>
  );
}
