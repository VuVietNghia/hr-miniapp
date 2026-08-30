import type {
  ApplicationMcpRequest,
  ToolCallContext,
  VerifiedActor,
} from '@privos_ai/app-server';
import { describe, expect, it, vi } from 'vitest';

import type { HrApplicationServices } from '../../src/composition/application-services';
import { createMcpHandler } from '../../src/mcp/create-mcp-handler';
import { HR_TOOL_DEFINITIONS } from '../../src/mcp/tool-definitions';
import {
  parseDashboardInput,
  parseMailRetryInput,
  parseMailSendInput,
  parsePayrollCreateInput,
  parsePayrollDeleteInput,
  parsePayrollQueryInput,
  parsePayrollUpdateInput,
} from '../../src/mcp/tool-inputs';
import { APP_TOOL_NAMES } from '../../src/mcp/tool-names';
import {
  HR_UI_RESOURCE_MIME,
  HR_UI_RESOURCE_URI,
  type HrUiResourceProvider,
} from '../../src/mcp/ui-resource';
import type { PayrollRecordInput } from '../../src/payroll/payroll-types';

const actor: VerifiedActor = Object.freeze({
  userId: 'verified-user',
  username: 'Verified User',
  roomId: 'actor-room',
  claims: Object.freeze({ sub: 'verified-user', rid: 'actor-room' }),
  provenance: 'user-token',
});

const context: ToolCallContext = {
  transport: 'relay',
  requestId: 41,
  actor,
  roomId: 'context-room',
  identityState: 'verified',
  sessionScope: 'relay:test',
};

const payrollRecord: PayrollRecordInput = {
  employeeId: 'employee-1',
  baseSalary: 50_000_000,
  taxId: '0123456789',
  bankAccount: '123456789',
  bankName: 'Bank One',
  contractType: 'probation',
  applyProbationRate: true,
  probationRate: 85,
};

type ServiceCall<TInput> = Readonly<{
  input: TInput;
  actor: VerifiedActor | undefined;
  roomId: string | undefined;
}>;

function createFixture() {
  const mailSendCalls: ServiceCall<
    Parameters<HrApplicationServices['mail']['send']>[0]
  >[] = [];
  const mailRetryCalls: ServiceCall<
    Parameters<HrApplicationServices['mail']['retry']>[0]
  >[] = [];
  const payrollQueryCalls: Omit<ServiceCall<never>, 'input'>[] = [];
  const payrollCreateCalls: ServiceCall<
    Parameters<HrApplicationServices['payroll']['create']>[0]
  >[] = [];
  const payrollUpdateCalls: ServiceCall<
    Parameters<HrApplicationServices['payroll']['update']>[0]
  >[] = [];
  const payrollDeleteCalls: ServiceCall<
    Parameters<HrApplicationServices['payroll']['delete']>[0]
  >[] = [];
  const uiReadCalls: string[] = [];
  const calls = {
    mailSend: mailSendCalls,
    mailRetry: mailRetryCalls,
    payrollQuery: payrollQueryCalls,
    payrollCreate: payrollCreateCalls,
    payrollUpdate: payrollUpdateCalls,
    payrollDelete: payrollDeleteCalls,
    uiRead: uiReadCalls,
  };

  const ui: HrUiResourceProvider = {
    read(uri) {
      calls.uiRead.push(uri);
      if (uri !== HR_UI_RESOURCE_URI) {
        throw new Error(`Provider rejected URI: ${uri}`);
      }
      return {
        uri: HR_UI_RESOURCE_URI,
        mimeType: HR_UI_RESOURCE_MIME,
        text: '<html>HR UI</html>',
      };
    },
    setDevPublicUrl: () => undefined,
  };

  const services: HrApplicationServices = {
    mail: {
      async send(input, verifiedActor, roomId) {
        calls.mailSend.push({ input, actor: verifiedActor, roomId });
        return { result: 'mail-send' };
      },
      async retry(input, verifiedActor, roomId) {
        calls.mailRetry.push({ input, actor: verifiedActor, roomId });
        return { result: 'mail-retry' };
      },
    },
    payroll: {
      async query(verifiedActor, roomId) {
        calls.payrollQuery.push({ actor: verifiedActor, roomId });
        return { result: 'payroll-query' };
      },
      async create(input, verifiedActor, roomId) {
        calls.payrollCreate.push({ input, actor: verifiedActor, roomId });
        return { result: 'payroll-create' };
      },
      async update(input, verifiedActor, roomId) {
        calls.payrollUpdate.push({ input, actor: verifiedActor, roomId });
        return { result: 'payroll-update' };
      },
      async delete(input, verifiedActor, roomId) {
        calls.payrollDelete.push({ input, actor: verifiedActor, roomId });
        return { result: 'payroll-delete' };
      },
    },
    ui,
  };

  return { calls, handler: createMcpHandler(services), services };
}

