import { PayrollRecord, IPayrollService } from '../types';
import { McpApp } from '@privos/app-react';

export class PayrollService implements IPayrollService {
  private readonly app: McpApp;
  private readonly roomId: string;
  private readonly collectionName = 'payroll_records';

  constructor(app: McpApp, roomId: string) {
    if (!app) throw new Error("PayrollService requires a valid McpApp instance.");
    if (!roomId) throw new Error("PayrollService requires a roomId.");
    
    this.app = app;
    this.roomId = roomId;
  }

  async initializeSchema(): Promise<void> {
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
            { name: 'roomId', type: 'string', required: true }
          ]
        }
      });
    } catch (err) {
      console.warn("Could not register schema, might already exist or not supported.", err);
    }
  }

  async getRecords(): Promise<PayrollRecord[]> {
    try {
      const res: any = await this.app.callServerTool({
        name: 'hrm.payroll.query',
        arguments: {
          collection: this.collectionName,
          where: [{ field: 'roomId', op: '==', value: this.roomId }]
        }
      });
      if (!res) return [];

      let parsed: any = {};
      const rawText = res?.content?.[0]?.text;
      if (typeof rawText === 'string') {
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          console.warn("Could not parse JSON from response text:", rawText);
        }
      } else if (typeof res === 'string') {
        try {
          parsed = JSON.parse(res);
        } catch (e) {}
      } else {
        parsed = res;
      }

      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.records)) return parsed.records;
      if (Array.isArray(parsed?.items)) return parsed.items;
      if (Array.isArray(parsed?.data)) return parsed.data;
      return [];
    } catch (err) {
      console.error("Failed to fetch payroll records:", err);
      return [];
    }
  }

  async saveRecord(record: PayrollRecord): Promise<void> {
    try {
      const { _id, _createdAt, _updatedAt, ...rest } = record as any;
      const data = { ...rest, roomId: this.roomId };
      
      if (record._id) {
        await this.app.callServerTool({
          name: 'hrm.payroll.update',
          arguments: { collection: this.collectionName, id: record._id, data }
        });
      } else {
        await this.app.callServerTool({
          name: 'hrm.payroll.create',
          arguments: { collection: this.collectionName, data }
        });
      }
    } catch (err) {
      console.error("Failed to save payroll record:", err);
      throw err;
    }
  }

  async deleteRecord(id: string): Promise<void> {
    try {
      await this.app.callServerTool({
        name: 'hrm.payroll.delete',
        arguments: { collection: this.collectionName, id }
      });
    } catch (err) {
      console.error("Failed to delete payroll record:", err);
    }
  }
}
