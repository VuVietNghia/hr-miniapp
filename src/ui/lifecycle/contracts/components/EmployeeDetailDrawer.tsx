import { useEffect, useMemo, useState } from 'react';
import { usePrivosApp } from '@privos/app-react';
import type {
  AttachSignedDocumentDto,
  ContractEvent,
  ContractSummary,
  EmployeeContract,
} from '../../../../contracts/types';
import type { EmployeeProfile } from '../../types';
import { ensureFolderPath } from '../../../privos-rest';
import { DocxExportService } from '../../../docx-export-service';
import { EmailComposerModal } from '../../components/EmailComposerModal';
import type { ContractBundle } from '../../../../contracts/services/ContractService';
import type { IContractApiClient } from '../services/ContractApiClient';
import { ContractTemplateService } from '../services/ContractTemplateService';
import { ContractForm, ContractFormValue } from './ContractForm';
import { ContractStatusBadge } from './ContractStatusBadge';

type DrawerTab = 'overview' | 'contracts' | 'history';
type FormMode = 'create' | 'edit' | 'renew' | null;

interface EmployeeDetailDrawerProps {
  profile: EmployeeProfile;
  summary?: ContractSummary;
  roomId: string;
  canManageContracts: boolean;
  client: IContractApiClient;
  onClose: () => void;
  onContractsChanged: () => Promise<void>;
}

const STATUS_LABELS: Record<EmployeeContract['status'], string> = {
  DRAFT: 'Nháp',
  PENDING_SIGNATURE: 'Chờ ký',
  ACTIVE: 'Đang hiệu lực',
  TERMINATED: 'Đã chấm dứt',
  CANCELLED: 'Đã hủy',
};

const EVENT_LABELS: Record<ContractEvent['action'], string> = {
  CREATED: 'Tạo hợp đồng',
  UPDATED: 'Cập nhật hợp đồng',
  SUBMITTED_FOR_SIGNATURE: 'Chuyển chờ ký',
  SIGNED_DOCUMENT_ATTACHED: 'Gắn bản ký',
  ACTIVATED: 'Kích hoạt',
  RENEWED: 'Gia hạn',
  TERMINATED: 'Chấm dứt',
  CANCELLED: 'Hủy',
  DOCUMENT_LINK_FAILED: 'Lỗi liên kết tài liệu',
};

