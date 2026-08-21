export interface PayrollRecord {
  _id?: string;
  employeeId: string;
  baseSalary: number;
  taxId: string;
  bankAccount: string;
  bankName?: string;
  contractType?: string;
  applyProbationRate?: boolean; // Checkbox phòng Hành chính kiểm soát (mặc định true khi thử việc 85%)
  probationRate?: number; // Mặc định 85 (%)
  roomId?: string; // Tùy chọn, dùng để filter data theo room nếu ứng dụng hỗ trợ nhiều room
}

export interface PayrollLoadSuccess {
  status: 'success';
  records: PayrollRecord[];
}

export interface PayrollLoadFailure {
  status: 'failed';
  errorCode: 'PAYROLL_READ_FAILED';
  message: string;
}

export type PayrollLoadResult = PayrollLoadSuccess | PayrollLoadFailure;
export type PayrollDataState = 'loading' | 'ready' | 'empty' | 'error' | 'stale';

export class PayrollConflictError extends Error {
  readonly code = 'PAYROLL_DUPLICATE_CONFLICT';

  constructor() {
    super('Phát hiện nhiều bản ghi lương cho cùng một nhân viên. Cần xử lý xung đột trước khi lưu.');
    this.name = 'PayrollConflictError';
  }
}

export class PayrollServiceError extends Error {
  constructor(
    public readonly code: 'PAYROLL_SCHEMA_INIT_FAILED' | 'PAYROLL_READ_FAILED',
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'PayrollServiceError';
  }
}

export interface IPayrollService {
  initializeSchema(): Promise<void>;
  getRecords(): Promise<PayrollLoadResult>;
  saveRecord(record: PayrollRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}
