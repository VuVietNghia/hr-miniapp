import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../privos-app.json';

type PermissionContext = 'workspace' | 'room';
type ExecutionContext = 'user' | 'background' | 'both';

type CatalogEntry = Readonly<{
  contexts: readonly PermissionContext[];
  executionContexts: readonly ExecutionContext[];
}>;

const REFERENCE_CATALOG: Readonly<Record<string, CatalogEntry>> = {
  'basic:information': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'lists:read': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'lists:query': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'lists:write': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'files:read': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'files:write': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'sandbox:skills:use': { contexts: ['room'], executionContexts: ['user'] },
  'sandbox:botkey:push': { contexts: ['room'], executionContexts: ['user'] },
  'sandbox:wake': { contexts: ['room'], executionContexts: ['user'] },
  'sandbox:generate': { contexts: ['room'], executionContexts: ['user'] },
  'sandbox:ai-chat': { contexts: ['room'], executionContexts: ['user'] },
  'sandbox:ai-chat:write': { contexts: ['room'], executionContexts: ['user'] },
  'db:read': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'db:write': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'db:schema:read': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
  'db:schema:write': { contexts: ['workspace', 'room'], executionContexts: ['user', 'background', 'both'] },
};

const expectedPermissions = [
  { scope: 'basic:information', requirement: 'required', context: 'room', executionContext: 'both', feature: 'core.context', degradedBehavior: undefined },
  { scope: 'lists:read', requirement: 'required', context: 'room', executionContext: 'user', feature: 'hr.lists.read', degradedBehavior: undefined },
  { scope: 'lists:query', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.lists.query', degradedBehavior: 'List screens use the bounded non-query route and display that results may be capped.' },
  { scope: 'lists:write', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.lists.manage', degradedBehavior: 'Recruitment, CV, lifecycle, and email-history writes are disabled; reads remain available.' },
  { scope: 'files:read', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.files.read', degradedBehavior: 'Existing document previews and Room file discovery are unavailable.' },
  { scope: 'files:write', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.files.manage', degradedBehavior: 'Upload, generated-document persistence, and payroll export upload are disabled.' },
  { scope: 'sandbox:skills:use', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.sandbox.skills', degradedBehavior: 'Skill-backed drafting and screening controls are hidden.' },
  { scope: 'sandbox:botkey:push', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.sandbox.connect', degradedBehavior: 'Sandbox bot-key connection actions are unavailable.' },
  { scope: 'sandbox:wake', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.sandbox.wake', degradedBehavior: 'Sandbox wake actions are unavailable.' },
  { scope: 'sandbox:generate', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.sandbox.generate', degradedBehavior: 'AI generation and polling actions are disabled.' },
  { scope: 'sandbox:ai-chat', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.chat.read', degradedBehavior: 'Existing AI chat/session history is unavailable.' },
  { scope: 'sandbox:ai-chat:write', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.chat.write', degradedBehavior: 'New AI chat/generation actions are disabled.' },
  { scope: 'db:read', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.payroll.read', degradedBehavior: 'Payroll is unavailable.' },
  { scope: 'db:write', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.payroll.manage', degradedBehavior: 'Payroll create/update/delete is unavailable.' },
  { scope: 'db:schema:read', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.payroll.schema.read', degradedBehavior: 'Payroll schema verification is unavailable.' },
  { scope: 'db:schema:write', requirement: 'optional', context: 'room', executionContext: 'user', feature: 'hr.payroll.schema.manage', degradedBehavior: 'Payroll collection registration is unavailable.' },
];

const expectedCallSites: Readonly<Record<string, readonly string[]>> = {
  'basic:information': [
    'src/ui/App.tsx', 'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/contact-collector-form.tsx', 'src/ui/cv-scored/CVScoredTab.tsx',
    'src/ui/email-history/EmailTab.tsx', 'src/ui/jd-chatbot-functional.tsx',
    'src/ui/lifecycle/components/CreateDetailedProfileForm.tsx',
    'src/ui/lifecycle/components/EmailComposerModal.tsx',
    'src/ui/lifecycle/components/ProfileCard.tsx',
    'src/ui/lifecycle/components/ProfileListView.tsx',
    'src/ui/lifecycle/LifecycleDashboard.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/recruitment-panel.tsx', 'src/ui/theme-provider.tsx',
    'src/ui/training-dashboard.tsx', 'src/ui/payroll/access/usePayrollAccessPolling.ts',
  ],
  'lists:read': [
    'src/services/EmailHistoryRepository.ts', 'src/ui/contact-collector-form.tsx',
    'src/ui/cv-scored/CVScoredTab.tsx', 'src/ui/email-history/email-history-service.ts',
    'src/ui/lifecycle/services/lifecycleService.ts',
    'src/ui/lifecycle/services/PrivOSLifecycleService.ts', 'src/ui/list-items-table.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'lists:query': [
    'src/ui/cv-scored/CVScoredTab.tsx',
    'src/ui/lifecycle/services/PrivOSLifecycleService.ts', 'src/ui/pipeline-service.ts',
  ],
  'lists:write': [
    'src/services/EmailHistoryRepository.ts', 'src/ui/contact-collector-form.tsx',
    'src/ui/cv-scored/CVScoredTab.tsx', 'src/ui/email-history/email-history-service.ts',
    'src/ui/lifecycle/services/lifecycleService.ts',
    'src/ui/lifecycle/services/PrivOSLifecycleService.ts', 'src/ui/list-items-table.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'files:read': [
    'src/ui/drafting/services/CompanyContextProvider.ts',
    'src/ui/email-templates/interview-email-template-repository.ts',
    'src/ui/pipeline-dashboard.tsx', 'src/ui/pipeline-service.ts', 'src/ui/privos-rest.ts',
    'src/ui/recruitment-panel.tsx', 'src/ui/training-dashboard.tsx',
  ],
  'files:write': [
    'src/services/PrivosApi.ts', 'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/contact-collector-form.tsx',
    'src/ui/email-templates/interview-email-template-repository.ts',
    'src/ui/jd-chatbot-functional.tsx',
    'src/ui/lifecycle/components/CreateDetailedProfileForm.tsx',
    'src/ui/onboarding/PrivosApi.ts', 'src/ui/onboarding/services/OnboardingService.ts',
    'src/ui/payroll/services/PayrollExportService.ts', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts', 'src/ui/privos-rest.ts', 'src/ui/recruitment-panel.tsx',
    'src/ui/training-dashboard.tsx',
  ],
  'sandbox:skills:use': ['src/ui/pipeline-dashboard.tsx', 'src/ui/pipeline-service.ts'],
  'sandbox:botkey:push': [
    'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/jd-chatbot-functional.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'sandbox:wake': [
    'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/jd-chatbot-functional.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'sandbox:generate': [
    'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/jd-chatbot-functional.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'sandbox:ai-chat': [
    'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/jd-chatbot-functional.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'sandbox:ai-chat:write': [
    'src/ui/bot-drafting-tab.tsx', 'src/ui/company-home.tsx',
    'src/ui/jd-chatbot-functional.tsx', 'src/ui/pipeline-dashboard.tsx',
    'src/ui/pipeline-service.ts',
  ],
  'db:read': [
    'src/mcp-message-handlers.ts', 'src/ui/payroll/components/PayrollDashboard.tsx',
    'src/ui/payroll/services/PayrollService.ts',
  ],
  'db:write': ['src/mcp-message-handlers.ts', 'src/ui/payroll/services/PayrollService.ts'],
  'db:schema:read': ['src/payroll/PayrollRepository.ts'],
  'db:schema:write': ['src/ui/payroll/services/PayrollService.ts', 'src/payroll/PayrollRepository.ts'],
};

describe('Marketplace permission contract', () => {
  it('declares exactly the requested 16-row permission matrix', () => {
    expect(manifest.permissions).toHaveLength(16);
    expect(manifest.permissions.map((permission) => ({
      scope: permission.scope,
      requirement: permission.requirement,
      context: permission.context,
      executionContext: permission.executionContext,
      feature: permission.feature,
      degradedBehavior: 'degradedBehavior' in permission
        ? permission.degradedBehavior
        : undefined,
    }))).toEqual(expectedPermissions);
  });

  it('passes the reference catalog context and execution rules', () => {
    for (const permission of manifest.permissions) {
      const entry = REFERENCE_CATALOG[permission.scope];
      expect(entry, `scope not in reference catalog: ${permission.scope}`).toBeDefined();
      expect(entry?.contexts).toContain(permission.context);
      const executionContexts = permission.executionContext === 'both'
        ? ['user', 'background']
        : [permission.executionContext];
      for (const executionContext of executionContexts) {
        expect(entry?.executionContexts).toContain(executionContext);
      }
    }
  });

  it('keeps manifest reasons and each SCOPES row aligned with the complete call-site inventory', () => {
    const scopesDocumentation = fs.readFileSync('SCOPES.md', 'utf8');
    const documentationLines = scopesDocumentation.split(/\r?\n/);

    for (const permission of manifest.permissions) {
      const documentedRow = documentationLines.find((line) => (
        line.startsWith(`| \`${permission.scope}\``)
      ));
      expect(documentedRow, `missing SCOPES.md row for ${permission.scope}`).toBeDefined();

      for (const callSite of expectedCallSites[permission.scope] ?? []) {
        expect(permission.reason, `${permission.scope} reason omits ${callSite}`).toContain(callSite);
        expect(documentedRow, `${permission.scope} SCOPES row omits ${callSite}`).toContain(callSite);
      }

      if (permission.requirement === 'optional') {
        expect(permission.degradedBehavior?.trim().length).toBeGreaterThan(0);
      }
    }

    const schemaRead = manifest.permissions.find((permission) => permission.scope === 'db:schema:read');
    const schemaReadRow = documentationLines.find((line) => line.startsWith('| `db:schema:read`'));
    expect(schemaRead?.reason).toContain('No current schema-read call exists');
    expect(schemaRead?.reason).toContain('Task 8');
    expect(schemaReadRow).toContain('No current schema-read call exists');
    expect(schemaReadRow).toContain('Task 8');
    expect(schemaRead?.reason).not.toContain('src/ui/payroll/services/PayrollService.ts');
    expect(schemaReadRow).not.toContain('src/ui/payroll/services/PayrollService.ts');

    for (const scope of ['db:read', 'db:write', 'db:schema:read', 'db:schema:write']) {
      const permission = manifest.permissions.find((item) => item.scope === scope);
      const documentedRow = documentationLines.find((line) => line.startsWith(`| \`${scope}\``));
      expect(permission?.reason).toContain('Backend owner authorization is additional to this PrivOS grant.');
      expect(documentedRow).toContain('Backend owner authorization is additional to this PrivOS grant.');
    }
  });
});
