import { describe, expect, it } from 'vitest';

import {
  type AuthorizedHubClient,
  AgentBotRoomPlatformGateway,
} from '../../src/platform/hub/AgentBotRoomPlatformGateway';
import type {
  RoomPlatformCall,
  ServerPlatformScope,
} from '../../src/platform/hub/RoomPlatformGateway';
import { resolveHubOrigin } from '../../src/platform/hub/resolve-hub-origin';
import { resolveOwnMcpAppId } from '../../src/platform/hub/resolve-own-mcp-app-id';

type AuthorizedFetchInit = Parameters<AuthorizedHubClient['authorizedFetch']>[1];

class RecordingHubClient implements AuthorizedHubClient {
  readonly calls: Array<Readonly<{ input: string; init: AuthorizedFetchInit }>> = [];

  constructor(private readonly response: Response) {}

  async authorizedFetch(input: string, init: AuthorizedFetchInit): Promise<Response> {
    this.calls.push({ input, init });
    return this.response;
  }
}

class RejectingHubClient implements AuthorizedHubClient {
  async authorizedFetch(_input: string, _init: AuthorizedFetchInit): Promise<Response> {
    throw new Error('transport included secret-token and employee payroll document');
  }
}

function successfulToolResponse(result: unknown): Response {
  return new Response(JSON.stringify({
    success: true,
    content: [{ type: 'text', text: JSON.stringify(result) }],
  }), { status: 200 });
}

