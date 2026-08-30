import type { VerifiedActor } from '@privos_ai/app-server';
import { describe, expect, it } from 'vitest';

import {
  PAYROLL_INPUT_INVALID,
  PAYROLL_OPERATION_FAILED,
  PayrollApplicationService,
  type PayrollRecordRepository,
} from '../../src/payroll/PayrollApplicationService';
import type {
  PayrollAuthorizationPolicy,
  PayrollOwnerEvidence,
} from '../../src/payroll/PayrollAuthorizationPolicy';
import {
  buildPayrollCreateToolPayload,
  buildPayrollDeleteToolPayload,
  buildPayrollQueryToolPayload,
  buildPayrollUpdateToolPayload,
} from '../../src/payroll/payroll-tool-payloads';
import type { PayrollRecordInput, StoredPayrollRecord } from '../../src/payroll/payroll-types';

const actor: VerifiedActor = Object.freeze({
  userId: 'verified-owner',
  username: 'Verified Owner',
  roomId: 'actor-room',
  claims: Object.freeze({ sub: 'verified-owner', rid: 'actor-room' }),
  provenance: 'user-token',
});

const record: PayrollRecordInput = {
  employeeId: 'employee-1',
  baseSalary: 50_000_000,
  taxId: '0123456789',
  bankAccount: '123456789',
  bankName: 'Vietcombank',
  contractType: 'Thử việc (85%)',
  applyProbationRate: true,
  probationRate: 85,
};

const stored: StoredPayrollRecord = {
  ...record,
  _id: 'record-1',
  roomId: 'verified-room',
};

class FakeAuthorization implements PayrollAuthorizationPolicy {
  readonly calls: unknown[] = [];
  failure?: Error;

  async requireOwner(
    verifiedActor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<PayrollOwnerEvidence> {
    this.calls.push({ actor: verifiedActor, roomId });
    if (this.failure) throw this.failure;
    return {
      userId: 'verified-owner',
      roomId: 'verified-room',
      isOwner: true,
      provenance: 'hub-authorization',
    };
  }
}

class FakeRepository implements PayrollRecordRepository {
  readonly calls: unknown[] = [];
  failure?: Error;

  private result<T>(value: T): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(value);
  }

  query(roomId: string): Promise<readonly StoredPayrollRecord[]> {
    this.calls.push({ operation: 'query', roomId });
    return this.result([stored]);
  }

  create(roomId: string, input: PayrollRecordInput): Promise<StoredPayrollRecord> {
    this.calls.push({ operation: 'create', roomId, record: input });
    return this.result(stored);
  }

  update(
    roomId: string,
    id: string,
    input: PayrollRecordInput,
  ): Promise<StoredPayrollRecord> {
    this.calls.push({ operation: 'update', roomId, id, record: input });
    return this.result(stored);
  }

  delete(roomId: string, id: string): Promise<void> {
    this.calls.push({ operation: 'delete', roomId, id });
    return this.result(undefined);
  }
}

describe('PayrollApplicationService', () => {
  it('requires owner first and derives repository Room from returned trusted evidence', async () => {
    const authorization = new FakeAuthorization();
    const repository = new FakeRepository();
    const service = new PayrollApplicationService(repository, authorization);

    await expect(service.query(actor, 'context-room')).resolves.toEqual([stored]);
    await expect(service.create({ record }, actor, 'context-room')).resolves.toEqual(stored);
    await expect(service.update({ id: ' record-1 ', record }, actor, 'context-room'))
      .resolves.toEqual(stored);
    await expect(service.delete({ id: ' record-1 ' }, actor, 'context-room'))
      .resolves.toBeUndefined();

    expect(authorization.calls).toHaveLength(4);
    expect(repository.calls).toEqual([
      { operation: 'query', roomId: 'verified-room' },
      { operation: 'create', roomId: 'verified-room', record },
      { operation: 'update', roomId: 'verified-room', id: 'record-1', record },
      { operation: 'delete', roomId: 'verified-room', id: 'record-1' },
    ]);
  });

  it('does not validate or touch the repository when authorization denies', async () => {
    const authorization = new FakeAuthorization();
    authorization.failure = new Error('PAYROLL_ACCESS_DENIED');
    const repository = new FakeRepository();
    const service = new PayrollApplicationService(repository, authorization);

    await expect(service.create({ record: { ...record, baseSalary: -1 } }, actor, 'room-1'))
      .rejects.toThrow('PAYROLL_ACCESS_DENIED');
    expect(repository.calls).toEqual([]);
  });

  it('returns a stable input error only after authorization and before repository access', async () => {
    const authorization = new FakeAuthorization();
    const repository = new FakeRepository();
    const service = new PayrollApplicationService(repository, authorization);

    await expect(service.update({ id: '', record }, actor, 'room-1'))
      .rejects.toThrow(PAYROLL_INPUT_INVALID);
    await expect(service.create({ record: { ...record, taxId: 'secret-tax-invalid' } }, actor, 'room-1'))
      .rejects.toThrow(PAYROLL_INPUT_INVALID);
    expect(authorization.calls).toHaveLength(2);
    expect(repository.calls).toEqual([]);
  });

  it('maps repository details to a generic error without logging payroll data', async () => {
    const authorization = new FakeAuthorization();
    const repository = new FakeRepository();
    repository.failure = new Error('salary=50000000 tax=0123456789 bank=123456789');
    const service = new PayrollApplicationService(repository, authorization);

    await expect(service.create({ record }, actor, 'room-1')).rejects.toThrow(
      PAYROLL_OPERATION_FAILED,
    );
  });
});

describe('Task 13 payroll browser payload contract', () => {
  it('retains every business field and excludes caller authority', () => {
    expect(buildPayrollQueryToolPayload()).toEqual({
      name: 'hrm.payroll.query',
      arguments: {},
    });
    expect(buildPayrollCreateToolPayload(record)).toEqual({
      name: 'hrm.payroll.create',
      arguments: { record },
    });
    expect(buildPayrollUpdateToolPayload('record-1', record)).toEqual({
      name: 'hrm.payroll.update',
      arguments: { id: 'record-1', record },
    });
    expect(buildPayrollDeleteToolPayload('record-1')).toEqual({
      name: 'hrm.payroll.delete',
      arguments: { id: 'record-1' },
    });
  });

  it('rejects collection, filter, Room, password, and dropped business fields', () => {
    expect(() => buildPayrollCreateToolPayload({ ...record, roomId: 'spoofed' }))
      .toThrow('Invalid payroll record');
    expect(() => buildPayrollCreateToolPayload({ ...record, collection: 'other' }))
      .toThrow('Invalid payroll record');
    expect(() => buildPayrollCreateToolPayload({ ...record, where: [] }))
      .toThrow('Invalid payroll record');
    expect(() => buildPayrollCreateToolPayload({ ...record, filter: {} }))
      .toThrow('Invalid payroll record');
    expect(() => buildPayrollCreateToolPayload({ ...record, password: 'secret' }))
      .toThrow('Invalid payroll record');
    const { bankAccount: _dropped, ...incomplete } = record;
    expect(() => buildPayrollCreateToolPayload(incomplete)).toThrow('Invalid payroll record');
  });
});