export function EmployeeDetailDrawer({
  profile,
  summary,
  roomId,
  canManageContracts,
  client,
  onClose,
  onContractsChanged,
}: EmployeeDetailDrawerProps) {
  const app = usePrivosApp();
  const templateService = useMemo(() => new ContractTemplateService(), []);
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [bundle, setBundle] = useState<ContractBundle | null>(null);
  const [historyEvents, setHistoryEvents] = useState<ContractEvent[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [signedDate, setSignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveDate, setEffectiveDate] = useState('');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [terminationReason, setTerminationReason] = useState('');
  const [showTerminate, setShowTerminate] = useState(false);
  const [emailContract, setEmailContract] = useState<EmployeeContract | null>(null);
  const [pendingDocumentLink, setPendingDocumentLink] = useState<AttachSignedDocumentDto | null>(null);

  const selectedContract = contracts.find(contract => contract._id === selectedContractId) ?? null;

  const loadContracts = async (preferredId?: string) => {
    if (!canManageContracts) return;
    setLoading(true);
    setError('');
    try {
      const data = await client.listByEmployee(roomId, profile._id);
      setContracts(data);
      const nextId = preferredId && data.some(contract => contract._id === preferredId)
        ? preferredId
        : selectedContractId && data.some(contract => contract._id === selectedContractId)
          ? selectedContractId
          : data[0]?._id ?? '';
      setSelectedContractId(nextId);
      if (nextId) setBundle(await client.get(roomId, nextId));
      else setBundle(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContracts();
  }, [profile._id, roomId, canManageContracts]);

  useEffect(() => {
    if (!canManageContracts || !selectedContractId) return;
    client.get(roomId, selectedContractId)
      .then(setBundle)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết hợp đồng.'));
  }, [selectedContractId]);

  useEffect(() => {
    if (tab !== 'history' || !canManageContracts || contracts.length === 0) return;
    Promise.all(contracts.map(contract => client.get(roomId, contract._id)))
      .then(items => setHistoryEvents(items.flatMap(item => item.events).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử hợp đồng.'));
  }, [tab, contracts.length]);

  const runAction = async (action: () => Promise<EmployeeContract>, successMessage: string) => {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const updated = await action();
      setMessage(successMessage);
      setFormMode(null);
      setPreview('');
      setShowTerminate(false);
      await loadContracts(updated._id);
      await onContractsChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể thực hiện thao tác hợp đồng.');
    } finally {
      setWorking(false);
    }
  };

  const createContract = async (value: ContractFormValue) => {
    await runAction(() => client.createDraft({
      ...value,
      roomId,
      employeeId: profile._id,
    }), 'Đã tạo hợp đồng nháp.');
  };

  const updateContract = async (value: ContractFormValue) => {
    if (!selectedContract) return;
    await runAction(() => client.updateDraft({
      ...value,
      roomId,
      contractId: selectedContract._id,
      expectedRevision: selectedContract.revision,
    }), 'Đã cập nhật hợp đồng nháp.');
  };

  const renewContract = async (value: ContractFormValue) => {
    if (!selectedContract) return;
    await runAction(() => client.renew({
      ...value,
      roomId,
      sourceContractId: selectedContract._id,
    }), 'Đã tạo hợp đồng gia hạn ở trạng thái nháp.');
  };

  const exportDraft = async () => {
    if (!selectedContract) return;
    setWorking(true);
    setError('');
    try {
      const markdown = templateService.render(profile, selectedContract);
      const safeNumber = selectedContract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      await DocxExportService.downloadDocx(`HopDong_${safeNumber}_v${selectedContract.revision}.docx`, markdown);
      const updated = await client.submitForSignature(roomId, selectedContract._id);
      setPreview(markdown);
      setMessage('Đã tải DOCX và chuyển hợp đồng sang trạng thái chờ ký.');
      await loadContracts(updated._id);
      await onContractsChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xuất bản nháp.');
    } finally {
      setWorking(false);
    }
  };

  const previewDraft = () => {
    if (!selectedContract) return;
    setPreview(templateService.render(profile, selectedContract));
  };

  const attachUploadedDocument = async (document: AttachSignedDocumentDto) => {
    const updated = await client.attachSignedDocument(document);
    setPendingDocumentLink(null);
    setMessage('Đã gắn bản PDF đã ký.');
    await loadContracts(updated._id);
    await onContractsChanged();
  };

  const uploadSignedPdf = async (file: File) => {
    if (!selectedContract) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Bản hợp đồng đã ký phải là file PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File PDF đã ký không được vượt quá 10 MB.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const safeDepartment = safePathSegment(profile.department || 'KhongPhongBan');
      const safeEmployee = safePathSegment(profile.name);
      const folderId = await ensureFolderPath(app, roomId, [
        'hr-miniapp', 'employees', safeDepartment, safeEmployee, 'contracts', selectedContract._id,
      ]);
      if (!folderId) throw new Error('Không thể tạo thư mục hợp đồng.');
      const base64Data = await fileToDataUrl(file);
      const safeNumber = safePathSegment(selectedContract.contractNumber);
      const nextDocumentVersion = Math.max(
        0,
        ...(bundle?.documents ?? [])
          .filter(document => document.documentType === 'SIGNED')
          .map(document => document.version),
      ) + 1;
      const storedName = `${safeNumber}_${selectedContract._id}_signed_v${nextDocumentVersion}.pdf`;
      const uploadResult = await app.uploadFile({
        channelId: roomId,
        folderId,
        fileName: storedName,
        base64Data,
        mimeType: 'application/pdf',
        duplicateAction: 'keep_both',
      });
      const uploaded = uploadResult?.file ?? uploadResult?.message?.file ?? uploadResult;
      const fileId = uploaded?._id ?? uploaded?.id;
      if (!fileId) throw new Error('PrivOS không trả về ID của file đã upload.');
      const documentLink: AttachSignedDocumentDto = {
        roomId,
        contractId: selectedContract._id,
        fileId,
        fileName: uploaded?.name ?? storedName,
        mimeType: 'application/pdf',
        fileSize: file.size,
        signedDate,
      };
      setPendingDocumentLink(documentLink);
      await attachUploadedDocument(documentLink);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể upload bản hợp đồng đã ký.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <div className="employee-drawer-overlay" onMouseDown={onClose}>
        <aside className="employee-drawer" onMouseDown={event => event.stopPropagation()}>
        <header className="employee-drawer-header">
          <div>
            <h3>{profile.name}</h3>
            <p>{profile.position || 'Chưa có vị trí'} · {profile.department || 'Chưa có phòng ban'}</p>
          </div>
          <button type="button" className="employee-drawer-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <nav className="employee-drawer-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Tổng quan</button>
          {canManageContracts && <button className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}>Hợp đồng</button>}
          {canManageContracts && <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Lịch sử</button>}
        </nav>

        <div className="employee-drawer-body">
          {error && <div className="hr-status-banner hr-status-error">{error}</div>}
          {message && <div className="hr-status-banner hr-status-success">{message}</div>}

          {tab === 'overview' && (
            <section className="employee-overview-grid">
              <div><span>Trạng thái nhân sự</span><strong>{profile.status}</strong></div>
              <div><span>Hợp đồng</span><ContractStatusBadge summary={summary} /></div>
              <div><span>Email</span><strong>{profile.email || 'Chưa cập nhật'}</strong></div>
              <div><span>Số điện thoại</span><strong>{profile.phone || 'Chưa cập nhật'}</strong></div>
              <div><span>Ngày bắt đầu</span><strong>{profile.startDate || 'Chưa cập nhật'}</strong></div>
              {!canManageContracts && (
                <div className="contract-access-note contract-span-2">Chi tiết hợp đồng, lương và tài liệu chỉ dành cho HR quản lý phòng.</div>
              )}
            </section>
          )}

          {tab === 'contracts' && canManageContracts && (
            <section>
              <div className="contract-section-header">
                <h4>Hợp đồng lao động</h4>
                <button className="hr-btn hr-btn-accent" onClick={() => setFormMode('create')}>+ Tạo hợp đồng</button>
              </div>

              {formMode === 'create' && <ContractForm profile={profile} title="Tạo hợp đồng nháp" submitLabel="Tạo nháp" onSubmit={createContract} onCancel={() => setFormMode(null)} />}
              {formMode === 'edit' && selectedContract && <ContractForm profile={profile} initial={selectedContract} title="Chỉnh sửa hợp đồng nháp" submitLabel="Lưu thay đổi" onSubmit={updateContract} onCancel={() => setFormMode(null)} />}
              {formMode === 'renew' && selectedContract && <ContractForm profile={profile} initial={{ ...selectedContract, contractNumber: '', startDate: nextCalendarDate(selectedContract.endDate) ?? selectedContract.startDate, endDate: undefined, status: 'DRAFT' }} title="Tạo hợp đồng gia hạn" submitLabel="Tạo bản gia hạn" onSubmit={renewContract} onCancel={() => setFormMode(null)} />}

              {loading ? <div className="kanban-loading"><div className="spinner" /><p>Đang tải hợp đồng...</p></div> : contracts.length === 0 ? (
                <div className="contract-empty">Nhân sự chưa có hợp đồng lao động.</div>
              ) : (
                <div className="contract-layout">
                  <div className="contract-list">
                    {contracts.map(contract => (
                      <button key={contract._id} className={contract._id === selectedContractId ? 'active' : ''} onClick={() => setSelectedContractId(contract._id)}>
                        <strong>{contract.contractNumber}</strong>
                        <span>{STATUS_LABELS[contract.status]} · {contract.startDate}{contract.endDate ? ` → ${contract.endDate}` : ''}</span>
                      </button>
                    ))}
                  </div>
                  {selectedContract && (
                    <div className="contract-detail-panel">
                      <div className="contract-detail-heading"><h4>{selectedContract.contractNumber}</h4><span>{STATUS_LABELS[selectedContract.status]}</span></div>
                      <dl>
                        <div><dt>Loại</dt><dd>{selectedContract.contractType === 'FIXED_TERM' ? 'Xác định thời hạn' : 'Không xác định thời hạn'}</dd></div>
                        <div><dt>Thời hạn</dt><dd>{selectedContract.startDate}{selectedContract.endDate ? ` - ${selectedContract.endDate}` : ' - Không xác định'}</dd></div>
                        <div><dt>Vị trí</dt><dd>{selectedContract.position}</dd></div>
                        <div><dt>Lương</dt><dd>{selectedContract.baseSalary.toLocaleString('vi-VN')} VND</dd></div>
                        <div><dt>Địa điểm</dt><dd>{selectedContract.workLocation}</dd></div>
                        <div><dt>Revision</dt><dd>{selectedContract.revision}</dd></div>
                      </dl>

                      <div className="contract-action-row">
                        {selectedContract.status === 'DRAFT' && <button className="hr-btn" onClick={() => setFormMode('edit')}>Chỉnh sửa</button>}
                        {selectedContract.status === 'DRAFT' && <button className="hr-btn" onClick={previewDraft}>Xem trước</button>}
                        {selectedContract.status === 'DRAFT' && <button className="hr-btn hr-btn-accent" onClick={exportDraft} disabled={working}>Tải DOCX & chuyển chờ ký</button>}
                        {selectedContract.status === 'PENDING_SIGNATURE' && (
                          <label className="hr-btn hr-btn-accent contract-upload-button">
                            Upload PDF đã ký
                            <input type="file" accept="application/pdf,.pdf" disabled={working} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadSignedPdf(file); event.target.value = ''; }} />
                          </label>
                        )}
                        {selectedContract.status === 'PENDING_SIGNATURE' && pendingDocumentLink?.contractId === selectedContract._id && (
                          <button className="hr-btn" disabled={working} onClick={() => void runAction(
                            async () => {
                              const updated = await client.attachSignedDocument(pendingDocumentLink);
                              setPendingDocumentLink(null);
                              return updated;
                            },
                            'Đã liên kết lại file PDF đã upload.',
                          )}>Thử liên kết lại file đã upload</button>
                        )}
                        {selectedContract.status === 'PENDING_SIGNATURE' && (
                          <label className="contract-date-field">Ngày ký<input type="date" value={signedDate} onChange={event => setSignedDate(event.target.value)} /></label>
                        )}
                        {selectedContract.status === 'PENDING_SIGNATURE' && selectedContract.currentSignedFileId && (
                          <>
                            <label className="contract-date-field">Ngày hiệu lực<input type="date" value={effectiveDate || selectedContract.startDate} onChange={event => setEffectiveDate(event.target.value)} /></label>
                            <button className="hr-btn hr-btn-accent" disabled={working} onClick={() => void runAction(() => client.activate({ roomId, contractId: selectedContract._id, effectiveDate: effectiveDate || selectedContract.startDate }), 'Đã kích hoạt hợp đồng.')}>Kích hoạt</button>
                          </>
                        )}
                        {selectedContract.status === 'ACTIVE' && <button className="hr-btn" onClick={() => setFormMode('renew')}>Gia hạn</button>}
                        {selectedContract.status === 'ACTIVE' && <button className="hr-btn" onClick={() => setShowTerminate(value => !value)}>Chấm dứt</button>}
                        {['DRAFT', 'PENDING_SIGNATURE'].includes(selectedContract.status) && <button className="hr-btn" disabled={working} onClick={() => void runAction(() => client.cancel(roomId, selectedContract._id), 'Đã hủy hợp đồng.')}>Hủy hợp đồng</button>}
                        {profile.email && <button className="hr-btn" onClick={() => setEmailContract(selectedContract)}>Gửi email</button>}
                      </div>

                      {showTerminate && selectedContract.status === 'ACTIVE' && (
                        <div className="contract-terminate-panel">
                          <label>Ngày chấm dứt<input className="hr-input" type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} /></label>
                          <label>Lý do<textarea className="hr-input" value={terminationReason} onChange={e => setTerminationReason(e.target.value)} /></label>
                          <button className="hr-btn hr-btn-accent" disabled={!terminationReason.trim() || working} onClick={() => void runAction(() => client.terminate({ roomId, contractId: selectedContract._id, terminationDate, reason: terminationReason }), 'Đã chấm dứt hợp đồng.')}>Xác nhận chấm dứt</button>
                        </div>
                      )}

                      {bundle?.documents.length ? (
                        <div className="contract-documents"><h5>Tài liệu</h5>{bundle.documents.map(document => (
                          <a key={document._id} href={`/group/${roomId}/file-viewer/${document.fileId}`} target="_blank" rel="noreferrer">{document.fileName} · v{document.version}</a>
                        ))}</div>
                      ) : null}
                      {preview && <div className="contract-preview"><h5>Bản nháp đã xuất</h5><pre>{preview}</pre></div>}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === 'history' && canManageContracts && (
            <section>
              <h4>Lịch sử hợp đồng</h4>
              {historyEvents.length === 0 ? <div className="contract-empty">Chưa có lịch sử hợp đồng.</div> : (
                <div className="contract-history-list">{historyEvents.map(event => (
                  <article key={event._id}><strong>{EVENT_LABELS[event.action]}</strong><span>{event.detail}</span><time>{new Date(event.occurredAt).toLocaleString('vi-VN')}</time></article>
                ))}</div>
              )}
            </section>
          )}
        </div>
        </aside>
      </div>

      {emailContract && (
        <EmailComposerModal
          isOpen
          onClose={() => setEmailContract(null)}
          profile={profile}
          contractContext={{
            contractNumber: emailContract.contractNumber,
            contractType: emailContract.contractType === 'FIXED_TERM' ? 'Hợp đồng xác định thời hạn' : 'Hợp đồng không xác định thời hạn',
            startDate: emailContract.startDate,
            endDate: emailContract.endDate,
            signedDate: emailContract.signedDate,
          }}
        />
      )}
    </>
  );
}

function safePathSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'KhongXacDinh';
}

function nextCalendarDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không thể đọc file PDF.'));
    reader.onerror = () => reject(new Error('Không thể đọc file PDF.'));
    reader.readAsDataURL(file);
  });
}
