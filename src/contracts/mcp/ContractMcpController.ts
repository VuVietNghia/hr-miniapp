import { ContractError } from '../errors';
import { IContractService } from '../services/ContractService';
import { extractTrustedContractActor } from '../services/ContractAuthorizationService';
import { ContractToolResponse } from '../types';
import {
  parseActivateContractDto,
  parseAttachSignedDocumentDto,
  parseContractIdRequest,
  parseCreateContractDto,
  parseRenewContractDto,
  parseRoomAndEmployee,
  parseSummaryRequest,
  parseTerminateContractDto,
  parseUpdateDraftContractDto,
} from '../validation';

export class ContractMcpController {
  public constructor(private readonly service: IContractService) {}

  public async handle(toolName: string, rawArguments: unknown, requestParams: unknown): Promise<unknown> {
    try {
      const actor = extractTrustedContractActor(requestParams);
      let data: unknown;

      switch (toolName) {
        case 'hrm.contracts.getSummaries': {
          const input = parseSummaryRequest(rawArguments);
          data = await this.service.getSummaries(input.roomId, input.employeeIds, actor);
          break;
        }
        case 'hrm.contracts.listByEmployee': {
          const input = parseRoomAndEmployee(rawArguments);
          data = await this.service.listByEmployee(input.roomId, input.employeeId, actor);
          break;
        }
        case 'hrm.contracts.get': {
          const input = parseContractIdRequest(rawArguments);
          data = await this.service.get(input.roomId, input.contractId, actor);
          break;
        }
        case 'hrm.contracts.createDraft':
          data = await this.service.createDraft(parseCreateContractDto(rawArguments), actor);
          break;
        case 'hrm.contracts.updateDraft':
          data = await this.service.updateDraft(parseUpdateDraftContractDto(rawArguments), actor);
          break;
        case 'hrm.contracts.submitForSignature': {
          const input = parseContractIdRequest(rawArguments);
          data = await this.service.submitForSignature(input.roomId, input.contractId, actor);
          break;
        }
        case 'hrm.contracts.attachSignedDocument':
          data = await this.service.attachSignedDocument(parseAttachSignedDocumentDto(rawArguments), actor);
          break;
        case 'hrm.contracts.activate':
          data = await this.service.activate(parseActivateContractDto(rawArguments), actor);
          break;
        case 'hrm.contracts.renew':
          data = await this.service.renew(parseRenewContractDto(rawArguments), actor);
          break;
        case 'hrm.contracts.terminate':
          data = await this.service.terminate(parseTerminateContractDto(rawArguments), actor);
          break;
        case 'hrm.contracts.cancel': {
          const input = parseContractIdRequest(rawArguments);
          data = await this.service.cancel(input.roomId, input.contractId, actor);
          break;
        }
        default:
          throw new ContractError('UNKNOWN_CONTRACT_TOOL', `Unknown contract tool: ${toolName}`, 404);
      }

      return this.toMcpResult({ ok: true, data });
    } catch (error) {
      const normalized = error instanceof ContractError
        ? error
        : new ContractError('CONTRACT_INTERNAL_ERROR', 'Không thể xử lý yêu cầu hợp đồng.', 500);
      if (!(error instanceof ContractError)) {
        console.error('[ContractMcpController] Unexpected error:', error);
      }
      return this.toMcpResult({
        ok: false,
        error: {
          status: normalized.status,
          errorCode: normalized.errorCode,
          message: normalized.message,
        },
      }, true);
    }
  }

  private toMcpResult<T>(response: ContractToolResponse<T>, isError = false): unknown {
    return {
      ...(isError ? { isError: true } : {}),
      content: [{ type: 'text', text: JSON.stringify(response) }],
    };
  }
}
