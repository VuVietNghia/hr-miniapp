export interface FeatureCapabilities {
  listsReadable: boolean;
  listsQueryable: boolean;
  listsWritable: boolean;
  filesReadable: boolean;
  filesWritable: boolean;
  draftingAvailable: boolean;
  aiChatReadable: boolean;
  aiChatWritable: boolean;
  payrollReadable: boolean;
  payrollWritable: boolean;
}

export const FEATURE_DEGRADED_BEHAVIOR = {
  listsQueryable: 'List screens use the bounded non-query route and display that results may be capped.',
  listsWritable: 'Recruitment, CV, lifecycle, and email-history writes are disabled; reads remain available.',
  filesReadable: 'Existing document previews and Room file discovery are unavailable.',
  filesWritable: 'Upload, generated-document persistence, and payroll export upload are disabled.',
  draftingAvailable: 'AI generation and polling actions are disabled.',
  aiChatReadable: 'Existing AI chat/session history is unavailable.',
  aiChatWritable: 'New AI chat/generation actions are disabled.',
  payrollReadable: 'Payroll is unavailable.',
  payrollWritable: 'Payroll create/update/delete is unavailable.',
} as const;

export interface SandboxFeaturePolicy {
  readonly skillBackedControlsVisible: boolean;
  readonly botKeyActionsAvailable: boolean;
  readonly wakeActionsAvailable: boolean;
  readonly generationActionsAvailable: boolean;
  readonly aiChatHistoryAvailable: boolean;
  readonly aiChatWriteAvailable: boolean;
  readonly degradedReasons: readonly string[];
}

export const SANDBOX_DEGRADED_BEHAVIOR = {
  skillBackedControlsVisible: 'Skill-backed drafting and screening controls are hidden.',
  botKeyActionsAvailable: 'Sandbox bot-key connection actions are unavailable.',
  wakeActionsAvailable: 'Sandbox wake actions are unavailable.',
  generationActionsAvailable: 'AI generation and polling actions are disabled.',
  aiChatHistoryAvailable: 'Existing AI chat/session history is unavailable.',
  aiChatWriteAvailable: 'New AI chat/generation actions are disabled.',
} as const;

const REQUIRED_SCOPES = ['basic:information', 'lists:read'] as const;
const DRAFTING_SCOPES = [
  'sandbox:skills:use',
  'sandbox:botkey:push',
  'sandbox:wake',
  'sandbox:generate',
] as const;

const LEAST_PRIVILEGED_CAPABILITIES: FeatureCapabilities = {
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

function isValidScopeList(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.every((scope) => typeof scope === 'string' && scope.trim().length > 0);
}

export function resolveFeatureCapabilities(
  effectiveScopes: readonly string[] | undefined,
): FeatureCapabilities {
  if (!isValidScopeList(effectiveScopes)) return { ...LEAST_PRIVILEGED_CAPABILITIES };

  const scopes = new Set(effectiveScopes);
  if (!REQUIRED_SCOPES.every((scope) => scopes.has(scope))) {
    return { ...LEAST_PRIVILEGED_CAPABILITIES };
  }

  const aiChatReadable = scopes.has('sandbox:ai-chat');
  const aiChatWritable = scopes.has('sandbox:ai-chat:write');
  const payrollReadable = scopes.has('db:read') && scopes.has('db:schema:read');

  return {
    listsReadable: true,
    listsQueryable: scopes.has('lists:query'),
    listsWritable: scopes.has('lists:write'),
    filesReadable: scopes.has('files:read'),
    filesWritable: scopes.has('files:write'),
    draftingAvailable: DRAFTING_SCOPES.every((scope) => scopes.has(scope)),
    aiChatReadable,
    aiChatWritable,
    payrollReadable,
    payrollWritable: scopes.has('db:write')
      && scopes.has('db:schema:write'),
  };
}

export function resolveSandboxFeaturePolicy(
  effectiveScopes: readonly string[] | undefined,
): SandboxFeaturePolicy {
  const valid = isValidScopeList(effectiveScopes)
    && REQUIRED_SCOPES.every(scope => effectiveScopes.includes(scope));
  const scopes = new Set(valid ? effectiveScopes : []);
  const policy = {
    skillBackedControlsVisible: scopes.has('sandbox:skills:use'),
    botKeyActionsAvailable: scopes.has('sandbox:botkey:push'),
    wakeActionsAvailable: scopes.has('sandbox:wake'),
    generationActionsAvailable: scopes.has('sandbox:generate'),
    aiChatHistoryAvailable: scopes.has('sandbox:ai-chat'),
    aiChatWriteAvailable: scopes.has('sandbox:ai-chat:write'),
  };
  return {
    ...policy,
    degradedReasons: (Object.keys(policy) as Array<keyof typeof policy>)
      .filter(key => !policy[key])
      .map(key => SANDBOX_DEGRADED_BEHAVIOR[key]),
  };
}

export function canAccessPayroll(
  capabilities: FeatureCapabilities,
  hasLatestVerifiedOwnerContext: boolean,
): boolean {
  return capabilities.payrollReadable && hasLatestVerifiedOwnerContext;
}
