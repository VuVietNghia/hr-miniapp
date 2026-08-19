import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractTemplateService } from '../src/ui/lifecycle/contracts/services/ContractTemplateService';
import type { EmployeeContract } from '../src/contracts/types';

const profile = {
  _id: 'employee-1',
  name: 'Nguyễn Minh An',
  status: 'Chính thức',
  email: 'an@example.com',
  phone: '0900000000',
  position: 'Developer',
  department: 'IT',
};

function contract(type: EmployeeContract['contractType']): EmployeeContract {
  return {
    _id: `contract-${type}`,
    roomId: 'room-1',
    employeeId: 'employee-1',
    contractNumber: 'HD-001',
    contractType: type,
    status: 'DRAFT',
    startDate: '2026-09-01',
    ...(type === 'FIXED_TERM' ? { endDate: '2027-08-31' } : {}),
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

test('renders deterministic fixed-term and indefinite templates without inventing missing legal data', () => {
  const service = new ContractTemplateService();
  const fixed = service.render(profile, contract('FIXED_TERM'));
  const indefinite = service.render(profile, contract('INDEFINITE'));

  assert.match(fixed, /XÁC ĐỊNH THỜI HẠN/u);
  assert.match(fixed, /2027-08-31/u);
  assert.match(indefinite, /KHÔNG XÁC ĐỊNH THỜI HẠN/u);
  assert.match(indefinite, /không xác định thời hạn/u);
  assert.match(fixed, /\[BỔ SUNG: TÊN PHÁP LÝ CÔNG TY\]/u);
  assert.match(fixed, /20\.000\.000 VND\/tháng/u);
});