function request(method: string, params?: unknown): ApplicationMcpRequest {
  return {
    jsonrpc: '2.0',
    id: 41,
    method,
    ...(params === undefined ? {} : { params }),
  };
}

function toolCall(name: string, argumentsValue: unknown): ApplicationMcpRequest {
  return request('tools/call', { name, arguments: argumentsValue });
}

function totalBusinessCalls(calls: ReturnType<typeof createFixture>['calls']): number {
  return calls.mailSend.length
    + calls.mailRetry.length
    + calls.payrollQuery.length
    + calls.payrollCreate.length
    + calls.payrollUpdate.length
    + calls.payrollDelete.length;
}

describe('MCP handler routing', () => {
  it('lists only the reviewed HR tool definitions', async () => {
    const { handler } = createFixture();

    const result = await handler(request('tools/list'), context);

    expect(result).toEqual({ tools: HR_TOOL_DEFINITIONS });
    expect(HR_TOOL_DEFINITIONS.map((tool) => tool.name)).not.toContain('debug_log');
    expect(HR_TOOL_DEFINITIONS.map((tool) => tool.name)).not.toContain('hr_whoami');
  });

  it('returns the injected UI resource for the dashboard tool', async () => {
    const { calls, handler } = createFixture();

    const result = await handler(toolCall(APP_TOOL_NAMES.dashboard, {}), context);

    expect(result).toEqual({
      content: [{
        type: 'resource',
        resource: {
          uri: HR_UI_RESOURCE_URI,
          mimeType: HR_UI_RESOURCE_MIME,
          text: '<html>HR UI</html>',
        },
      }],
    });
    expect(calls.uiRead).toEqual([HR_UI_RESOURCE_URI]);
    expect(totalBusinessCalls(calls)).toBe(0);
  });

  it('routes mail send with a rebuilt input and exact trusted context', async () => {
    const { calls, handler } = createFixture();
    const rawInput = {
      toName: 'Candidate One',
      toEmail: 'candidate@example.test',
      subject: 'Interview',
      htmlContent: '<p>Invitation</p>',
      roomId: 'argument-room',
      source: 'cv_scored',
      cvItemId: 'cv-item-1',
      cvListId: 'cv-list-1',
      jdName: 'Backend Engineer',
    };

    const result = await handler(toolCall(APP_TOOL_NAMES.mailSend, rawInput), context);

    expect(result).toEqual({ result: 'mail-send' });
    expect(calls.mailSend).toEqual([{
      input: rawInput,
      actor,
      roomId: 'context-room',
    }]);
    expect(calls.mailSend[0]?.input).not.toBe(rawInput);
    expect(totalBusinessCalls(calls)).toBe(1);
  });

  it('routes mail retry with the exact trusted actor and context Room', async () => {
    const { calls, handler } = createFixture();

    const result = await handler(toolCall(APP_TOOL_NAMES.mailRetry, {
      roomId: 'argument-room',
      itemId: 'mail-item-1',
    }), context);

    expect(result).toEqual({ result: 'mail-retry' });
    expect(calls.mailRetry).toEqual([{
      input: { roomId: 'argument-room', itemId: 'mail-item-1' },
      actor,
      roomId: 'context-room',
    }]);
    expect(totalBusinessCalls(calls)).toBe(1);
  });

  it('routes all four payroll operations with exact trusted context', async () => {
    const { calls, handler } = createFixture();

    await expect(handler(
      toolCall(APP_TOOL_NAMES.payrollQuery, {}),
      context,
    )).resolves.toEqual({ result: 'payroll-query' });
    await expect(handler(
      toolCall(APP_TOOL_NAMES.payrollCreate, { record: payrollRecord }),
      context,
    )).resolves.toEqual({ result: 'payroll-create' });
    await expect(handler(
      toolCall(APP_TOOL_NAMES.payrollUpdate, { id: 'payroll-1', record: payrollRecord }),
      context,
    )).resolves.toEqual({ result: 'payroll-update' });
    await expect(handler(
      toolCall(APP_TOOL_NAMES.payrollDelete, { id: 'payroll-1' }),
      context,
    )).resolves.toEqual({ result: 'payroll-delete' });

    expect(calls.payrollQuery).toEqual([{ actor, roomId: 'context-room' }]);
    expect(calls.payrollCreate).toEqual([{
      input: { record: payrollRecord },
      actor,
      roomId: 'context-room',
    }]);
    expect(calls.payrollCreate[0]?.input.record).not.toBe(payrollRecord);
    expect(calls.payrollUpdate).toEqual([{
      input: { id: 'payroll-1', record: payrollRecord },
      actor,
      roomId: 'context-room',
    }]);
    expect(calls.payrollUpdate[0]?.input.record).not.toBe(payrollRecord);
    expect(calls.payrollDelete).toEqual([{
      input: { id: 'payroll-1' },
      actor,
      roomId: 'context-room',
    }]);
  });

  it('rejects unknown tools before invoking any dependency', async () => {
    const { calls, handler } = createFixture();

    await expect(handler(toolCall('unknown.tool', { secret: 'do-not-read' }), context))
      .rejects.toThrow('Unknown tool');

    expect(totalBusinessCalls(calls)).toBe(0);
    expect(calls.uiRead).toHaveLength(0);
  });

  it('defaults an omitted resource URI and forwards an explicit URI to the provider', async () => {
    const { calls, handler } = createFixture();

    await expect(handler(request('resources/read'), context)).resolves.toEqual({
      contents: [{
        uri: HR_UI_RESOURCE_URI,
        mimeType: HR_UI_RESOURCE_MIME,
        text: '<html>HR UI</html>',
      }],
    });
    await expect(handler(
      request('resources/read', { uri: HR_UI_RESOURCE_URI }),
      context,
    )).resolves.toEqual({
      contents: [{
        uri: HR_UI_RESOURCE_URI,
        mimeType: HR_UI_RESOURCE_MIME,
        text: '<html>HR UI</html>',
      }],
    });

    expect(calls.uiRead).toEqual([HR_UI_RESOURCE_URI, HR_UI_RESOURCE_URI]);
  });

  it('rejects malformed resource params and lets the provider reject an unknown URI', async () => {
    const { calls, handler } = createFixture();

    await expect(handler(request('resources/read', { uri: 42 }), context))
      .rejects.toThrow('Invalid resource request');
    await expect(handler(request('resources/read', { uri: HR_UI_RESOURCE_URI, extra: true }), context))
      .rejects.toThrow('Invalid resource request');
    await expect(handler(request('resources/read', { uri: 'ui://unknown/resource.html' }), context))
      .rejects.toThrow('Provider rejected URI');

    expect(calls.uiRead).toEqual(['ui://unknown/resource.html']);
  });

  it('rejects unsupported MCP methods', async () => {
    const { handler } = createFixture();

    await expect(handler(request('prompts/list'), context))
      .rejects.toThrow('Unknown method: prompts/list');
  });
});

