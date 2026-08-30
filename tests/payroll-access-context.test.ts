import { describe, expect, it } from 'vitest';

import { isPayrollOwnerFromContextResult } from '../src/ui/payroll/access/payroll-access-context';
import { refreshPayrollAccess } from '../src/ui/payroll/access/usePayrollAccessPolling';

describe('payroll access context', () => {
  it('allows Payroll only when the context result contains the exact owner role', () => {
    expect(isPayrollOwnerFromContextResult({
      content: [{ text: '{"userRoles":["member","owner"]}' }],
    })).toBe(true);
  });

  it('denies Payroll when the context result does not contain owner', () => {
    expect(isPayrollOwnerFromContextResult({
      content: [{ text: '{"userRoles":["member"]}' }],
    })).toBe(false);
  });

  it('denies Payroll when the context result is malformed', () => {
    expect(isPayrollOwnerFromContextResult({
      content: [{ text: 'not-json' }],
    })).toBe(false);
  });

  it('denies Payroll when the role refresh request fails', async () => {
    const isOwner = await refreshPayrollAccess({
      callServerTool: async () => {
        throw new Error('context request failed');
      },
    });

    expect(isOwner).toBe(false);
  });

  it('uses the mediated current-Room context tool for the owner refresh', async () => {
    let request: unknown;
    await refreshPayrollAccess({
      callServerTool: async (input) => {
        request = input;
        return { content: [{ text: '{"userRoles":["owner"]}' }] };
      },
    });

    expect(request).toEqual({ name: 'mcpapp.context.get', arguments: {} });
  });
});
