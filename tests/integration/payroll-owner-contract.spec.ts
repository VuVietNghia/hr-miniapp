import { describe, it } from 'vitest';

const liveContractEnabled = process.env.PRIVOS_E2E === '1'
  && process.env.PRIVOS_E2E_APPROVED === '1';

describe.skipIf(!liveContractEnabled)('live payroll owner contract', () => {
  it('requires a future approved Owner/Member adapter before issuing a target-Hub call', () => {
    throw new Error('Approved payroll owner contract adapter is not configured');
  });
});
