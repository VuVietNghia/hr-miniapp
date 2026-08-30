import type {
  RoomPlatformCall,
  RoomPlatformGateway,
  ServerPlatformScope,
  ServerPlatformTool,
} from './RoomPlatformGateway';
import { SERVER_PLATFORM_TOOL_SCOPES } from './RoomPlatformGateway';
import { parseToolResult } from './parse-tool-result';

const TOOL_CALL_PATH = '/api/v1/mcp-apps.tool-call';

export interface AuthorizedHubClient {
  authorizedFetch(input: string, init: {
    method: 'POST';
    requiredScope: ServerPlatformScope;
    retryMode: 'never';
    headers: Readonly<Record<string, string>>;
    body: string;
  }): Promise<Response>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isServerPlatformTool(value: unknown): value is ServerPlatformTool {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(SERVER_PLATFORM_TOOL_SCOPES, value);
}

function isValidCall(request: unknown): request is RoomPlatformCall {
  if (!isRecord(request)) return false;
  if (typeof request.roomId !== 'string' || !request.roomId.trim()) return false;
  if (!isServerPlatformTool(request.toolName)) return false;
  if (request.requiredScope !== SERVER_PLATFORM_TOOL_SCOPES[request.toolName]) return false;
  return isRecord(request.arguments);
}

export class AgentBotRoomPlatformGateway implements RoomPlatformGateway {
  constructor(
    private readonly hubClient: AuthorizedHubClient,
    private readonly resolveMcpAppId: () => Promise<string | undefined>,
  ) {}

  async call<T>(request: RoomPlatformCall): Promise<T> {
    if (!isValidCall(request)) {
      throw new Error('Room platform call is invalid');
    }

    let resolvedMcpAppId: string | undefined;
    try {
      resolvedMcpAppId = await this.resolveMcpAppId();
    } catch {
      resolvedMcpAppId = undefined;
    }
    const mcpAppId = resolvedMcpAppId?.trim();
    if (!mcpAppId) {
      throw new Error('Room platform gateway is not configured: MCP App id is unavailable');
    }

    let body: string;
    try {
      body = JSON.stringify({
        mcpAppId,
        toolName: request.toolName,
        arguments: request.arguments,
        roomId: request.roomId,
      });
    } catch {
      throw new Error(`${request.toolName} request serialization failed`);
    }

    let response: Response;
    try {
      response = await this.hubClient.authorizedFetch(TOOL_CALL_PATH, {
        method: 'POST',
        requiredScope: request.requiredScope,
        retryMode: 'never',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      throw new Error(`${request.toolName} transport failed`);
    }

    return parseToolResult<T>(response, request.toolName);
  }
}
