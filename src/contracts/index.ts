import { callHubTool } from '../relay-client';
import { ContractMcpController } from './mcp/ContractMcpController';
import { PrivOSContractRepository } from './repositories/PrivOSContractRepository';
import { ContractAuthorizationService } from './services/ContractAuthorizationService';
import { RepositoryContractDocumentStore } from './services/ContractDocumentStore';
import { ContractService, SystemClock } from './services/ContractService';

const repository = new PrivOSContractRepository(callHubTool);
const documentStore = new RepositoryContractDocumentStore(repository);
const authorization = new ContractAuthorizationService();
const service = new ContractService(repository, documentStore, authorization, new SystemClock());

export const contractMcpController = new ContractMcpController(service);
export { CONTRACT_TOOL_DEFINITIONS, isContractTool } from './mcp/contract-tools';
