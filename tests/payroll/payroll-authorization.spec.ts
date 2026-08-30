import type { VerifiedActor } from '@privos_ai/app-server';
import { describe, expect, it } from 'vitest';

import type { AuthorizedHubClient } from '../../src/platform/hub/AgentBotRoomPlatformGateway';
import type { RoomPlatformGateway } from '../../src/platform/hub/RoomPlatformGateway';
import {
  PAYROLL_ACCESS_DENIED,
  createProvenPayrollAuthorizationPolicy,
} from '../../src/payroll/PayrollAuthorizationPolicy';

const actor: VerifiedActor = Object.freeze({
  userId: 'verified-user',
  username: 'Verified User',
  roomId: 'room-1',
  claims: Object.freeze({ sub: 'verified-user', rid: 'room-1', role: 'owner' }),
  provenance: 'user-token',
});

describe('production payroll authorization', () => {
  it.each([
    [undefined, undefined],
    [undefined, 'room-1'],
    [actor, undefined],
    [actor, 'room-other'],
    [actor, 'room-1'],
  ] as const)('denies every case until a trusted owner contract is live-proven', async (
    candidateActor,
    roomId,
  ) => {
    let roomCalls = 0;
    let hubCalls = 0;
    const roomPlatform: RoomPlatformGateway = {
      async call() {
        roomCalls += 1;
        throw new Error('must not call an unverified route');
      },
    };
    const hubClient: AuthorizedHubClient = {
      async authorizedFetch() {
        hubCalls += 1;
        throw new Error('must not inspect guessed claims or routes');
      },
    };
    const policy = createProvenPayrollAuthorizationPolicy({ roomPlatform, hubClient });

    await expect(policy.requireOwner(candidateActor, roomId)).rejects.toThrow(
      PAYROLL_ACCESS_DENIED,
    );
    expect(roomCalls).toBe(0);
    expect(hubCalls).toBe(0);
  });
});
