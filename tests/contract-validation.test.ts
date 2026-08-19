import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAttachSignedDocumentDto,
  parseCreateContractDto,
} from '../src/contracts/validation';

const validContract = {
  roomId: 'room-1',
  employeeId: 'employee-1',
  contractNumber: 'HD-001',
  contractType: 'FIXED_TERM',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  position: 'Developer',
  department: 'IT',
  workLocation: 'Hà Nội',
  baseSalary: 20_000_000,
};

test('validates fixed-term and indefinite date rules', () => {
  assert.throws(
    () => parseCreateContractDto({ ...validContract, endDate: undefined }),
    { errorCode: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () => parseCreateContractDto({ ...validContract, contractType: 'INDEFINITE' }),
    { errorCode: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () => parseCreateContractDto({ ...validContract, startDate: '2026-02-31' }),
    { errorCode: 'VALIDATION_ERROR' },
  );
  assert.equal(
    parseCreateContractDto({ ...validContract, contractType: 'INDEFINITE', endDate: undefined }).endDate,
    undefined,
  );
});

test('validates signed document type and maximum size', () => {
  const document = {
    roomId: 'room-1',
    contractId: 'contract-1',
    fileId: 'file-1',
    fileName: 'contract.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    signedDate: '2026-09-01',
  };
  assert.equal(parseAttachSignedDocumentDto(document).mimeType, 'application/pdf');
  assert.throws(
    () => parseAttachSignedDocumentDto({ ...document, fileName: 'contract.docx' }),
    { errorCode: 'INVALID_DOCUMENT' },
  );
  assert.throws(
    () => parseAttachSignedDocumentDto({ ...document, fileSize: 10 * 1024 * 1024 + 1 }),
    { errorCode: 'INVALID_DOCUMENT' },
  );
});
