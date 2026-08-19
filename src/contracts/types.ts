export type ContractType = 'FIXED_TERM' | 'INDEFINITE';

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'TERMINATED'
  | 'CANCELLED';

export type ContractDocumentType = 'DRAFT' | 'SIGNED' | 'ANNEX' | 'TERMINATION';

export type ContractEventAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED_FOR_SIGNATURE'
  | 'SIGNED_DOCUMENT_ATTACHED'
  | 'ACTIVATED'
  | 'RENEWED'
  | 'TERMINATED'
  | 'CANCELLED'
  | 'DOCUMENT_LINK_FAILED';

export interface EmployeeContract {
  _id: string;
  roomId: string;
  employeeId: string;
  contractNumber: string;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  signedDate?: string;
  effectiveDate?: string;
  position: string;
  department: string;
  workLocation: string;
  baseSalary: number;
  currency: 'VND';
  currentSignedFileId?: string;
  currentSignedFileName?: string;
  previousContractId?: string;
  terminationDate?: string;
  terminationReason?: string;
  revision: number;
  createdBy: string;
  updatedBy: string;
  _createdAt?: string;
  _updatedAt?: string;
}

export interface ContractDocument {
  _id: string;
  roomId: string;
  contractId: string;
  documentType: ContractDocumentType;
  version: number;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ContractEvent {
  _id: string;
  roomId: string;
  contractId: string;
  action: ContractEventAction;
  actorUserId: string;
  detail: string;
  occurredAt: string;
}

export type ContractExpiryBucket = 'NONE' | 'DUE_30' | 'DUE_15' | 'DUE_7' | 'EXPIRED';

export interface ContractSummary {
  employeeId: string;
  contractId?: string;
  contractType?: ContractType;
  status: ContractStatus | 'NONE';
  startDate?: string;
  endDate?: string;
  daysUntilExpiry?: number;
  expiryBucket: ContractExpiryBucket;
}

export interface CreateContractDto {
  roomId: string;
  employeeId: string;
  contractNumber: string;
  contractType: ContractType;
  startDate: string;
  endDate?: string;
  position: string;
  department: string;
  workLocation: string;
  baseSalary: number;
  previousContractId?: string;
}

export interface UpdateDraftContractDto {
  roomId: string;
  contractId: string;
  contractNumber: string;
  contractType: ContractType;
  startDate: string;
  endDate?: string;
  position: string;
  department: string;
  workLocation: string;
  baseSalary: number;
  expectedRevision: number;
}

export interface AttachSignedDocumentDto {
  roomId: string;
  contractId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  signedDate: string;
}

export interface ActivateContractDto {
  roomId: string;
  contractId: string;
  effectiveDate: string;
}

export interface RenewContractDto extends Omit<CreateContractDto, 'employeeId' | 'previousContractId'> {
  sourceContractId: string;
}

export interface TerminateContractDto {
  roomId: string;
  contractId: string;
  terminationDate: string;
  reason: string;
}

export interface ContractActorContext {
  userId: string;
  roomId: string;
  userRoles: string[];
  trusted: boolean;
}

export interface ContractToolError {
  status: number;
  errorCode: string;
  message: string;
}

export type ContractToolResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ContractToolError };
