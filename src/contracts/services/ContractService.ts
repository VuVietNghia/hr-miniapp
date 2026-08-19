import { ContractError } from '../errors';
import { IContractRepository, NewContract } from '../repositories/IContractRepository';
import {
  ActivateContractDto,
  AttachSignedDocumentDto,
  ContractActorContext,
  ContractDocument,
  ContractEvent,
  ContractEventAction,
  ContractExpiryBucket,
  ContractSummary,
  CreateContractDto,
  EmployeeContract,
  RenewContractDto,
  TerminateContractDto,
  UpdateDraftContractDto,
} from '../types';
import { IContractAuthorizationService } from './ContractAuthorizationService';
import { IContractDocumentStore } from './ContractDocumentStore';

export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }
}

export interface ContractBundle {
  contract: EmployeeContract;
  documents: ContractDocument[];
  events: ContractEvent[];
}

export interface IContractService {
  getSummaries(roomId: string, employeeIds: string[], actor: ContractActorContext): Promise<ContractSummary[]>;
  listByEmployee(roomId: string, employeeId: string, actor: ContractActorContext): Promise<EmployeeContract[]>;
  get(roomId: string, contractId: string, actor: ContractActorContext): Promise<ContractBundle>;
  createDraft(dto: CreateContractDto, actor: ContractActorContext): Promise<EmployeeContract>;
  updateDraft(dto: UpdateDraftContractDto, actor: ContractActorContext): Promise<EmployeeContract>;
  submitForSignature(roomId: string, contractId: string, actor: ContractActorContext): Promise<EmployeeContract>;
  attachSignedDocument(dto: AttachSignedDocumentDto, actor: ContractActorContext): Promise<EmployeeContract>;
  activate(dto: ActivateContractDto, actor: ContractActorContext): Promise<EmployeeContract>;
  renew(dto: RenewContractDto, actor: ContractActorContext): Promise<EmployeeContract>;
  terminate(dto: TerminateContractDto, actor: ContractActorContext): Promise<EmployeeContract>;
  cancel(roomId: string, contractId: string, actor: ContractActorContext): Promise<EmployeeContract>;
}

export class ContractService implements IContractService {
  public constructor(
    private readonly repository: IContractRepository,
    private readonly documentStore: IContractDocumentStore,
    private readonly authorization: IContractAuthorizationService,
    private readonly clock: IClock,
  ) {}

  public async getSummaries(
    roomId: string,
    employeeIds: string[],
    actor: ContractActorContext,
  ): Promise<ContractSummary[]> {
    this.authorization.requireTrustedRoom(actor, roomId);
    await this.repository.initializeSchemas();
    const contracts = await this.repository.listByEmployeeIds(roomId, employeeIds);
    const byEmployee = new Map<string, EmployeeContract[]>();
    for (const contract of contracts) {
      const current = byEmployee.get(contract.employeeId) ?? [];
      current.push(contract);
      byEmployee.set(contract.employeeId, current);
    }
    return employeeIds.map(employeeId => this.buildSummary(employeeId, byEmployee.get(employeeId) ?? []));
  }

  public async listByEmployee(
    roomId: string,
    employeeId: string,
    actor: ContractActorContext,
  ): Promise<EmployeeContract[]> {
    this.authorization.requireManager(actor, roomId);
    await this.repository.initializeSchemas();
    return this.repository.listByEmployee(roomId, employeeId);
  }

  public async get(roomId: string, contractId: string, actor: ContractActorContext): Promise<ContractBundle> {
    this.authorization.requireManager(actor, roomId);
    const contract = await this.requireContract(roomId, contractId);
    const [documents, events] = await Promise.all([
      this.documentStore.list(roomId, contractId),
      this.repository.listEvents(roomId, contractId),
    ]);
    return { contract, documents, events };
  }

  public async createDraft(dto: CreateContractDto, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    await this.repository.initializeSchemas();
    const duplicate = await this.repository.findByNumber(dto.roomId, dto.contractNumber);
    if (duplicate) {
      throw new ContractError('CONTRACT_NUMBER_EXISTS', 'Số hợp đồng đã tồn tại trong phòng này.', 409);
    }

    const contract: NewContract = {
      ...dto,
      currency: 'VND',
      status: 'DRAFT',
      revision: 1,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    };
    const created = await this.repository.create(contract);
    await this.recordEvent(created, 'CREATED', actor.userId, 'Tạo hợp đồng nháp.');
    return created;
  }

