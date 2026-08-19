import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractPatch, IContractRepository, NewContract, NewContractDocument, NewContractEvent } from '../src/contracts/repositories/IContractRepository';
import { ContractAuthorizationService } from '../src/contracts/services/ContractAuthorizationService';
import { IContractDocumentStore, RepositoryContractDocumentStore } from '../src/contracts/services/ContractDocumentStore';
import { ContractService, IClock } from '../src/contracts/services/ContractService';
import { ContractActorContext, ContractDocument, ContractEvent, CreateContractDto, EmployeeContract } from '../src/contracts/types';

const manager: ContractActorContext = {
  userId: 'owner-1',
  roomId: 'room-1',
  userRoles: ['owner'],
  trusted: true,
};
const member: ContractActorContext = {
  userId: 'member-1',
  roomId: 'room-1',
  userRoles: ['member'],
  trusted: true,
};
const untrusted: ContractActorContext = { userId: '', roomId: '', userRoles: [], trusted: false };

class FixedClock implements IClock {
  public now(): Date {
    return new Date('2026-08-19T00:00:00.000Z');
  }
}

class InMemoryContractRepository implements IContractRepository {
  public initialized = 0;
  public contracts: EmployeeContract[] = [];
  public documents: ContractDocument[] = [];
  public events: ContractEvent[] = [];

  public async initializeSchemas(): Promise<void> { this.initialized += 1; }
  public async listByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]> {
    return this.contracts.filter(item => item.roomId === roomId && item.employeeId === employeeId);
  }
  public async listByEmployeeIds(roomId: string, employeeIds: string[]): Promise<EmployeeContract[]> {
    return this.contracts.filter(item => item.roomId === roomId && employeeIds.includes(item.employeeId));
  }
  public async getById(roomId: string, contractId: string): Promise<EmployeeContract | null> {
    return this.contracts.find(item => item.roomId === roomId && item._id === contractId) ?? null;
  }
  public async findByNumber(roomId: string, contractNumber: string): Promise<EmployeeContract | null> {
    return this.contracts.find(item => item.roomId === roomId && item.contractNumber === contractNumber) ?? null;
  }
  public async listActiveByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]> {
    return this.contracts.filter(item => item.roomId === roomId && item.employeeId === employeeId && item.status === 'ACTIVE');
  }
  public async create(contract: NewContract): Promise<EmployeeContract> {
    const created: EmployeeContract = { ...contract, _id: `contract-${this.contracts.length + 1}` };
    this.contracts.push(created);
    return { ...created };
  }
  public async update(roomId: string, contractId: string, data: ContractPatch): Promise<EmployeeContract> {
    const index = this.contracts.findIndex(item => item.roomId === roomId && item._id === contractId);
    if (index < 0) throw new Error('not found');
    this.contracts[index] = {
      ...this.contracts[index],
      ...data,
      endDate: data.endDate === null ? undefined : (data.endDate ?? this.contracts[index].endDate),
    };
    return { ...this.contracts[index] };
  }
  public async createDocument(document: NewContractDocument): Promise<ContractDocument> {
    const created: ContractDocument = { ...document, _id: `document-${this.documents.length + 1}` };
    this.documents.push(created);
    return { ...created };
  }
  public async listDocuments(roomId: string, contractId: string): Promise<ContractDocument[]> {
    return this.documents.filter(item => item.roomId === roomId && item.contractId === contractId);
  }
  public async createEvent(event: NewContractEvent): Promise<ContractEvent> {
    const created: ContractEvent = { ...event, _id: `event-${this.events.length + 1}` };
    this.events.push(created);
    return { ...created };
  }
  public async listEvents(roomId: string, contractId: string): Promise<ContractEvent[]> {
    return this.events.filter(item => item.roomId === roomId && item.contractId === contractId);
  }
}

function createHarness() {
  const repository = new InMemoryContractRepository();
  const service = new ContractService(
    repository,
    new RepositoryContractDocumentStore(repository),
    new ContractAuthorizationService(),
    new FixedClock(),
  );
  return { repository, service };
}

function draft(contractNumber: string, overrides: Partial<CreateContractDto> = {}): CreateContractDto {
  return {
    roomId: 'room-1',
    employeeId: 'employee-1',
    contractNumber,
    contractType: 'FIXED_TERM',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    position: 'Developer',
    department: 'IT',
    workLocation: 'Hà Nội',
    baseSalary: 20_000_000,
    ...overrides,
  };
}

