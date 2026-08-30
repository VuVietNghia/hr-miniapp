import type { VerifiedActor } from '@privos_ai/app-server';

import type { AuthorizedHubClient } from '../platform/hub/AgentBotRoomPlatformGateway';
import type { RoomPlatformGateway } from '../platform/hub/RoomPlatformGateway';

export const PAYROLL_ACCESS_DENIED = 'PAYROLL_ACCESS_DENIED' as const;

export interface PayrollOwnerEvidence {
  userId: string;
  roomId: string;
  isOwner: true;
  provenance: 'verified-actor-claim' | 'hub-authorization';
}

export interface PayrollAuthorizationPolicy {
  requireOwner(
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<PayrollOwnerEvidence>;
}

export interface PayrollAuthorizationDependencies {
  roomPlatform: RoomPlatformGateway;
  hubClient: AuthorizedHubClient;
}

class DenyAllPayrollAuthorizationPolicy implements PayrollAuthorizationPolicy {
  async requireOwner(
    _actor: VerifiedActor | undefined,
    _roomId: string | undefined,
  ): Promise<PayrollOwnerEvidence> {
    throw new Error(PAYROLL_ACCESS_DENIED);
  }
}

export function createProvenPayrollAuthorizationPolicy(
  dependencies: PayrollAuthorizationDependencies,
): PayrollAuthorizationPolicy {
  void dependencies;
  return new DenyAllPayrollAuthorizationPolicy();
}
