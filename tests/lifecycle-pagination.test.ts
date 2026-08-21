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

test('loads all 101 employee profiles using offset pagination', async () => {
  const employees = Array.from({ length: 101 }, (_, index) => ({
    _id: `employee-${index + 1}`,
    name: `Employee ${index + 1}`,
    stageId: 'active',
  }));
  const requestedOffsets: number[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      if (request.name === 'privos.lists.getAll') {
        return toolResponse([{
          _id: 'hr-list',
          name: '[HR-MiniApp] Employee profiles',
          stages: [{ _id: 'active', name: 'Active' }],
          fieldDefinitions: [],
        }]);
      }
      if (request.name === 'privos.lists.searchItems') return toolResponse([]);
      if (request.name === 'privos.lists.getItems') {
        const offset = Number(request.arguments?.offset ?? 0);
        const count = Number(request.arguments?.count ?? 100);
        requestedOffsets.push(offset);
        const items = employees.slice(offset, offset + count);
        return toolResponse({ items, count: items.length, offset, total: employees.length });
      }
      throw new Error(`Unexpected tool: ${request.name}`);
    },
  } as unknown as McpApp;

  const result = await new PrivOSLifecycleService(app).loadProfiles('room-1');

  assert.equal(result.status, 'success');
  if (result.status === 'success') {
    assert.equal(result.records.length, 101);
    assert.equal(result.isComplete, true);
  }
  assert.deepEqual(requestedOffsets, [0, 100]);
});
