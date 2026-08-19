import assert from 'node:assert/strict';
import test from 'node:test';
import { PrivOSContractRepository } from '../src/contracts/repositories/PrivOSContractRepository';
import type { EmployeeContract } from '../src/contracts/types';

function contract(id: string, roomId = 'room-1'): EmployeeContract {
  return {
    _id: id,
    roomId,
    employeeId: 'employee-1',
    contractNumber: `HD-${id}`,
    contractType: 'FIXED_TERM',
    status: 'DRAFT',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    position: 'Developer',
    department: 'IT',
    workLocation: 'Hà Nội',
    baseSalary: 20_000_000,
    currency: 'VND',
    revision: 1,
    createdBy: 'owner-1',
    updatedBy: 'owner-1',
  };
}

test('registers schemas once and paginates repository queries with room filters', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const caller = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    calls.push({ name, args });
    if (name === 'privos.db.getSchema') throw new Error('collection not found');
    if (name === 'privos.db.registerCollection') return { data: { ok: true } };
    if (name === 'privos.db.query') {
      const offset = Number(args.offset ?? 0);
      const records = offset === 0
        ? Array.from({ length: 1000 }, (_, index) => contract(String(index + 1)))
        : [contract('1001')];
      return { records, total: 1001 };
    }
    throw new Error(`Unexpected tool ${name}`);
  };
  const repository = new PrivOSContractRepository(caller);

  const records = await repository.listByEmployee('room-1', 'employee-1');
  await repository.initializeSchemas();

  assert.equal(records.length, 1001);
  assert.equal(calls.filter(call => call.name === 'privos.db.registerCollection').length, 3);
  const queries = calls.filter(call => call.name === 'privos.db.query');
  assert.deepEqual(queries.map(call => call.args.offset), [0, 1000]);
  for (const query of queries) {
    assert.deepEqual((query.args.where as Array<Record<string, unknown>>)[0], {
      field: 'roomId', op: '==', value: 'room-1',
    });
  }
});

test('does not return a record from another room', async () => {
  const repository = new PrivOSContractRepository(async (name): Promise<unknown> => {
    if (name === 'privos.db.getSchema') return { data: { name: 'existing' } };
    if (name === 'privos.db.get') return { record: contract('1', 'room-2') };
    throw new Error(`Unexpected tool ${name}`);
  });

  assert.equal(await repository.getById('room-1', '1'), null);
});
