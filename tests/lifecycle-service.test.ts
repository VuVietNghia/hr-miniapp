import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpApp } from '@privos/app-react';
import { PrivOSLifecycleService } from '../src/ui/lifecycle/services/PrivOSLifecycleService';

interface ToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

function toolResponse(payload: unknown) {
  return { content: [{ text: JSON.stringify(payload) }] };
}

test('keeps an existing HR list when stage configuration is malformed', async () => {
  const calls: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'privos.lists.getAll') {
        return toolResponse([{
          _id: 'hr-list',
          name: '[HR-MiniApp] Employee profiles',
          stages: [],
          fieldDefinitions: [],
        }]);
      }
      if (request.name === 'privos.lists.searchItems') {
        return toolResponse([{
          _id: 'config-item',
          title: '[Hệ thống] Không xoá - Cấu hình Kanban',
          description: '{invalid-json',
        }]);
      }
      if (request.name === 'privos.lists.getItems') {
        return toolResponse({ items: [], count: 0, offset: 0, total: 0 });
      }
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  const result = await new PrivOSLifecycleService(app).loadProfiles('room-1');

  assert.equal(result.status, 'degraded');
  assert.equal(calls.some((call) => call.name === 'privos.lists.deleteMany'), false);
  assert.equal(calls.some((call) => call.name === 'privos.lists.create'), false);
});

test('does not create a local profile when PrivOS omits the persisted ID', async () => {
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'privos.lists.getAll') {
        return toolResponse([{
          _id: 'hr-list',
          name: '[HR-MiniApp] Employee profiles',
          stages: [{ _id: 'new', name: 'New employee' }],
          fieldDefinitions: [],
        }]);
      }
      if (request.name === 'privos.lists.searchItems') return toolResponse([]);
      if (request.name === 'privos.lists.createItem') return toolResponse({});
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await assert.rejects(
    () => new PrivOSLifecycleService(app).createProfile('room-1', { name: 'Employee' }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'PROFILE_CREATE_STATUS_UNKNOWN');
      assert.doesNotMatch(String((error as Error).message), /local-/u);
      return true;
    },
  );
});

test('does not send raw stage data to the debug tool', async () => {
  const calls: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      calls.push(request);
      if (request.name === 'privos.lists.getAll') {
        return toolResponse([{
          _id: 'hr-list',
          name: '[HR-MiniApp] Employee profiles',
          stages: [{ _id: 'new', name: 'New employee' }],
          fieldDefinitions: [],
        }]);
      }
      if (request.name === 'privos.lists.searchItems') return toolResponse([]);
      if (request.name === 'privos.lists.getItems') {
        return toolResponse({
          items: [{ _id: 'employee-1', name: 'Private Name', stageId: 'unknown-stage' }],
          count: 1,
          offset: 0,
          total: 1,
        });
      }
      if (request.name === 'debug_log') return toolResponse({});
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  await new PrivOSLifecycleService(app).loadProfiles('room-1');

  assert.equal(calls.some((call) => call.name === 'debug_log'), false);
});
