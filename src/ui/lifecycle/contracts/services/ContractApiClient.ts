import type { McpApp } from '@privos/app-react';
import type {
  ActivateContractDto,
  AttachSignedDocumentDto,
  ContractSummary,
  ContractToolResponse,
  CreateContractDto,
  EmployeeContract,
  RenewContractDto,
  TerminateContractDto,
  UpdateDraftContractDto,
} from '../../../../contracts/types';
import type { ContractBundle } from '../../../../contracts/services/ContractService';

export class ContractApiError extends Error {
  public constructor(
    public readonly errorCode: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ContractApiError';
  }
}

export interface IContractApiClient {
  getSummaries(roomId: string, employeeIds: string[]): Promise<ContractSummary[]>;
  listByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]>;
  get(roomId: string, contractId: string): Promise<ContractBundle>;
  createDraft(dto: CreateContractDto): Promise<EmployeeContract>;
  updateDraft(dto: UpdateDraftContractDto): Promise<EmployeeContract>;
  submitForSignature(roomId: string, contractId: string): Promise<EmployeeContract>;
  attachSignedDocument(dto: AttachSignedDocumentDto): Promise<EmployeeContract>;
  activate(dto: ActivateContractDto): Promise<EmployeeContract>;
  renew(dto: RenewContractDto): Promise<EmployeeContract>;
  terminate(dto: TerminateContractDto): Promise<EmployeeContract>;
  cancel(roomId: string, contractId: string): Promise<EmployeeContract>;
}

export class ContractApiClient implements IContractApiClient {
  public constructor(private readonly app: McpApp) {}

  public getSummaries(roomId: string, employeeIds: string[]): Promise<ContractSummary[]> {
    return this.call('hrm.contracts.getSummaries', { roomId, employeeIds });
  }

  public listByEmployee(roomId: string, employeeId: string): Promise<EmployeeContract[]> {
    return this.call('hrm.contracts.listByEmployee', { roomId, employeeId });
  }

  public get(roomId: string, contractId: string): Promise<ContractBundle> {
    return this.call('hrm.contracts.get', { roomId, contractId });
  }

  public createDraft(dto: CreateContractDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.createDraft', dto);
  }

  public updateDraft(dto: UpdateDraftContractDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.updateDraft', dto);
  }

  public submitForSignature(roomId: string, contractId: string): Promise<EmployeeContract> {
    return this.call('hrm.contracts.submitForSignature', { roomId, contractId });
  }

  public attachSignedDocument(dto: AttachSignedDocumentDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.attachSignedDocument', dto);
  }

  public activate(dto: ActivateContractDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.activate', dto);
  }

  public renew(dto: RenewContractDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.renew', dto);
  }

  public terminate(dto: TerminateContractDto): Promise<EmployeeContract> {
    return this.call('hrm.contracts.terminate', dto);
  }

  public cancel(roomId: string, contractId: string): Promise<EmployeeContract> {
    return this.call('hrm.contracts.cancel', { roomId, contractId });
  }

  private async call<T>(name: string, args: object): Promise<T> {
    const result = await this.app.callServerTool({ name, arguments: args });
    const text = result?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new ContractApiError('INVALID_CONTRACT_RESPONSE', 'Phản hồi hợp đồng từ server không hợp lệ.', 502);
    }
    let response: ContractToolResponse<T>;
    try {
      response = JSON.parse(text) as ContractToolResponse<T>;
    } catch {
      throw new ContractApiError('INVALID_CONTRACT_RESPONSE', 'Không thể đọc phản hồi hợp đồng từ server.', 502);
    }
    if (!response.ok) {
      throw new ContractApiError(response.error.errorCode, response.error.message, response.error.status);
    }
    return response.data;
  }
}
