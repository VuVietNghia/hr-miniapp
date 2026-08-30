import { describe, expect, it } from 'vitest';

import { AgentBotRoomPlatformGateway } from '../../src/platform/hub/AgentBotRoomPlatformGateway';
import type { RoomPlatformGateway } from '../../src/platform/hub/RoomPlatformGateway';
import {
  PAYROLL_QUERY_PROJECTION,
  PAYROLL_SCHEMA_FIELDS,
  PayrollRepository,
  type PayrollCreateResponseCapability,
  type PayrollMutationCapability,
  type PayrollQueryCapability,
  type PayrollQueryPageRequest,
  type PayrollSchemaCapability,
  type PayrollSchemaState,
} from '../../src/payroll/PayrollRepository';
import {
  parsePayrollRecordInput,
  parseStoredPayrollRecord,
  type PayrollRecordInput,
} from '../../src/payroll/payroll-types';

const validRecord: PayrollRecordInput = {
  employeeId: 'employee-1',
  baseSalary: 999_999_999_999,
  taxId: '0123456789',
  bankAccount: '123456-789',
  bankName: 'Vietcombank',
  contractType: 'Chính thức',
  applyProbationRate: true,
  probationRate: 85,
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toolResponse(value: unknown): Response {
  return new Response(JSON.stringify({
    success: true,
    content: [{ text: JSON.stringify(value) }],
  }), { status: 200 });
}

class FakeHubClient {
  readonly requests: Array<Readonly<Record<string, unknown>>> = [];

  constructor(private readonly responses: Response[]) {}

  async authorizedFetch(_input: string, init: { body: string }): Promise<Response> {
    this.requests.push(JSON.parse(init.body));
    const response = this.responses.shift();
    if (!response) throw new Error('Unexpected platform call');
    return response;
  }
}

function gatewayFixture(responses: Response[]): {
  gateway: RoomPlatformGateway;
  hubClient: FakeHubClient;
} {
  const hubClient = new FakeHubClient(responses);
  return {
    gateway: new AgentBotRoomPlatformGateway(hubClient, async () => 'app-1'),
    hubClient,
  };
}

class TestSchemaCapability implements PayrollSchemaCapability {
  readonly roomEmployeeIndex = {
    fields: ['roomId', 'employeeId'] as const,
    descriptor: { fixture: 'verified-room-employee-index' },
  };

  constructor(private readonly state: PayrollSchemaState) {}

  classifySchema(_schema: unknown): PayrollSchemaState {
    return this.state;
  }
}

class TestQueryCapability implements PayrollQueryCapability {
  readonly requests: PayrollQueryPageRequest[] = [];

  constructor(private readonly pages: unknown[]) {}

  async queryPage(
    _gateway: RoomPlatformGateway,
    request: PayrollQueryPageRequest,
  ): Promise<unknown> {
    this.requests.push(request);
    const page = this.pages.shift();
    if (page === undefined) throw new Error('Unexpected query page');
    return page;
  }

  cursorFingerprint(cursor: unknown): string | undefined {
    return typeof cursor === 'string' && cursor.trim() ? cursor : undefined;
  }
}

const createResponseCapability: PayrollCreateResponseCapability = {
  readCreatedRecord(response) {
    if (!isRecord(response)) throw new Error('Invalid create response');
    return response.record;
  },
};

describe('payroll DTO contract', () => {
  it('projects exact keys and normalizes accepted strings without adding UI defaults', () => {
    const parsed = parsePayrollRecordInput({
      employeeId: '  employee-1  ',
      baseSalary: 0,
      taxId: ' 01234 56789 ',
      bankAccount: ' 123 456-789 ',
      bankName: '  ',
      contractType: '  Thử việc (85%)  ',
      applyProbationRate: false,
      probationRate: 0,
    });

    expect(parsed).toEqual({
      employeeId: 'employee-1',
      baseSalary: 0,
      taxId: '0123456789',
      bankAccount: '123456-789',
      bankName: '',
      contractType: 'Thử việc (85%)',
      applyProbationRate: false,
      probationRate: 0,
    });
    expect(parsed).not.toHaveProperty('roomId');
  });

  it.each([
    [{ ...validRecord, extra: true }, 'unknown key'],
    [{ ...validRecord, employeeId: '  ' }, 'empty employee id'],
    [{ ...validRecord, baseSalary: -1 }, 'negative salary'],
    [{ ...validRecord, baseSalary: 1_000_000_000_000 }, 'thirteen-digit salary'],
    [{ ...validRecord, baseSalary: 1.5 }, 'fractional salary'],
    [{ ...validRecord, taxId: '123' }, 'malformed tax id'],
    [{ ...validRecord, bankAccount: '12ab3456' }, 'malformed bank account'],
    [{ ...validRecord, applyProbationRate: 1 }, 'non-boolean probation toggle'],
    [{ ...validRecord, probationRate: Number.NaN }, 'non-finite probation rate'],
    [{ ...validRecord, probationRate: 101 }, 'probation rate above 100'],
  ])('rejects %s (%s)', (input, _reason) => {
    expect(() => parsePayrollRecordInput(input)).toThrow('Invalid payroll record');
  });

  it('normalizes only legacy tax/bank omissions and leaves later optional fields absent', () => {
    const record = parseStoredPayrollRecord({
      _id: 'record-1',
      roomId: 'room-1',
      employeeId: ' employee-1 ',
      baseSalary: 10_000_000,
    }, 'room-1');

    expect(record).toEqual({
      _id: 'record-1',
      roomId: 'room-1',
      employeeId: 'employee-1',
      baseSalary: 10_000_000,
      taxId: '',
      bankAccount: '',
    });
    expect(record).not.toHaveProperty('bankName');
    expect(record).not.toHaveProperty('contractType');
    expect(record).not.toHaveProperty('applyProbationRate');
    expect(record).not.toHaveProperty('probationRate');
  });

  it.each([
    ['123456789012', '123456'],
    ['1234567890-123', '123-456-789'],
    ['', ''],
  ])('preserves every accepted tax/bank normalization case', (taxId, bankAccount) => {
    expect(parsePayrollRecordInput({ ...validRecord, taxId, bankAccount })).toMatchObject({
      taxId,
      bankAccount,
    });
  });
});

describe('PayrollRepository gates and fixed access', () => {
  it('fails closed by default before any schema, query, create, update, or delete call', async () => {
    const { gateway, hubClient } = gatewayFixture([]);
    const repository = new PayrollRepository(gateway);

    await expect(repository.query('room-1')).rejects.toThrow('Payroll query is not verified');
    await expect(repository.create('room-1', validRecord)).rejects.toThrow(
      'Payroll create is not verified',
    );
    await expect(repository.update('room-1', 'record-1', validRecord)).rejects.toThrow(
      'Payroll update is not verified',
    );
    await expect(repository.delete('room-1', 'record-1')).rejects.toThrow(
      'Payroll delete is not verified',
    );
    expect(hubClient.requests).toEqual([]);
  });

  it('uses the fixed Room query, projection, ordering, limit, and every verified page', async () => {
    const { gateway, hubClient } = gatewayFixture([toolResponse({ schema: 'compatible' })]);
    const query = new TestQueryCapability([
      {
        records: [{
          _id: 'record-1', roomId: 'room-1', employeeId: 'employee-1', baseSalary: 1,
        }],
        nextCursor: 'cursor-2',
      },
      {
        records: [{
          _id: 'record-2', roomId: 'room-1', employeeId: 'employee-2', baseSalary: 2,
          taxId: '', bankAccount: '', bankName: 'Bank Two',
        }],
      },
    ]);
    const repository = new PayrollRepository(gateway, {
      schema: new TestSchemaCapability({ status: 'compatible' }),
      query,
    });

    await expect(repository.query('room-1')).resolves.toHaveLength(2);
    expect(query.requests).toEqual([
      {
        roomId: 'room-1',
        query: {
          collection: 'payroll_records',
          where: [{ field: 'roomId', op: '==', value: 'room-1' }],
          orderBy: [{ field: 'employeeId', direction: 'asc' }],
          limit: 200,
        },
        projection: PAYROLL_QUERY_PROJECTION,
      },
      {
        roomId: 'room-1',
        query: {
          collection: 'payroll_records',
          where: [{ field: 'roomId', op: '==', value: 'room-1' }],
          orderBy: [{ field: 'employeeId', direction: 'asc' }],
          limit: 200,
        },
        projection: PAYROLL_QUERY_PROJECTION,
        cursor: 'cursor-2',
      },
    ]);
    expect(hubClient.requests).toEqual([{
      mcpAppId: 'app-1',
      toolName: 'mcpapp.db.getSchema',
      roomId: 'room-1',
      arguments: { collection: 'payroll_records' },
    }]);
  });

  it('rejects repeated and malformed cursors instead of returning partial data', async () => {
    const repeatedGateway = gatewayFixture([toolResponse({ schema: 'compatible' })]).gateway;
    const repeatedQuery = new TestQueryCapability([
      { records: [], nextCursor: 'cursor-1' },
      { records: [], nextCursor: 'cursor-1' },
    ]);
    const repeated = new PayrollRepository(repeatedGateway, {
      schema: new TestSchemaCapability({ status: 'compatible' }),
      query: repeatedQuery,
    });
    await expect(repeated.query('room-1')).rejects.toThrow('repeated cursor');

    const malformedGateway = gatewayFixture([toolResponse({ schema: 'compatible' })]).gateway;
    const malformed = new PayrollRepository(malformedGateway, {
      schema: new TestSchemaCapability({ status: 'compatible' }),
      query: new TestQueryCapability([{ records: [], nextCursor: { guessed: true } }]),
    });
    await expect(malformed.query('room-1')).rejects.toThrow('malformed cursor');
  });

  it('rejects malformed pages rather than treating them as an empty complete result', async () => {
    const { gateway } = gatewayFixture([toolResponse({ schema: 'compatible' })]);
    const repository = new PayrollRepository(gateway, {
      schema: new TestSchemaCapability({ status: 'compatible' }),
      query: new TestQueryCapability([{ records: 'not-an-array' }]),
    });

    await expect(repository.query('room-1')).rejects.toThrow('malformed page');
  });

  it('registers a missing collection with only the fixed fields and injected index descriptor', async () => {
    const { gateway, hubClient } = gatewayFixture([
      toolResponse({ schema: 'missing' }),
      toolResponse({ registered: true }),
      toolResponse({ record: { ...validRecord, _id: 'record-1', roomId: 'room-1' } }),
    ]);
    const repository = new PayrollRepository(gateway, {
      schema: new TestSchemaCapability({ status: 'missing' }),
      createResponse: createResponseCapability,
    });

    await expect(repository.create('room-1', validRecord)).resolves.toMatchObject({
      _id: 'record-1',
      roomId: 'room-1',
    });
    expect(hubClient.requests).toEqual([
      {
        mcpAppId: 'app-1',
        toolName: 'mcpapp.db.getSchema',
        roomId: 'room-1',
        arguments: { collection: 'payroll_records' },
      },
      {
        mcpAppId: 'app-1',
        toolName: 'mcpapp.db.registerCollection',
        roomId: 'room-1',
        arguments: {
          collection: 'payroll_records',
          scope: 'room',
          fields: PAYROLL_SCHEMA_FIELDS,
          indexes: [{ fixture: 'verified-room-employee-index' }],
        },
      },
      {
        mcpAppId: 'app-1',
        toolName: 'mcpapp.db.create',
        roomId: 'room-1',
        arguments: {
          collection: 'payroll_records',
          data: { ...validRecord, roomId: 'room-1' },
        },
      },
    ]);
  });

  it.each<PayrollSchemaState>([
    { status: 'incompatible' },
    { status: 'requires-evolution' },
  ])('leaves existing schema untouched for $status without proven evolution', async (state) => {
    const { gateway, hubClient } = gatewayFixture([toolResponse({ schema: state.status })]);
    const repository = new PayrollRepository(gateway, {
      schema: new TestSchemaCapability(state),
      query: new TestQueryCapability([]),
    });

    await expect(repository.query('room-1')).rejects.toThrow('Payroll schema is not compatible');
    expect(hubClient.requests).toHaveLength(1);
  });

  it('uses only an injected evolution seam and rechecks compatibility before querying', async () => {
    const states: PayrollSchemaState[] = [
      { status: 'requires-evolution' },
      { status: 'compatible' },
    ];
    const evolutionCalls: unknown[] = [];
    const schema: PayrollSchemaCapability = {
      roomEmployeeIndex: {
        fields: ['roomId', 'employeeId'],
        descriptor: { fixture: 'verified-room-employee-index' },
      },
      classifySchema() {
        const state = states.shift();
        if (!state) throw new Error('Unexpected schema classification');
        return state;
      },
      async evolveSchema(_gateway, request) {
        evolutionCalls.push(request);
      },
    };
    const { gateway, hubClient } = gatewayFixture([
      toolResponse({ schema: 'old' }),
      toolResponse({ schema: 'evolved' }),
    ]);
    const repository = new PayrollRepository(gateway, {
      schema,
      query: new TestQueryCapability([{ records: [] }]),
    });

    await expect(repository.query('room-1')).resolves.toEqual([]);
    expect(evolutionCalls).toEqual([{
      roomId: 'room-1',
      collection: 'payroll_records',
      fields: PAYROLL_SCHEMA_FIELDS,
      index: schema.roomEmployeeIndex,
    }]);
    expect(hubClient.requests).toHaveLength(2);
  });

  it('rejects index evidence without a live-confirmed descriptor before schema access', async () => {
    const { gateway, hubClient } = gatewayFixture([]);
    const repository = new PayrollRepository(gateway, {
      schema: {
        roomEmployeeIndex: {
          fields: ['roomId', 'employeeId'],
          descriptor: undefined,
        },
        classifySchema: () => ({ status: 'compatible' }),
      },
      query: new TestQueryCapability([{ records: [] }]),
    });

    await expect(repository.query('room-1')).rejects.toThrow(
      'Payroll Room/employee index is not verified',
    );
    expect(hubClient.requests).toEqual([]);
  });

  it('uses injected future mutation contracts with validated ids and verified Room only', async () => {
    const mutationCalls: unknown[] = [];
    const mutation: PayrollMutationCapability = {
      async update(_gateway, request) {
        mutationCalls.push({ operation: 'update', request });
        return { ...request.record, _id: request.id, roomId: request.roomId };
      },
      async delete(_gateway, request) {
        mutationCalls.push({ operation: 'delete', request });
      },
    };
    const { gateway } = gatewayFixture([
      toolResponse({ schema: 'compatible' }),
      toolResponse({ schema: 'compatible' }),
    ]);
    const repository = new PayrollRepository(gateway, {
      schema: new TestSchemaCapability({ status: 'compatible' }),
      mutation,
    });

    await expect(repository.update('room-1', ' record-1 ', validRecord)).resolves.toMatchObject({
      _id: 'record-1', roomId: 'room-1',
    });
    await expect(repository.delete('room-1', ' record-1 ')).resolves.toBeUndefined();
    expect(mutationCalls).toEqual([
      {
        operation: 'update',
        request: { roomId: 'room-1', id: 'record-1', record: validRecord },
      },
      {
        operation: 'delete',
        request: { roomId: 'room-1', id: 'record-1' },
      },
    ]);
    await expect(repository.delete('room-1', ' ')).rejects.toThrow('Invalid payroll record id');
  });
});
