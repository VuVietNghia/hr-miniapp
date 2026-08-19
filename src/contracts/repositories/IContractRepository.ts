import {
  ContractDocument,
  ContractEvent,
  EmployeeContract,
} from '../types';

export type NewContract = Omit<EmployeeContract, '_id' | '_createdAt' | '_updatedAt'>;
export type NewContractDocument = Omit<ContractDocument, '_id'>;
export type NewContractEvent = Omit<ContractEvent, '_id'>;
export type ContractPatch = Omit<Partial<EmployeeContract>, 'endDate'> & { endDate?: string | null };

export interface IContractRepository {
  initializeSchemas(): Promise<void>;
  listByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]>;
  listByEmployeeIds(roomId: string, employeeIds: string[]): Promise<EmployeeContract[]>;
  getById(roomId: string, contractId: string): Promise<EmployeeContract | null>;
  findByNumber(roomId: string, contractNumber: string): Promise<EmployeeContract | null>;
  listActiveByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]>;
  create(contract: NewContract): Promise<EmployeeContract>;
  update(roomId: string, contractId: string, data: ContractPatch): Promise<EmployeeContract>;
  createDocument(document: NewContractDocument): Promise<ContractDocument>;
  listDocuments(roomId: string, contractId: string): Promise<ContractDocument[]>;
  createEvent(event: NewContractEvent): Promise<ContractEvent>;
  listEvents(roomId: string, contractId: string): Promise<ContractEvent[]>;
}