describe('AgentBotRoomPlatformGateway', () => {
  it('sends the exact non-retried authorized tool-call request and returns parsed JSON', async () => {
    const hubClient = new RecordingHubClient(successfulToolResponse({ records: [] }));
    const gateway = new AgentBotRoomPlatformGateway(
      hubClient,
      async () => 'app-1',
    );

    const result = await gateway.call<{ records: readonly unknown[] }>({
      roomId: 'room-1',
      requiredScope: 'db:read',
      toolName: 'mcpapp.db.query',
      arguments: { collection: 'payroll_records' },
    });

    expect(result).toEqual({ records: [] });
    expect(hubClient.calls).toEqual([{
      input: '/api/v1/mcp-apps.tool-call',
      init: {
        method: 'POST',
        requiredScope: 'db:read',
        retryMode: 'never',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mcpAppId: 'app-1',
          toolName: 'mcpapp.db.query',
          arguments: { collection: 'payroll_records' },
          roomId: 'room-1',
        }),
      },
    }]);
  });

  it('fails before transport when its own app id is unavailable', async () => {
    const hubClient = new RecordingHubClient(successfulToolResponse({ records: [] }));
    const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => undefined);

    await expect(gateway.call({
      roomId: 'room-1',
      requiredScope: 'db:read',
      toolName: 'mcpapp.db.query',
      arguments: { collection: 'payroll_records' },
    })).rejects.toThrow('Room platform gateway is not configured: MCP App id is unavailable');
    expect(hubClient.calls).toEqual([]);
  });

  it('sanitizes app-id resolution and transport failures', async () => {
    const resolutionGateway = new AgentBotRoomPlatformGateway(
      new RecordingHubClient(successfulToolResponse({ records: [] })),
      async () => {
        throw new Error('identity file contains secret-token');
      },
    );
    const transportGateway = new AgentBotRoomPlatformGateway(
      new RejectingHubClient(),
      async () => 'app-1',
    );
    const request = {
      roomId: 'room-1',
      requiredScope: 'db:read',
      toolName: 'mcpapp.db.query',
      arguments: { collection: 'payroll_records' },
    } as const;

    await expect(resolutionGateway.call(request)).rejects.toThrow(
      'Room platform gateway is not configured: MCP App id is unavailable',
    );
    await expect(transportGateway.call(request)).rejects.toThrow(
      'mcpapp.db.query transport failed',
    );
  });

  it('rejects a blank room before resolving configuration or issuing transport', async () => {
    const hubClient = new RecordingHubClient(successfulToolResponse({ records: [] }));
    let appIdResolutions = 0;
    const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => {
      appIdResolutions += 1;
      return 'app-1';
    });

    await expect(gateway.call({
      roomId: '   ',
      requiredScope: 'db:read',
      toolName: 'mcpapp.db.query',
      arguments: { collection: 'payroll_records' },
    })).rejects.toThrow('Room platform call is invalid');
    expect(appIdResolutions).toBe(0);
    expect(hubClient.calls).toEqual([]);
  });

  it('rejects a tool and scope mismatch before issuing transport', async () => {
    const hubClient = new RecordingHubClient(successfulToolResponse({ records: [] }));
    const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => 'app-1');
    const callWithUncheckedInput = (request: unknown): Promise<unknown> => Reflect.apply(
      gateway.call,
      gateway,
      [request],
    );

    await expect(callWithUncheckedInput({
      roomId: 'room-1',
      requiredScope: 'db:write',
      toolName: 'mcpapp.db.query',
      arguments: { collection: 'payroll_records' },
    })).rejects.toThrow('Room platform call is invalid');
    expect(hubClient.calls).toEqual([]);
  });

  it.each([
    ['HTTP failure', new Response('credential=secret-value', {
      status: 503,
      headers: { 'x-auth-token': 'secret-token' },
    })],
    ['success false', new Response(JSON.stringify({
      success: false,
      error: 'employee payroll document and secret-value',
    }), { status: 200 })],
    ['missing result text', new Response(JSON.stringify({
      success: true,
      content: [{ type: 'text' }],
    }), { status: 200 })],
    ['invalid result JSON', new Response(JSON.stringify({
      success: true,
      content: [{ type: 'text', text: '{employee-secret' }],
    }), { status: 200 })],
  ])('rejects %s without leaking response data', async (_caseName, response) => {
    const hubClient = new RecordingHubClient(response);
    const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => 'app-1');

    let caught: unknown;
    try {
      await gateway.call({
        roomId: 'room-1',
        requiredScope: 'db:read',
        toolName: 'mcpapp.db.query',
        arguments: { collection: 'payroll_records' },
      });
      expect.unreachable('expected gateway call to reject');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : String(caught);
    expect(message).toContain('mcpapp.db.query');
    expect(message).toContain(String(response.status));
    expect(message).not.toContain('secret-value');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('employee payroll document');
  });

  it('rejects an invalid outer response envelope without echoing it', async () => {
    const hubClient = new RecordingHubClient(new Response('private employee payload', { status: 200 }));
    const gateway = new AgentBotRoomPlatformGateway(hubClient, async () => 'app-1');

    await expect(gateway.call({
      roomId: 'room-1',
      requiredScope: 'lists:read',
      toolName: 'mcpapp.lists.getItems',
      arguments: { listId: 'list-1' },
    })).rejects.toThrow('mcpapp.lists.getItems returned an invalid envelope (status 200)');
  });
});

describe('closed Room platform call type', () => {
  it('binds each supported tool to one exact scope', () => {
    const validCall: RoomPlatformCall = {
      roomId: 'room-1',
      requiredScope: 'lists:write',
      toolName: 'mcpapp.lists.addField',
      arguments: { listId: 'list-1', name: 'recipient', type: 'TEXT' },
    };

    expect(validCall.toolName).toBe('mcpapp.lists.addField');

    if (false) {
      const provisionalTool: RoomPlatformCall = {
        roomId: 'room-1',
        requiredScope: 'db:write',
        // @ts-expect-error Provisional target-Hub tool is intentionally unavailable.
        toolName: 'mcpapp.db.update',
        arguments: {},
      };
      // @ts-expect-error Arbitrary scopes are intentionally unavailable.
      const arbitraryScope: ServerPlatformScope = 'admin:all';
      void provisionalTool;
      void arbitraryScope;
    }
  });
});

