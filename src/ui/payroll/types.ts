import type { PayrollRecordInput } from '../../payroll/payroll-types';

export interface PayrollRecord extends PayrollRecordInput {
  _id?: string;
  roomId?: string;
}

export interface IPayrollService {
  initializeSchema(): Promise<void>;
  getRecords(): Promise<PayrollRecord[]>;
  saveRecord(record: PayrollRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}
