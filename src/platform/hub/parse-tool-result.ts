import type { ServerPlatformTool } from './RoomPlatformGateway';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resultError(
  toolName: ServerPlatformTool,
  status: number,
  reason: string,
): Error {
  return new Error(`${toolName} ${reason} (status ${status})`);
}

export async function parseToolResult<T>(
  response: Response,
  toolName: ServerPlatformTool,
): Promise<T> {
  if (!response.ok) {
    throw resultError(toolName, response.status, 'failed');
  }

  let envelopeText: string;
  try {
    envelopeText = await response.text();
  } catch {
    throw resultError(toolName, response.status, 'returned an unreadable envelope');
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(envelopeText);
  } catch {
    throw resultError(toolName, response.status, 'returned an invalid envelope');
  }

  if (!isRecord(envelope)) {
    throw resultError(toolName, response.status, 'returned an invalid envelope');
  }
  if (envelope.success === false) {
    throw resultError(toolName, response.status, 'failed');
  }
  if (envelope.success !== true) {
    throw resultError(toolName, response.status, 'returned an invalid envelope');
  }

  const firstContent = Array.isArray(envelope.content) ? envelope.content[0] : undefined;
  if (!isRecord(firstContent) || typeof firstContent.text !== 'string') {
    throw resultError(toolName, response.status, 'returned a malformed result');
  }

  try {
    return JSON.parse(firstContent.text);
  } catch {
    throw resultError(toolName, response.status, 'returned invalid JSON');
  }
}
