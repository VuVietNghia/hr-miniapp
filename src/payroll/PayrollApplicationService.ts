import type { VerifiedActor } from '@privos_ai/app-server';

import type {
  PayrollCreateInput,
  PayrollDeleteInput,
  PayrollUpdateInput,
} from '../mcp/tool-inputs';
import type { PayrollAuthorizationPolicy } from './PayrollAuthorizationPolicy';
import {
  parsePayrollRecordId,
  parsePayrollRecordInput,
  type PayrollRecordInput,
  type StoredPayrollRecord,
} from './payroll-types';

export const PAYROLL_INPUT_INVALID = 'PAYROLL_INPUT_INVALID' as const;
export const PAYROLL_OPERATION_FAILED = 'PAYROLL_OPERATION_FAILED' as const;

export interface PayrollRecordRepository {
  query(roomId: string): Promise<readonly StoredPayrollRecord[]>;
  create(roomId: string, input: PayrollRecordInput): Promise<StoredPayrollRecord>;
  update(roomId: string, id: string, input: PayrollRecordInput): Promise<StoredPayrollRecord>;
  delete(roomId: string, id: string): Promise<void>;
}

function invalidInput(): never {
  throw new Error(PAYROLL_INPUT_INVALID);
}

export class PayrollApplicationService {
  constructor(
    private readonly repository: PayrollRecordRepository,
    private readonly authorization: PayrollAuthorizationPolicy,
  ) {}

  async query(
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<readonly StoredPayrollRecord[]> {
    const evidence = await this.authorization.requireOwner(actor, roomId);
    return this.runRepository(() => this.repository.query(evidence.roomId));
  }

  async create(
    input: PayrollCreateInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<StoredPayrollRecord> {
    const evidence = await this.authorization.requireOwner(actor, roomId);
    let record: PayrollRecordInput;
    try {
      record = parsePayrollRecordInput(input.record);
    } catch {
      return invalidInput();
    }
    return this.runRepository(() => this.repository.create(evidence.roomId, record));
  }

  async update(
    input: PayrollUpdateInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<StoredPayrollRecord> {
    const evidence = await this.authorization.requireOwner(actor, roomId);
    let id: string;
    let record: PayrollRecordInput;
    try {
      id = parsePayrollRecordId(input.id);
      record = parsePayrollRecordInput(input.record);
    } catch {
      return invalidInput();
    }
    return this.runRepository(() => this.repository.update(evidence.roomId, id, record));
  }

  async delete(
    input: PayrollDeleteInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<void> {
    const evidence = await this.authorization.requireOwner(actor, roomId);
    let id: string;
    try {
      id = parsePayrollRecordId(input.id);
    } catch {
      return invalidInput();
    }
    return this.runRepository(() => this.repository.delete(evidence.roomId, id));
  }

  private async runRepository<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new Error(PAYROLL_OPERATION_FAILED);
    }
  }
}
