import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BuiltinEmployeeEmailTemplateProvider,
  type EmployeeEmailTemplate,
  type IEmployeeEmailTemplateProvider
} from '../src/ui/lifecycle/email/EmployeeEmailTemplateProvider';
import { isValidEmailAddress } from '../src/utils/email-validation';

const profile = {
  _id: 'employee-1',
  name: 'Nguyễn Minh An',
  status: 'Đang thử việc',
  email: 'an.nguyen@example.com',
  position: 'Chuyên viên nhân sự',
  department: 'Nhân sự',
  startDate: '2026-08-01'
};

test('provider only exposes employee-operation templates', () => {
  const provider = new BuiltinEmployeeEmailTemplateProvider();
  const ids = provider.getTemplates().map(template => template.id);

  assert.deepEqual(ids, [
    'PROFILE_COMPLETION_REQUEST',
    'CONTRACT_SIGNATURE_OR_RENEWAL',
    'PROBATION_EVALUATION_NOTICE',
    'EMPLOYEE_INFORMATION_UPDATE'
  ]);
  assert.equal(ids.includes('OFFER_LETTER'), false);
  assert.equal(ids.includes('REJECTION_LETTER'), false);
});

test('provider renders employee data and editable placeholders', () => {
  const provider = new BuiltinEmployeeEmailTemplateProvider();
  const draft = provider.getTemplateById('PROFILE_COMPLETION_REQUEST')?.createDraft(profile);

  assert.match(draft?.subject ?? '', /Nguyễn Minh An/u);
  assert.match(draft?.content ?? '', /Chuyên viên nhân sự/u);
  assert.match(draft?.content ?? '', /Nhân sự/u);
  assert.match(draft?.content ?? '', /\[BỔ SUNG: danh mục hồ sơ cần hoàn thiện\]/u);
});

test('contract email renders type and period from contract context', () => {
  const provider = new BuiltinEmployeeEmailTemplateProvider();
  const draft = provider.getTemplateById('CONTRACT_SIGNATURE_OR_RENEWAL')?.createDraft(profile, {
    contractNumber: 'HD-2026-001',
    contractType: 'Hợp đồng xác định thời hạn',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    signedDate: '2026-08-28',
  });

  assert.match(draft?.content ?? '', /HD-2026-001/u);
  assert.match(draft?.content ?? '', /Hợp đồng xác định thời hạn/u);
  assert.match(draft?.content ?? '', /2026-09-01 - 2027-08-31/u);
});

test('provider interface accepts a replacement template source', () => {
  const customTemplate: EmployeeEmailTemplate = {
    id: 'CUSTOM_NOTICE',
    name: 'Thông báo tùy chỉnh',
    createDraft: employee => ({ subject: employee.name, content: 'Nội dung tùy chỉnh' })
  };
  const provider: IEmployeeEmailTemplateProvider = new BuiltinEmployeeEmailTemplateProvider([customTemplate]);

  assert.equal(provider.getTemplates()[0]?.id, 'CUSTOM_NOTICE');
  assert.equal(provider.getTemplateById('CUSTOM_NOTICE')?.createDraft(profile).content, 'Nội dung tùy chỉnh');
});

test('email validation rejects missing and malformed recipients', () => {
  assert.equal(isValidEmailAddress('nhan.su@example.com'), true);
  assert.equal(isValidEmailAddress(''), false);
  assert.equal(isValidEmailAddress('nhan.su@'), false);
  assert.equal(isValidEmailAddress(undefined), false);
});