describe('mode-aware Hub configuration resolution', () => {
  it('uses only the managed workload binding in managed mode', async () => {
    let standaloneReads = 0;
    const origin = await resolveHubOrigin({
      resolveMode: () => 'managed',
      resolveManagedHubOrigin: async () => 'https://managed.example',
      resolveStandaloneHubOrigin: () => {
        standaloneReads += 1;
        return 'https://standalone.example';
      },
      developmentEnv: { PRIVOS_URL: 'https://development.example' },
    });
    const appId = await resolveOwnMcpAppId({
      resolveMode: () => 'managed',
      resolveManagedMcpAppId: async () => 'managed-app',
      resolveStandaloneMcpAppId: () => {
        standaloneReads += 1;
        return 'standalone-app';
      },
      developmentEnv: { MCP_APP_ID: 'development-app' },
    });

    expect({ origin, appId, standaloneReads }).toEqual({
      origin: 'https://managed.example',
      appId: 'managed-app',
      standaloneReads: 0,
    });
  });

  it('uses only the standalone identity in standalone-production mode', async () => {
    let managedReads = 0;
    const origin = await resolveHubOrigin({
      resolveMode: () => 'standalone-production',
      resolveManagedHubOrigin: async () => {
        managedReads += 1;
        return 'https://managed.example';
      },
      resolveStandaloneHubOrigin: () => 'https://standalone.example',
      developmentEnv: { PRIVOS_URL: 'https://development.example' },
    });
    const appId = await resolveOwnMcpAppId({
      resolveMode: () => 'standalone-production',
      resolveManagedMcpAppId: async () => {
        managedReads += 1;
        return 'managed-app';
      },
      resolveStandaloneMcpAppId: () => 'standalone-app',
      developmentEnv: { MCP_APP_ID: 'development-app' },
    });

    expect({ origin, appId, managedReads }).toEqual({
      origin: 'https://standalone.example',
      appId: 'standalone-app',
      managedReads: 0,
    });
  });

  it('uses validated development values and never guesses missing configuration', async () => {
    const common = {
      resolveMode: () => 'development' as const,
      resolveManagedHubOrigin: async () => 'https://managed.example',
      resolveStandaloneHubOrigin: () => 'https://standalone.example',
    };
    const origin = await resolveHubOrigin({
      ...common,
      developmentEnv: { PRIVOS_URL: 'https://development.example///' },
    });
    const invalidOrigin = await resolveHubOrigin({
      ...common,
      developmentEnv: { PRIVOS_URL: 'development.example' },
    });
    const appId = await resolveOwnMcpAppId({
      resolveMode: () => 'development',
      resolveManagedMcpAppId: async () => 'managed-app',
      resolveStandaloneMcpAppId: () => 'standalone-app',
      developmentEnv: { MCP_APP_ID: '  app-1  ' },
    });
    const missingAppId = await resolveOwnMcpAppId({
      resolveMode: () => 'development',
      resolveManagedMcpAppId: async () => 'managed-app',
      resolveStandaloneMcpAppId: () => 'standalone-app',
      developmentEnv: {},
    });

    expect({ origin, invalidOrigin, appId, missingAppId }).toEqual({
      origin: 'https://development.example',
      invalidOrigin: undefined,
      appId: 'app-1',
      missingAppId: undefined,
    });
  });

  it('returns undefined when mode or selected identity resolution fails', async () => {
    const modeFailure = await resolveHubOrigin({
      resolveMode: () => {
        throw new Error('mode details');
      },
      resolveManagedHubOrigin: async () => 'https://managed.example',
      resolveStandaloneHubOrigin: () => 'https://standalone.example',
      developmentEnv: { PRIVOS_URL: 'https://development.example' },
    });
    const identityFailure = await resolveOwnMcpAppId({
      resolveMode: () => 'managed',
      resolveManagedMcpAppId: async () => {
        throw new Error('credential details');
      },
      resolveStandaloneMcpAppId: () => 'standalone-app',
      developmentEnv: { MCP_APP_ID: 'development-app' },
    });

    expect({ modeFailure, identityFailure }).toEqual({
      modeFailure: undefined,
      identityFailure: undefined,
    });
  });
});