  public async updateDraft(dto: UpdateDraftContractDto, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    const existing = await this.requireContract(dto.roomId, dto.contractId);
    if (existing.status !== 'DRAFT') {
      throw new ContractError('CONTRACT_IMMUTABLE', 'Chỉ hợp đồng nháp mới được chỉnh sửa.', 409);
    }
    if (existing.revision !== dto.expectedRevision) {
      throw new ContractError('CONTRACT_VERSION_CONFLICT', 'Hợp đồng đã được cập nhật ở phiên làm việc khác.', 409);
    }
    const duplicate = await this.repository.findByNumber(dto.roomId, dto.contractNumber);
    if (duplicate && duplicate._id !== existing._id) {
      throw new ContractError('CONTRACT_NUMBER_EXISTS', 'Số hợp đồng đã tồn tại trong phòng này.', 409);
    }

    const updated = await this.repository.update(dto.roomId, dto.contractId, {
      contractNumber: dto.contractNumber,
      contractType: dto.contractType,
      startDate: dto.startDate,
      endDate: dto.contractType === 'INDEFINITE' ? null : dto.endDate,
      position: dto.position,
      department: dto.department,
      workLocation: dto.workLocation,
      baseSalary: dto.baseSalary,
      revision: existing.revision + 1,
      updatedBy: actor.userId,
    });
    await this.recordEvent(updated, 'UPDATED', actor.userId, `Cập nhật bản nháp revision ${updated.revision}.`);
    return updated;
  }

