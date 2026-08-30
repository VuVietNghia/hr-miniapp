import { describe, expect, it } from 'vitest';

import {
  canAccessPayroll,
  resolveSandboxFeaturePolicy,
  resolveFeatureCapabilities,
  type FeatureCapabilities,
} from '../../src/ui/access/feature-capabilities';

const REQUIRED_SCOPES = ['basic:information', 'lists:read'] as const;
const OPTIONAL_SCOPES = [
  'lists:query',
  'lists:write',
  'files:read',
  'files:write',
  'sandbox:skills:use',
  'sandbox:botkey:push',
  'sandbox:wake',
  'sandbox:generate',
  'sandbox:ai-chat',
  'sandbox:ai-chat:write',
  'db:read',
  'db:write',
  'db:schema:read',
  'db:schema:write',
] as const;
const COMPLETE_GRANT = [...REQUIRED_SCOPES, ...OPTIONAL_SCOPES] as const;

const DENIED: FeatureCapabilities = {
  listsReadable: false,
  listsQueryable: false,
  listsWritable: false,
  filesReadable: false,
  filesWritable: false,
  draftingAvailable: false,
  aiChatReadable: false,
  aiChatWritable: false,
  payrollReadable: false,
  payrollWritable: false,
};

describe('feature capability projection', () => {
  it.each([
    ['undefined', undefined],
    ['non-array', 'lists:read'],
    ['non-string entry', ['basic:information', 42]],
    ['blank entry', ['basic:information', ' ']],
    ['missing basic required scope', ['lists:read']],
    ['missing list read required scope', ['basic:information']],
  ])('fails closed for %s scope state', (_label, scopes) => {
    expect(resolveFeatureCapabilities(scopes as readonly string[] | undefined)).toEqual(DENIED);
  });

  it('keeps the required-only installation in list read-only mode', () => {
    expect(resolveFeatureCapabilities(REQUIRED_SCOPES)).toEqual({
      ...DENIED,
      listsReadable: true,
    });
  });

  it.each([
    ['lists:query', ['listsQueryable']],
    ['lists:write', ['listsWritable']],
    ['files:read', ['filesReadable']],
    ['files:write', ['filesWritable']],
    ['sandbox:skills:use', ['draftingAvailable']],
    ['sandbox:botkey:push', ['draftingAvailable']],
    ['sandbox:wake', ['draftingAvailable']],
    ['sandbox:generate', ['draftingAvailable']],
    ['sandbox:ai-chat', ['aiChatReadable']],
    ['sandbox:ai-chat:write', ['aiChatWritable']],
    ['db:read', ['payrollReadable']],
    ['db:write', ['payrollWritable']],
    ['db:schema:read', ['payrollReadable']],
    ['db:schema:write', ['payrollWritable']],
  ] as const)('revokes only the capabilities that depend on missing %s', (missingScope, revokedKeys) => {
    const grant = COMPLETE_GRANT.filter((scope) => scope !== missingScope);
    const result = resolveFeatureCapabilities(grant);
    const revoked = new Set<keyof FeatureCapabilities>(revokedKeys);

    for (const key of revokedKeys) expect(result[key]).toBe(false);
    for (const key of Object.keys(result) as Array<keyof FeatureCapabilities>) {
      if (!revoked.has(key)) expect(result[key]).toBe(true);
    }
  });

  it('grants every feature for the complete canonical manifest grant', () => {
    expect(resolveFeatureCapabilities(COMPLETE_GRANT)).toEqual({
      listsReadable: true,
      listsQueryable: true,
      listsWritable: true,
      filesReadable: true,
      filesWritable: true,
      draftingAvailable: true,
      aiChatReadable: true,
      aiChatWritable: true,
      payrollReadable: true,
      payrollWritable: true,
    });
  });

  it('requires both DB availability and a latest verified owner result for payroll navigation', () => {
    const granted = resolveFeatureCapabilities(COMPLETE_GRANT);
    const noDatabase = resolveFeatureCapabilities(COMPLETE_GRANT.filter((scope) => scope !== 'db:read'));

    expect(canAccessPayroll(granted, false)).toBe(false);
    expect(canAccessPayroll(noDatabase, true)).toBe(false);
    expect(canAccessPayroll(granted, true)).toBe(true);
  });

  it.each([
    ['sandbox:skills:use', 'skillBackedControlsVisible', 'Skill-backed drafting and screening controls are hidden.'],
    ['sandbox:botkey:push', 'botKeyActionsAvailable', 'Sandbox bot-key connection actions are unavailable.'],
    ['sandbox:wake', 'wakeActionsAvailable', 'Sandbox wake actions are unavailable.'],
    ['sandbox:generate', 'generationActionsAvailable', 'AI generation and polling actions are disabled.'],
    ['sandbox:ai-chat', 'aiChatHistoryAvailable', 'Existing AI chat/session history is unavailable.'],
    ['sandbox:ai-chat:write', 'aiChatWriteAvailable', 'New AI chat/generation actions are disabled.'],
  ] as const)('projects the canonical UI policy independently when %s is revoked', (missingScope, field, reason) => {
    const policy = resolveSandboxFeaturePolicy(COMPLETE_GRANT.filter(scope => scope !== missingScope));

    expect(policy[field]).toBe(false);
    expect(policy.degradedReasons).toEqual([reason]);
    for (const key of [
      'skillBackedControlsVisible',
      'botKeyActionsAvailable',
      'wakeActionsAvailable',
      'generationActionsAvailable',
      'aiChatHistoryAvailable',
      'aiChatWriteAvailable',
    ] as const) {
      if (key !== field) expect(policy[key]).toBe(true);
    }
  });
});
