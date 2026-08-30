import type {
  AppMcpHandler,
  ToolCallContext,
} from '@privos_ai/app-server';

import type { HrApplicationServices } from '../composition/application-services';
import { HR_TOOL_DEFINITIONS } from './tool-definitions';
import {
  parseDashboardInput,
  parseMailRetryInput,
  parseMailSendInput,
  parsePayrollCreateInput,
  parsePayrollDeleteInput,
  parsePayrollQueryInput,
  parsePayrollUpdateInput,
} from './tool-inputs';
import { APP_TOOL_NAMES } from './tool-names';
import { HR_UI_RESOURCE_URI } from './ui-resource';

const INVALID_TOOL_CALL = 'Invalid tool call';
const INVALID_RESOURCE_REQUEST = 'Invalid resource request';
const TOOL_EXECUTION_FAILED = 'Tool execution failed';

type ParsedProperties = ReadonlyMap<string, unknown>;

interface ToolCallParameters {
  name: string;
  arguments: unknown;
}

function invalidRequest(message: string): never {
  throw new TypeError(message);
}

function readExactObject(
  value: unknown,
  allowedKeys: readonly string[],
  errorMessage: string,
): ParsedProperties {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return invalidRequest(errorMessage);
    }

    const properties = new Map<string, unknown>();
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !allowedKeys.includes(key)) {
        return invalidRequest(errorMessage);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
        return invalidRequest(errorMessage);
      }
      properties.set(key, descriptor.value);
    }
    return properties;
  } catch {
    return invalidRequest(errorMessage);
  }
}

function readToolCallParameters(params: unknown): ToolCallParameters {
  const properties = readExactObject(params, ['name', 'arguments'], INVALID_TOOL_CALL);
  const name = properties.get('name');
  if (!properties.has('name') || typeof name !== 'string' || !properties.has('arguments')) {
    return invalidRequest(INVALID_TOOL_CALL);
  }
  return { name, arguments: properties.get('arguments') };
}

export function readRequestedUri(params: unknown): string {
  if (params === undefined) return HR_UI_RESOURCE_URI;
  const properties = readExactObject(params, ['uri'], INVALID_RESOURCE_REQUEST);
  if (!properties.has('uri')) return HR_UI_RESOURCE_URI;
  const uri = properties.get('uri');
  if (typeof uri !== 'string') return invalidRequest(INVALID_RESOURCE_REQUEST);
  return uri;
}

async function executeTool(operation: () => unknown | Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch {
    throw new Error(TOOL_EXECUTION_FAILED);
  }
}

export async function handleToolCall(
  params: unknown,
  context: ToolCallContext,
  services: HrApplicationServices,
): Promise<unknown> {
  const toolCall = readToolCallParameters(params);

  switch (toolCall.name) {
    case APP_TOOL_NAMES.dashboard:
      parseDashboardInput(toolCall.arguments);
      return executeTool(() => ({
        content: [{
          type: 'resource',
          resource: services.ui.read(HR_UI_RESOURCE_URI),
        }],
      }));
    case APP_TOOL_NAMES.mailSend: {
      const input = parseMailSendInput(toolCall.arguments);
      return executeTool(() => services.mail.send(input, context.actor, context.roomId));
    }
    case APP_TOOL_NAMES.mailRetry: {
      const input = parseMailRetryInput(toolCall.arguments);
      return executeTool(() => services.mail.retry(input, context.actor, context.roomId));
    }
    case APP_TOOL_NAMES.payrollQuery:
      parsePayrollQueryInput(toolCall.arguments);
      return executeTool(() => services.payroll.query(context.actor, context.roomId));
    case APP_TOOL_NAMES.payrollCreate: {
      const input = parsePayrollCreateInput(toolCall.arguments);
      return executeTool(() => services.payroll.create(input, context.actor, context.roomId));
    }
    case APP_TOOL_NAMES.payrollUpdate: {
      const input = parsePayrollUpdateInput(toolCall.arguments);
      return executeTool(() => services.payroll.update(input, context.actor, context.roomId));
    }
    case APP_TOOL_NAMES.payrollDelete: {
      const input = parsePayrollDeleteInput(toolCall.arguments);
      return executeTool(() => services.payroll.delete(input, context.actor, context.roomId));
    }
    default:
      throw new Error('Unknown tool');
  }
}

export function createMcpHandler(services: HrApplicationServices): AppMcpHandler {
  return async (request, context) => {
    switch (request.method) {
      case 'tools/list':
        return { tools: HR_TOOL_DEFINITIONS };
      case 'tools/call':
        return handleToolCall(request.params, context, services);
      case 'resources/read':
        return { contents: [services.ui.read(readRequestedUri(request.params))] };
      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  };
}
