import type { McpApp } from '@privos/app-react';
import {
  IPayrollService,
  PayrollConflictError,
  PayrollLoadResult,
  PayrollRecord,
  PayrollServiceError,
} from '../types';

export class PayrollService implements IPayrollService {
  private readonly collectionName = 'payroll_records';

  constructor(
    private readonly app: McpApp,
    private readonly roomId: string,
  ) {
    if (!app) throw new Error('PayrollService requires a valid McpApp instance.');
    if (!roomId) throw new Error('PayrollService requires a roomId.');
  }

  async initializeSchema(): Promise<void> {
    if (await this.hasRegisteredSchema()) return;

    let registrationError: unknown;
    try {
      await this.app.callServerTool({
        name: 'privos.db.registerCollection',
        arguments: {
          collection: this.collectionName,
          fields: [
            { name: 'employeeId', type: 'string', required: true },
            { name: 'baseSalary', type: 'number', required: true },
            { name: 'taxId', type: 'string' },
            { name: 'bankAccount', type: 'string' },
            { name: 'roomId', type: 'string', required: true },
          ],
          indexes: [{ fields: { roomId: 1, employeeId: 1 }, unique: true }],
        },
      });
      return;
    } catch (error) {
      if (this.isAlreadyRegisteredError(error)) return;
      registrationError = error;
    }

    // Existing installations can lose schema-write permission after a manifest
    // change. A successful scoped query proves the collection is still usable.
    if (await this.canReadExistingCollection()) return;

    console.error('[PayrollService] PAYROLL_SCHEMA_INIT_FAILED');
    throw new PayrollServiceError(
      'PAYROLL_SCHEMA_INIT_FAILED',
      'Không thể khởi tạo cấu trúc dữ liệu lương.',
      registrationError,
    );
  }

  async getRecords(): Promise<PayrollLoadResult> {
    try {
      return { status: 'success', records: await this.queryRecords() };
    } catch {
      console.error('[PayrollService] PAYROLL_READ_FAILED');
      return {
        status: 'failed',
        errorCode: 'PAYROLL_READ_FAILED',
        message: 'Không thể tải dữ liệu lương.',
      };
    }
  }

  async saveRecord(record: PayrollRecord): Promise<void> {
    const matchingRecords = (await this.queryRecords())
      .filter((candidate) => candidate.employeeId === record.employeeId);

    if (matchingRecords.length > 1) throw new PayrollConflictError();

    const existingRecord = matchingRecords[0];
    if (record._id && existingRecord?._id && record._id !== existingRecord._id) {
      throw new PayrollConflictError();
    }

    const targetId = record._id || existingRecord?._id;
    const data = this.buildPersistedData(record);
    if (targetId) {
      await this.updateRecord(targetId, data);
      return;
    }

    await this.createRecord(data);
    const recordsAfterCreate = (await this.queryRecords())
      .filter((candidate) => candidate.employeeId === record.employeeId);
    if (recordsAfterCreate.length > 1) throw new PayrollConflictError();
  }

  async deleteRecord(id: string): Promise<void> {
    await this.app.callServerTool({
      name: 'hrm.payroll.delete',
      arguments: { collection: this.collectionName, id },
    });
  }

  private async queryRecords(): Promise<PayrollRecord[]> {
    const response: any = await this.app.callServerTool({
      name: 'hrm.payroll.query',
      arguments: {
        collection: this.collectionName,
        where: [{ field: 'roomId', op: '==', value: this.roomId }],
        limit: 1000,
      },
    });
    const text = response?.content?.[0]?.text;
    if (typeof text !== 'string') throw new Error('Payroll response is empty.');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.records)) throw new Error('Payroll response is malformed.');
    return parsed.records as PayrollRecord[];
  }

  private buildPersistedData(record: PayrollRecord): Omit<PayrollRecord, '_id'> {
    return {
      employeeId: record.employeeId,
      baseSalary: record.baseSalary,
      taxId: record.taxId,
      bankAccount: record.bankAccount,
      bankName: record.bankName,
      contractType: record.contractType,
      applyProbationRate: record.applyProbationRate,
      probationRate: record.probationRate,
      roomId: this.roomId,
    };
  }

  private async updateRecord(id: string, data: Omit<PayrollRecord, '_id'>): Promise<void> {
    try {
      await this.app.callServerTool({
        name: 'hrm.payroll.update',
        arguments: { collection: this.collectionName, id, data },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new PayrollConflictError();
      throw error;
    }
  }

  private async createRecord(data: Omit<PayrollRecord, '_id'>): Promise<void> {
    try {
      await this.app.callServerTool({
        name: 'hrm.payroll.create',
        arguments: { collection: this.collectionName, data },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new PayrollConflictError();
      throw error;
    }
  }

  private async hasRegisteredSchema(): Promise<boolean> {
    try {
      await this.app.callServerTool({
        name: 'privos.db.getSchema',
        arguments: { collection: this.collectionName },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async canReadExistingCollection(): Promise<boolean> {
    try {
      await this.queryRecords();
      return true;
    } catch {
      return false;
    }
  }

  private isAlreadyRegisteredError(error: unknown): boolean {
    return /collection.*already (?:registered|exists)/i.test(this.getErrorMessage(error));
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return /duplicate|unique/i.test(this.getErrorMessage(error));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      return typeof message === 'string' ? message : '';
    }
    return '';
  }
}
