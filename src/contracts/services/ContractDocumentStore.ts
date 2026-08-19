import { IContractRepository, NewContractDocument } from '../repositories/IContractRepository';
import { ContractDocument } from '../types';

export interface IContractDocumentStore {
  attach(document: NewContractDocument): Promise<ContractDocument>;
  list(roomId: string, contractId: string): Promise<ContractDocument[]>;
}

export class RepositoryContractDocumentStore implements IContractDocumentStore {
  public constructor(private readonly repository: IContractRepository) {}

  public attach(document: NewContractDocument): Promise<ContractDocument> {
    return this.repository.createDocument(document);
  }

  public list(roomId: string, contractId: string): Promise<ContractDocument[]> {
    return this.repository.listDocuments(roomId, contractId);
  }
}
