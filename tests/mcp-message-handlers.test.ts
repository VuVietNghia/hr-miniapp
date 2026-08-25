import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMcpMessage } from '../src/mcp-message-handlers';

test('does not write MCP protocol traffic to stdout', async () => {
  const originalLog = console.log;
  const logs: unknown[][] = [];
  console.log = (...args: unknown[]) => logs.push(args);

  try {
    await handleMcpMessage('initialize', 1, {});
    await handleMcpMessage('tools/list', 2, {});
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(logs, []);
});
