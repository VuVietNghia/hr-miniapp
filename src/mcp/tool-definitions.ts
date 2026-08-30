import { APP_TOOL_NAMES } from './tool-names';
import { HR_UI_RESOURCE_URI } from './ui-resource';

const STRING_SCHEMA = Object.freeze({ type: 'string' as const });
const NUMBER_SCHEMA = Object.freeze({ type: 'number' as const });
const BOOLEAN_SCHEMA = Object.freeze({ type: 'boolean' as const });

const DASHBOARD_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({ roomId: STRING_SCHEMA }),
  additionalProperties: false,
});

const NO_ARGUMENTS_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({}),
  additionalProperties: false,
});

const MAIL_SEND_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({
    toName: STRING_SCHEMA,
    toEmail: STRING_SCHEMA,
    subject: STRING_SCHEMA,
    htmlContent: STRING_SCHEMA,
    roomId: STRING_SCHEMA,
    source: Object.freeze({
      type: 'string' as const,
      enum: Object.freeze(['cv_scored', 'lifecycle'] as const),
    }),
    cvItemId: STRING_SCHEMA,
    cvListId: STRING_SCHEMA,
    jdName: STRING_SCHEMA,
  }),
  required: Object.freeze(['toName', 'toEmail', 'subject', 'htmlContent'] as const),
  additionalProperties: false,
});

const MAIL_RETRY_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({
    roomId: STRING_SCHEMA,
    itemId: STRING_SCHEMA,
  }),
  required: Object.freeze(['roomId', 'itemId'] as const),
  additionalProperties: false,
});

const PAYROLL_RECORD_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({
    employeeId: STRING_SCHEMA,
    baseSalary: NUMBER_SCHEMA,
    taxId: STRING_SCHEMA,
    bankAccount: STRING_SCHEMA,
    bankName: STRING_SCHEMA,
    contractType: STRING_SCHEMA,
    applyProbationRate: BOOLEAN_SCHEMA,
    probationRate: NUMBER_SCHEMA,
  }),
  required: Object.freeze(['employeeId', 'baseSalary', 'taxId', 'bankAccount'] as const),
  additionalProperties: false,
});

const PAYROLL_CREATE_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({ record: PAYROLL_RECORD_SCHEMA }),
  required: Object.freeze(['record'] as const),
  additionalProperties: false,
});

const PAYROLL_UPDATE_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({
    id: STRING_SCHEMA,
    record: PAYROLL_RECORD_SCHEMA,
  }),
  required: Object.freeze(['id', 'record'] as const),
  additionalProperties: false,
});

const PAYROLL_DELETE_INPUT_SCHEMA = Object.freeze({
  type: 'object' as const,
  properties: Object.freeze({ id: STRING_SCHEMA }),
  required: Object.freeze(['id'] as const),
  additionalProperties: false,
});

export const HR_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: APP_TOOL_NAMES.dashboard,
    title: 'HR Mini app V3',
    description: 'Open the Room-scoped HR management dashboard.',
    inputSchema: DASHBOARD_INPUT_SCHEMA,
    ui: Object.freeze({ resourceUri: HR_UI_RESOURCE_URI }),
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.payrollQuery,
    title: 'Query payroll records',
    description: 'Query payroll_records for the verified Room.',
    inputSchema: NO_ARGUMENTS_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.mailSend,
    title: 'Send tracked HR email',
    description: 'Send an HR email and track delivery in the Room email-history List.',
    inputSchema: MAIL_SEND_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.mailRetry,
    title: 'Retry tracked HR email',
    description: 'Retry one failed tracked email from the Room email-history List.',
    inputSchema: MAIL_RETRY_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.payrollCreate,
    title: 'Create payroll record',
    description: 'Create a payroll_records entry in the verified Room.',
    inputSchema: PAYROLL_CREATE_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.payrollUpdate,
    title: 'Update payroll record',
    description: 'Update a payroll_records entry in the verified Room.',
    inputSchema: PAYROLL_UPDATE_INPUT_SCHEMA,
  }),
  Object.freeze({
    name: APP_TOOL_NAMES.payrollDelete,
    title: 'Delete payroll record',
    description: 'Delete a payroll_records entry from the verified Room.',
    inputSchema: PAYROLL_DELETE_INPUT_SCHEMA,
  }),
]);
