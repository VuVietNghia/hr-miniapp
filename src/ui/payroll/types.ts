export interface PayrollRecord {
  _id?: string;
  employeeId: string;
  baseSalary: number;
  taxId: string;
  bankAccount: string;
  bankName?: string;
  contractType?: string;
  roomId?: string; // Tùy chọn, dùng để filter data theo room nếu ứng dụng hỗ trợ nhiều room
}

export interface IPayrollService {
  initializeSchema(): Promise<void>;
  getRecords(): Promise<PayrollRecord[]>;
  saveRecord(record: PayrollRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}
