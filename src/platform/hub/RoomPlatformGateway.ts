export type ServerPlatformScope =
  | 'lists:read'
  | 'lists:write'
  | 'db:read'
  | 'db:write'
  | 'db:schema:read'
  | 'db:schema:write';

export const SERVER_PLATFORM_TOOL_SCOPES = {
  'mcpapp.lists.create': 'lists:write',
  'mcpapp.lists.addField': 'lists:write',
  'mcpapp.lists.createItem': 'lists:write',
  'mcpapp.lists.getItems': 'lists:read',
  'mcpapp.lists.updateCustomField': 'lists:write',
  'mcpapp.db.registerCollection': 'db:schema:write',
  'mcpapp.db.create': 'db:write',
  'mcpapp.db.query': 'db:read',
  'mcpapp.db.getSchema': 'db:schema:read',
} as const satisfies Readonly<Record<string, ServerPlatformScope>>;

export type ServerPlatformTool = keyof typeof SERVER_PLATFORM_TOOL_SCOPES;

export type RoomPlatformCall = {
  readonly [Tool in ServerPlatformTool]: Readonly<{
    roomId: string;
    requiredScope: (typeof SERVER_PLATFORM_TOOL_SCOPES)[Tool];
    toolName: Tool;
    arguments: Readonly<Record<string, unknown>>;
  }>;
}[ServerPlatformTool];

export interface RoomPlatformGateway {
  call<T>(request: RoomPlatformCall): Promise<T>;
}
