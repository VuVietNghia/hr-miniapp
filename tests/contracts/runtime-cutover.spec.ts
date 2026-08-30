import fs from 'node:fs';
import path from 'node:path';

import type { AppMcpHandler } from '@privos_ai/app-server';
import { describe, expect, it, vi } from 'vitest';

import { createApplicationServices } from '../../src/composition/create-application-services';
import { startApplication } from '../../src/server';
import { PayrollService } from '../../src/ui/payroll/services/PayrollService';

const root = path.resolve(import.meta.dirname, '../..');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const emailEnvironment = {
  EMAILJS_SERVICE_ID: 'service-placeholder',
  EMAILJS_TEMPLATE_ID: 'template-placeholder',
  EMAILJS_PUBLIC_KEY: 'public-placeholder',
};

describe('final application composition and cutover', () => {
  it('creates one frozen handler/UI graph with production payroll denied', async () => {
    const services = createApplicationServices({
      environment: emailEnvironment,
      fetchFn: vi.fn<typeof fetch>(),
      hubClient: { authorizedFetch: vi.fn() },
      resolveMcpAppId: async () => undefined,
      uiAssetReader: { readAssets: () => ({ js: 'globalThis.__hr = true;', css: '' }) },
      now: () => '2026-08-30T00:00:00.000Z',
      createEmailRecordId: () => 'email-record-id',
    });
    expect(Object.isFrozen(services)).toBe(true);
    const listed = await services.mcpHandler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }, { transport: 'direct', identityState: 'missing', sessionScope: 'test-list' });
    expect(isRecord(listed) && Array.isArray(listed.tools) ? listed.tools : []).toHaveLength(7);
    await expect(services.mcpHandler({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'hrm.payroll.query', arguments: {} },
    }, {
      transport: 'direct',
      identityState: 'missing',
      sessionScope: 'test-payroll',
      roomId: 'room-1',
    })).rejects.toThrow('Tool execution failed');
  });

  it('uses the same handler only in the selected runtime and never starts both', async () => {
    const handler = vi.fn<AppMcpHandler>();
    const productionRuntime = vi.fn(async (_handler: AppMcpHandler) => undefined);
    const developmentRelay = vi.fn(async (_handler: AppMcpHandler) => undefined);
    const createServices = () => ({ mcpHandler: handler, ui: { read: vi.fn(), setDevPublicUrl: vi.fn() } });

    await startApplication({
      environment: { NODE_ENV: 'production' },
      createServices,
      startRuntime: productionRuntime,
      startRelay: developmentRelay,
    });
    expect(productionRuntime).toHaveBeenCalledWith(handler);
    expect(developmentRelay).not.toHaveBeenCalled();

    productionRuntime.mockClear();
    await startApplication({
      environment: { NODE_ENV: 'development', PRIVOS_TRANSPORT: 'relay' },
      createServices,
      startRuntime: productionRuntime,
      startRelay: developmentRelay,
    });
    expect(developmentRelay).toHaveBeenCalledWith(handler);
    expect(productionRuntime).not.toHaveBeenCalled();
  });

  it('keeps the compatibility handler module construction-free', () => {
    const compatibility = fs.readFileSync(path.join(root, 'src/mcp-message-handlers.ts'), 'utf8');
    expect(compatibility).toBe("export * from './mcp/create-mcp-handler';\n");
    expect(compatibility).not.toContain('new ');
  });

  it('emits only the four authority-free browser payroll payloads', async () => {
    const requests: unknown[] = [];
    const app = {
      async callServerTool(request: unknown): Promise<unknown> {
        requests.push(request);
        return requests.length === 1 ? [] : {};
      },
    };
    const payroll = new PayrollService(app, 'trusted-ui-room');
    const record = {
      employeeId: 'employee-1',
      baseSalary: 1_000_000,
      taxId: '1234567890',
      bankAccount: '12345678',
    };

    await payroll.initializeSchema();
    await payroll.getRecords();
    await payroll.saveRecord(record);
    await payroll.saveRecord({ ...record, _id: 'record-1', roomId: 'spoofed-room' });
    await payroll.deleteRecord('record-1');

    expect(requests).toEqual([
      { name: 'hrm.payroll.query', arguments: {} },
      { name: 'hrm.payroll.create', arguments: { record } },
      { name: 'hrm.payroll.update', arguments: { id: 'record-1', record } },
      { name: 'hrm.payroll.delete', arguments: { id: 'record-1' } },
    ]);
    expect(JSON.stringify(requests)).not.toMatch(/collection|where|filter|password|roomId/);
  });
});
