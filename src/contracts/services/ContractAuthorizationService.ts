import { ContractError } from '../errors';
import { ContractActorContext } from '../types';

export interface IContractAuthorizationService {
  requireTrustedRoom(actor: ContractActorContext, roomId: string): void;
  requireManager(actor: ContractActorContext, roomId: string): void;
  canManage(actor: ContractActorContext, roomId: string): boolean;
}

export class ContractAuthorizationService implements IContractAuthorizationService {
  public requireTrustedRoom(actor: ContractActorContext, roomId: string): void {
    if (!actor.trusted || !actor.userId || actor.roomId !== roomId) {
      throw new ContractError(
        'CONTRACT_CONTEXT_REQUIRED',
        'PrivOS chưa cung cấp actor context tin cậy cho phòng này.',
        403,
      );
    }
  }

  public requireManager(actor: ContractActorContext, roomId: string): void {
    this.requireTrustedRoom(actor, roomId);
    if (!this.canManage(actor, roomId)) {
      throw new ContractError(
        'CONTRACT_ACCESS_DENIED',
        'Bạn không có quyền quản lý hợp đồng trong phòng này.',
        403,
      );
    }
  }

  public canManage(actor: ContractActorContext, roomId: string): boolean {
    if (!actor.trusted || !actor.userId || actor.roomId !== roomId) return false;
    const roles = actor.userRoles.map(role => role.toLowerCase());
    return roles.includes('owner') || roles.includes('moderator');
  }
}

export function extractTrustedContractActor(params: unknown): ContractActorContext {
  const root = asRecord(params);
  const meta = asRecord(root?._meta);
  const context =
    asRecord(meta?.privosContext) ??
    asRecord(meta?.context) ??
    asRecord(meta?.['privos/context']) ??
    meta;

  const userId = stringValue(context?.userId);
  const roomId = stringValue(context?.roomId);
  const userRoles = Array.isArray(context?.userRoles)
    ? context.userRoles.filter((role): role is string => typeof role === 'string')
    : [];

  return {
    userId,
    roomId,
    userRoles,
    trusted: Boolean(meta && userId && roomId),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