async function activate(service: ContractService, contract: EmployeeContract): Promise<EmployeeContract> {
  await service.submitForSignature('room-1', contract._id, manager);
  await service.attachSignedDocument({
    roomId: 'room-1',
    contractId: contract._id,
    fileId: `file-${contract._id}`,
    fileName: `${contract._id}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 2048,
    signedDate: '2026-08-20',
  }, manager);
  return service.activate({ roomId: 'room-1', contractId: contract._id, effectiveDate: contract.startDate }, manager);
}

test('fails closed without trusted actor and exposes only summaries to members', async () => {
  const { service } = createHarness();
  await assert.rejects(service.getSummaries('room-1', ['employee-1'], untrusted), { errorCode: 'CONTRACT_CONTEXT_REQUIRED' });
  const summaries = await service.getSummaries('room-1', ['employee-1'], member);
  assert.deepEqual(summaries, [{ employeeId: 'employee-1', status: 'NONE', expiryBucket: 'NONE' }]);
  await assert.rejects(service.listByEmployee('room-1', 'employee-1', member), { errorCode: 'CONTRACT_ACCESS_DENIED' });
});

test('enforces uniqueness, signed activation and immutable active contracts', async () => {
  const { repository, service } = createHarness();
  const created = await service.createDraft(draft('HD-001'), manager);
  await assert.rejects(service.createDraft(draft('HD-001'), manager), { errorCode: 'CONTRACT_NUMBER_EXISTS' });
  await assert.rejects(
    service.activate({ roomId: 'room-1', contractId: created._id, effectiveDate: created.startDate }, manager),
    { errorCode: 'CONTRACT_NOT_SIGNED' },
  );
  const active = await activate(service, created);
  assert.equal(active.status, 'ACTIVE');
  assert.equal(repository.documents[0].version, 1);
  await assert.rejects(service.updateDraft({
    ...draft('HD-001'),
    contractId: active._id,
    expectedRevision: active.revision,
  }, manager), { errorCode: 'CONTRACT_IMMUTABLE' });
});

test('clears the end date when a draft changes to indefinite', async () => {
  const { service } = createHarness();
  const created = await service.createDraft(draft('HD-INDEFINITE'), manager);
  const updated = await service.updateDraft({
    roomId: 'room-1',
    contractId: created._id,
    contractNumber: created.contractNumber,
    contractType: 'INDEFINITE',
    startDate: created.startDate,
    position: created.position,
    department: created.department,
    workLocation: created.workLocation,
    baseSalary: created.baseSalary,
    expectedRevision: created.revision,
  }, manager);

  assert.equal(updated.contractType, 'INDEFINITE');
  assert.equal(updated.endDate, undefined);
});

test('blocks overlapping active contracts and links renewal to source', async () => {
  const { service } = createHarness();
  const first = await service.createDraft(draft('HD-001'), manager);
  const firstActive = await activate(service, first);
  const overlapping = await service.createDraft(draft('HD-002', {
    startDate: '2027-01-01',
    endDate: '2027-12-31',
  }), manager);
  await service.submitForSignature('room-1', overlapping._id, manager);
  await service.attachSignedDocument({
    roomId: 'room-1', contractId: overlapping._id, fileId: 'file-2', fileName: 'HD-002.pdf',
    mimeType: 'application/pdf', fileSize: 1024, signedDate: '2026-12-20',
  }, manager);
  await assert.rejects(
    service.activate({ roomId: 'room-1', contractId: overlapping._id, effectiveDate: overlapping.startDate }, manager),
    { errorCode: 'CONTRACT_DATE_OVERLAP' },
  );

  const renewal = await service.renew({
    ...draft('HD-003', { startDate: '2027-09-01', endDate: '2028-08-31' }),
    sourceContractId: firstActive._id,
  }, manager);
  assert.equal(renewal.previousContractId, firstActive._id);
  assert.equal(renewal.status, 'DRAFT');
});

test('terminates active contract and calculates expiry buckets without persisted derived status', async () => {
  const { service } = createHarness();
  const expiring = await service.createDraft(draft('HD-EXP', {
    startDate: '2025-08-27',
    endDate: '2026-08-26',
  }), manager);
  const active = await activate(service, expiring);
  const summaries = await service.getSummaries('room-1', ['employee-1'], member);
  assert.equal(summaries[0].expiryBucket, 'DUE_7');
  assert.equal(summaries[0].daysUntilExpiry, 7);

  const terminated = await service.terminate({
    roomId: 'room-1', contractId: active._id, terminationDate: '2026-08-20', reason: 'Hai bên thỏa thuận',
  }, manager);
  assert.equal(terminated.status, 'TERMINATED');
  assert.equal(terminated.terminationReason, 'Hai bên thỏa thuận');
});

test('records a retryable event when signed-document metadata cannot be linked', async () => {
  const repository = new InMemoryContractRepository();
  const failingStore: IContractDocumentStore = {
    list: async () => [],
    attach: async () => { throw new Error('metadata unavailable'); },
  };
  const service = new ContractService(
    repository,
    failingStore,
    new ContractAuthorizationService(),
    new FixedClock(),
  );
  const created = await service.createDraft(draft('HD-LINK-FAIL'), manager);
  await service.submitForSignature('room-1', created._id, manager);

  await assert.rejects(service.attachSignedDocument({
    roomId: 'room-1', contractId: created._id, fileId: 'uploaded-file', fileName: 'signed.pdf',
    mimeType: 'application/pdf', fileSize: 1024, signedDate: '2026-08-20',
  }, manager), /metadata unavailable/u);
  assert.equal(repository.events.at(-1)?.action, 'DOCUMENT_LINK_FAILED');
  assert.match(repository.events.at(-1)?.detail ?? '', /uploaded-file/u);
});