  public async submitForSignature(
    roomId: string,
    contractId: string,
    actor: ContractActorContext,
  ): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, roomId);
    const existing = await this.requireContract(roomId, contractId);
    if (existing.status !== 'DRAFT') {
      throw new ContractError('INVALID_CONTRACT_STATUS', 'Chỉ hợp đồng nháp mới có thể chuyển sang chờ ký.', 409);
    }
    const updated = await this.repository.update(roomId, contractId, {
      status: 'PENDING_SIGNATURE',
      revision: existing.revision + 1,
      updatedBy: actor.userId,
    });
    await this.recordEvent(updated, 'SUBMITTED_FOR_SIGNATURE', actor.userId, 'Xuất bản nháp và chuyển sang chờ ký.');
    return updated;
  }

  public async attachSignedDocument(
    dto: AttachSignedDocumentDto,
    actor: ContractActorContext,
  ): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    const existing = await this.requireContract(dto.roomId, dto.contractId);
    if (existing.status !== 'PENDING_SIGNATURE') {
      throw new ContractError('INVALID_CONTRACT_STATUS', 'Hợp đồng phải ở trạng thái chờ ký trước khi gắn bản ký.', 409);
    }
    const documents = await this.documentStore.list(dto.roomId, dto.contractId);
    const nextVersion = Math.max(0, ...documents.filter(doc => doc.documentType === 'SIGNED').map(doc => doc.version)) + 1;

    try {
      await this.documentStore.attach({
        roomId: dto.roomId,
        contractId: dto.contractId,
        documentType: 'SIGNED',
        version: nextVersion,
        fileId: dto.fileId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedBy: actor.userId,
        uploadedAt: this.clock.now().toISOString(),
      });
      const updated = await this.repository.update(dto.roomId, dto.contractId, {
        signedDate: dto.signedDate,
        currentSignedFileId: dto.fileId,
        currentSignedFileName: dto.fileName,
        revision: existing.revision + 1,
        updatedBy: actor.userId,
      });
      await this.recordEvent(updated, 'SIGNED_DOCUMENT_ATTACHED', actor.userId, `Gắn bản ký PDF version ${nextVersion}.`);
      return updated;
    } catch (error) {
      await this.recordEvent(
        existing,
        'DOCUMENT_LINK_FAILED',
        actor.userId,
        `Không thể liên kết file ${dto.fileId}; file được giữ lại để retry.`,
      ).catch(() => undefined);
      throw error;
    }
  }

  public async activate(dto: ActivateContractDto, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    const existing = await this.requireContract(dto.roomId, dto.contractId);
    if (existing.status !== 'PENDING_SIGNATURE' || !existing.currentSignedFileId || !existing.signedDate) {
      throw new ContractError('CONTRACT_NOT_SIGNED', 'Hợp đồng phải có bản PDF đã ký trước khi kích hoạt.', 409);
    }
    if (dto.effectiveDate < existing.startDate || (existing.endDate && dto.effectiveDate > existing.endDate)) {
      throw new ContractError('INVALID_EFFECTIVE_DATE', 'Ngày hiệu lực phải nằm trong thời hạn hợp đồng.');
    }
    const activeContracts = await this.repository.listActiveByEmployee(dto.roomId, existing.employeeId);
    if (activeContracts.some(contract => contract._id !== existing._id && this.overlaps(existing, contract))) {
      throw new ContractError('CONTRACT_DATE_OVERLAP', 'Nhân sự đã có hợp đồng đang hiệu lực chồng thời gian.', 409);
    }
    const updated = await this.repository.update(dto.roomId, dto.contractId, {
      status: 'ACTIVE',
      effectiveDate: dto.effectiveDate,
      revision: existing.revision + 1,
      updatedBy: actor.userId,
    });
    await this.recordEvent(updated, 'ACTIVATED', actor.userId, `Kích hoạt từ ngày ${dto.effectiveDate}.`);
    return updated;
  }

  public async renew(dto: RenewContractDto, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    const source = await this.requireContract(dto.roomId, dto.sourceContractId);
    if (source.status !== 'ACTIVE') {
      throw new ContractError('INVALID_CONTRACT_STATUS', 'Chỉ hợp đồng đang hiệu lực mới được gia hạn.', 409);
    }
    const created = await this.createDraft({
      roomId: dto.roomId,
      employeeId: source.employeeId,
      contractNumber: dto.contractNumber,
      contractType: dto.contractType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      position: dto.position,
      department: dto.department,
      workLocation: dto.workLocation,
      baseSalary: dto.baseSalary,
      previousContractId: source._id,
    }, actor);
    await this.recordEvent(source, 'RENEWED', actor.userId, `Tạo hợp đồng gia hạn ${created._id}.`);
    return created;
  }

  public async terminate(dto: TerminateContractDto, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, dto.roomId);
    const existing = await this.requireContract(dto.roomId, dto.contractId);
    if (existing.status !== 'ACTIVE') {
      throw new ContractError('INVALID_CONTRACT_STATUS', 'Chỉ hợp đồng đang hiệu lực mới được chấm dứt.', 409);
    }
    if (dto.terminationDate < (existing.effectiveDate ?? existing.startDate)) {
      throw new ContractError('INVALID_TERMINATION_DATE', 'Ngày chấm dứt không được trước ngày hiệu lực.');
    }
    const updated = await this.repository.update(dto.roomId, dto.contractId, {
      status: 'TERMINATED',
      terminationDate: dto.terminationDate,
      terminationReason: dto.reason,
      revision: existing.revision + 1,
      updatedBy: actor.userId,
    });
    await this.recordEvent(updated, 'TERMINATED', actor.userId, `Chấm dứt ngày ${dto.terminationDate}: ${dto.reason}`);
    return updated;
  }

  public async cancel(roomId: string, contractId: string, actor: ContractActorContext): Promise<EmployeeContract> {
    this.authorization.requireManager(actor, roomId);
    const existing = await this.requireContract(roomId, contractId);
    if (!['DRAFT', 'PENDING_SIGNATURE'].includes(existing.status)) {
      throw new ContractError('INVALID_CONTRACT_STATUS', 'Chỉ hợp đồng nháp hoặc chờ ký mới được hủy.', 409);
    }
    const updated = await this.repository.update(roomId, contractId, {
      status: 'CANCELLED',
      revision: existing.revision + 1,
      updatedBy: actor.userId,
    });
    await this.recordEvent(updated, 'CANCELLED', actor.userId, 'Hủy hợp đồng trước khi kích hoạt.');
    return updated;
  }

  private async requireContract(roomId: string, contractId: string): Promise<EmployeeContract> {
    await this.repository.initializeSchemas();
    const contract = await this.repository.getById(roomId, contractId);
    if (!contract) throw new ContractError('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng.', 404);
    return contract;
  }

  private async recordEvent(
    contract: EmployeeContract,
    action: ContractEventAction,
    actorUserId: string,
    detail: string,
  ): Promise<void> {
    await this.repository.createEvent({
      roomId: contract.roomId,
      contractId: contract._id,
      action,
      actorUserId,
      detail,
      occurredAt: this.clock.now().toISOString(),
    });
  }

  private overlaps(left: EmployeeContract, right: EmployeeContract): boolean {
    const leftEnd = left.endDate ?? '9999-12-31';
    const rightEnd = right.endDate ?? '9999-12-31';
    return left.startDate <= rightEnd && right.startDate <= leftEnd;
  }

  private buildSummary(employeeId: string, contracts: EmployeeContract[]): ContractSummary {
    if (contracts.length === 0) {
      return { employeeId, status: 'NONE', expiryBucket: 'NONE' };
    }
    const statusRank: Record<EmployeeContract['status'], number> = {
      ACTIVE: 5,
      PENDING_SIGNATURE: 4,
      DRAFT: 3,
      TERMINATED: 2,
      CANCELLED: 1,
    };
    const selected = [...contracts].sort((left, right) => {
      const rankDiff = statusRank[right.status] - statusRank[left.status];
      return rankDiff || right.startDate.localeCompare(left.startDate);
    })[0];
    const expiry = this.getExpiry(selected.endDate);
    return {
      employeeId,
      contractId: selected._id,
      contractType: selected.contractType,
      status: selected.status,
      startDate: selected.startDate,
      endDate: selected.endDate,
      daysUntilExpiry: expiry.daysUntilExpiry,
      expiryBucket: expiry.bucket,
    };
  }

  private getExpiry(endDate?: string): { bucket: ContractExpiryBucket; daysUntilExpiry?: number } {
    if (!endDate) return { bucket: 'NONE' };
    const today = this.clock.now().toISOString().slice(0, 10);
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const daysUntilExpiry = Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / millisecondsPerDay,
    );
    if (endDate < today) return { bucket: 'EXPIRED', daysUntilExpiry };
    if (daysUntilExpiry <= 7) return { bucket: 'DUE_7', daysUntilExpiry };
    if (daysUntilExpiry <= 15) return { bucket: 'DUE_15', daysUntilExpiry };
    if (daysUntilExpiry <= 30) return { bucket: 'DUE_30', daysUntilExpiry };
    return { bucket: 'NONE', daysUntilExpiry };
  }
}
