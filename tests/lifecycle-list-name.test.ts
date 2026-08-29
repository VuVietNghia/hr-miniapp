import assert from 'node:assert/strict';
import test from 'node:test';

import { PrivOSLifecycleService } from '../src/ui/lifecycle/services/PrivOSLifecycleService';

type ToolRequest = {
  name: string;
  arguments: Record<string, unknown>;
};

function textResult(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

test('loads employee profiles from the exact "Hồ sơ nhân sự" List', async () => {
  const requests: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      requests.push(request);

      if (request.name === 'privos.lists.getAll') {
        return textResult([
          {
            _id: 'prefixed-list',
            name: '[HR-MiniApp] Hồ sơ nhân sự',
            stages: [{ _id: 'stage-new-prefixed', name: 'Mới nhận việc' }],
            fieldDefinitions: [],
          },
          {
            _id: 'employee-list',
            name: 'Hồ sơ nhân sự',
            stages: [{ _id: 'stage-new', name: 'Mới nhận việc' }],
            fieldDefinitions: [],
          },
        ]);
      }

      if (request.name === 'privos.lists.searchItems') {
        return textResult([]);
      }

      if (request.name === 'privos.lists.getItems') {
        return textResult([
          {
            _id: 'employee-1',
            title: request.arguments.listId === 'employee-list' ? 'Đúng List' : 'Sai List',
            stageId: 'stage-new',
          },
        ]);
      }

      if (request.name === 'debug_log') {
        return textResult({ logged: true });
      }

      throw new Error(`Unexpected tool call: ${request.name}`);
    },
  };

  const service = new PrivOSLifecycleService(app as never);
  const profiles = await service.loadProfiles('room-1');

  assert.equal(profiles[0]?.name, 'Đúng List');
  assert.equal(
    requests.find((request) => request.name === 'privos.lists.getItems')?.arguments.listId,
    'employee-list',
  );
});

test('creates the employee List with the exact name "Hồ sơ nhân sự"', async () => {
  const requests: ToolRequest[] = [];
  const app = {
    async callServerTool(request: ToolRequest) {
      requests.push(request);

      if (request.name === 'privos.lists.getAll') {
        return textResult([]);
      }

      if (request.name === 'privos.lists.create') {
        return textResult({
          list: { _id: 'employee-list', name: request.arguments.name, fieldDefinitions: [] },
          stages: [{ _id: 'stage-new', name: 'Mới nhận việc' }],
        });
      }

      if (request.name === 'privos.lists.createItem') {
        return textResult({ _id: 'config-item' });
      }

      if (request.name === 'privos.lists.getItems') {
        return textResult([]);
      }

      throw new Error(`Unexpected tool call: ${request.name}`);
    },
  };

  const service = new PrivOSLifecycleService(app as never);
  await service.loadProfiles('room-1');

  assert.equal(
    requests.find((request) => request.name === 'privos.lists.create')?.arguments.name,
    'Hồ sơ nhân sự',
  );
});
