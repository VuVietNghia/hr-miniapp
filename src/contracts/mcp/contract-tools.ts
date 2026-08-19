const commonContractProperties = {
  roomId: { type: 'string' },
  contractNumber: { type: 'string', maxLength: 100 },
  contractType: { type: 'string', enum: ['FIXED_TERM', 'INDEFINITE'] },
  startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  position: { type: 'string' },
  department: { type: 'string' },
  workLocation: { type: 'string' },
  baseSalary: { type: 'number', minimum: 1 },
};

const contractFieldsRequired = [
  'roomId',
  'contractNumber',
  'contractType',
  'startDate',
  'position',
  'department',
  'workLocation',
  'baseSalary',
];

export const CONTRACT_TOOL_DEFINITIONS = [
  {
    name: 'hrm.contracts.getSummaries',
    title: 'Get employee contract summaries',
    description: 'Returns redacted contract status summaries for employee profiles.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string' },
        employeeIds: { type: 'array', items: { type: 'string' }, maxItems: 500 },
      },
      required: ['roomId', 'employeeIds'],
    },
  },
  {
    name: 'hrm.contracts.listByEmployee',
    title: 'List employee contracts',
    description: 'Lists full contracts for an employee. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { roomId: { type: 'string' }, employeeId: { type: 'string' } },
      required: ['roomId', 'employeeId'],
    },
  },
  {
    name: 'hrm.contracts.get',
    title: 'Get contract detail',
    description: 'Gets contract, documents and audit events. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { roomId: { type: 'string' }, contractId: { type: 'string' } },
      required: ['roomId', 'contractId'],
    },
  },
  {
    name: 'hrm.contracts.createDraft',
    title: 'Create contract draft',
    description: 'Creates a new labor contract draft. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { ...commonContractProperties, employeeId: { type: 'string' }, previousContractId: { type: 'string' } },
      required: [...contractFieldsRequired, 'employeeId'],
    },
  },
  {
    name: 'hrm.contracts.updateDraft',
    title: 'Update contract draft',
    description: 'Updates an editable contract draft. HR role required.',
    inputSchema: {
      type: 'object',
      properties: {
        ...commonContractProperties,
        contractId: { type: 'string' },
        expectedRevision: { type: 'number', minimum: 1 },
      },
      required: [...contractFieldsRequired, 'contractId', 'expectedRevision'],
    },
  },
  {
    name: 'hrm.contracts.submitForSignature',
    title: 'Submit contract for signature',
    description: 'Locks a draft and moves it to pending signature. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { roomId: { type: 'string' }, contractId: { type: 'string' } },
      required: ['roomId', 'contractId'],
    },
  },
  {
    name: 'hrm.contracts.attachSignedDocument',
    title: 'Attach signed contract PDF',
    description: 'Links an immutable signed PDF to a pending contract. HR role required.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string' },
        contractId: { type: 'string' },
        fileId: { type: 'string' },
        fileName: { type: 'string' },
        mimeType: { type: 'string', const: 'application/pdf' },
        fileSize: { type: 'number', minimum: 1, maximum: 10485760 },
        signedDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      required: ['roomId', 'contractId', 'fileId', 'fileName', 'mimeType', 'fileSize', 'signedDate'],
    },
  },
  {
    name: 'hrm.contracts.activate',
    title: 'Activate signed contract',
    description: 'Activates a signed contract after overlap checks. HR role required.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string' },
        contractId: { type: 'string' },
        effectiveDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      required: ['roomId', 'contractId', 'effectiveDate'],
    },
  },
  {
    name: 'hrm.contracts.renew',
    title: 'Renew active contract',
    description: 'Creates a renewal draft linked to an active contract. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { ...commonContractProperties, sourceContractId: { type: 'string' } },
      required: [...contractFieldsRequired, 'sourceContractId'],
    },
  },
  {
    name: 'hrm.contracts.terminate',
    title: 'Terminate active contract',
    description: 'Terminates an active contract with date and reason. HR role required.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string' },
        contractId: { type: 'string' },
        terminationDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        reason: { type: 'string', maxLength: 1000 },
      },
      required: ['roomId', 'contractId', 'terminationDate', 'reason'],
    },
  },
  {
    name: 'hrm.contracts.cancel',
    title: 'Cancel contract draft',
    description: 'Cancels a draft or pending contract. HR role required.',
    inputSchema: {
      type: 'object',
      properties: { roomId: { type: 'string' }, contractId: { type: 'string' } },
      required: ['roomId', 'contractId'],
    },
  },
] as const;

const CONTRACT_TOOL_NAMES = new Set<string>(CONTRACT_TOOL_DEFINITIONS.map(tool => tool.name));

export function isContractTool(name: unknown): name is string {
  return typeof name === 'string' && CONTRACT_TOOL_NAMES.has(name);
}