describe('MCP tool input parsers', () => {
  it('rebuilds every accepted input from its exact whitelist', () => {
    const mailSend = {
      toName: 'Candidate One',
      toEmail: 'candidate@example.test',
      subject: 'Interview',
      htmlContent: '<p>Invitation</p>',
      roomId: 'room-1',
      source: 'lifecycle',
      cvItemId: 'cv-1',
      cvListId: 'list-1',
      jdName: 'Engineer',
    };

    expect(parseDashboardInput({ roomId: 'room-1' })).toEqual({ roomId: 'room-1' });
    expect(parsePayrollQueryInput({})).toEqual({});
    expect(parseMailSendInput(mailSend)).toEqual(mailSend);
    expect(parseMailSendInput(mailSend)).not.toBe(mailSend);
    expect(parseMailRetryInput({ roomId: 'room-1', itemId: 'item-1' })).toEqual({
      roomId: 'room-1',
      itemId: 'item-1',
    });
    expect(parsePayrollCreateInput({ record: payrollRecord })).toEqual({ record: payrollRecord });
    expect(parsePayrollUpdateInput({ id: 'record-1', record: payrollRecord })).toEqual({
      id: 'record-1',
      record: payrollRecord,
    });
    expect(parsePayrollDeleteInput({ id: 'record-1' })).toEqual({ id: 'record-1' });
  });

  it.each([
    ['dashboard', parseDashboardInput, { roomId: 'room-1', unexpected: true }],
    ['query', parsePayrollQueryInput, { unexpected: true }],
    ['mail send', parseMailSendInput, {
      toName: 'Candidate',
      toEmail: 'candidate@example.test',
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
      requestedBy: 'spoofed-user',
    }],
    ['mail retry', parseMailRetryInput, { roomId: 'room-1', itemId: 'item-1', extra: true }],
    ['payroll create', parsePayrollCreateInput, { record: payrollRecord, roomId: 'spoofed-room' }],
    ['payroll update', parsePayrollUpdateInput, {
      id: 'record-1',
      record: payrollRecord,
      owner: true,
    }],
    ['payroll delete', parsePayrollDeleteInput, { id: 'record-1', password: 'secret' }],
  ])('rejects unknown top-level keys for %s', (_label, parser, input) => {
    expect(() => parser(input)).toThrow('Invalid tool arguments');
  });

  it.each([
    null,
    undefined,
    [],
    'not-an-object',
    42,
    Object.create({ roomId: 'inherited-room' }),
  ])('rejects non-plain input objects', (input) => {
    expect(() => parseDashboardInput(input)).toThrow('Invalid tool arguments');
  });

  it('rejects accessors without evaluating them', () => {
    const input = {};
    const getter = vi.fn(() => 'room-1');
    Object.defineProperty(input, 'roomId', { enumerable: true, get: getter });

    expect(() => parseDashboardInput(input)).toThrow('Invalid tool arguments');
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects missing, mistyped, and unsupported mail fields', () => {
    expect(() => parseMailSendInput({
      toName: 'Candidate',
      toEmail: 'candidate@example.test',
      subject: 'Subject',
    })).toThrow('Invalid tool arguments');
    expect(() => parseMailSendInput({
      toName: 'Candidate',
      toEmail: 'candidate@example.test',
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
      source: 'spoofed-source',
    })).toThrow('Invalid tool arguments');
    expect(() => parseMailRetryInput({ roomId: 'room-1', itemId: 7 }))
      .toThrow('Invalid tool arguments');
  });

  it('rejects unknown keys and custom prototypes in nested payroll records', () => {
    expect(() => parsePayrollCreateInput({
      record: { ...payrollRecord, roomId: 'spoofed-room' },
    })).toThrow('Invalid tool arguments');

    const prototypeRecord: unknown = Object.assign(
      Object.create({ isOwner: true }),
      payrollRecord,
    );
    expect(() => parsePayrollCreateInput({ record: prototypeRecord }))
      .toThrow('Invalid tool arguments');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite payroll numbers: %s',
    (invalidNumber) => {
      expect(() => parsePayrollCreateInput({
        record: { ...payrollRecord, baseSalary: invalidNumber },
      })).toThrow('Invalid tool arguments');
      expect(() => parsePayrollUpdateInput({
        id: 'record-1',
        record: { ...payrollRecord, probationRate: invalidNumber },
      })).toThrow('Invalid tool arguments');
    },
  );
});

describe('MCP tool error boundary', () => {
  it('maps mail service failures to one generic error without logging internals', async () => {
    const { handler, services } = createFixture();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    services.mail.send = async () => {
      throw new Error('secret-token candidate@example.test full-document-body');
    };

    await expect(handler(toolCall(APP_TOOL_NAMES.mailSend, {
      toName: 'Candidate',
      toEmail: 'candidate@example.test',
      subject: 'Subject',
      htmlContent: '<p>PII document</p>',
    }), context)).rejects.toThrow(/^Tool execution failed$/);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('maps non-Error payroll failures to the same generic error', async () => {
    const { handler, services } = createFixture();
    services.payroll.query = async () => {
      throw { secret: 'database-secret', documents: [payrollRecord] };
    };

    await expect(handler(toolCall(APP_TOOL_NAMES.payrollQuery, {}), context))
      .rejects.toThrow(/^Tool execution failed$/);
  });
});
