# HR Mini App PrivOS Reference Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `hr-miniapp` to the current PrivOS reference runtime and Marketplace contract while preserving every existing HR business workflow and stored-data contract.

**Architecture:** Keep the existing React HR application and app-owned tool names, replace the custom Relay-only shell with `@privos_ai/app-server`, and move browser/server Hub access behind injected, typed gateways. Characterization tests freeze current behavior before each feature slice moves; production acceptance requires real PrivOS Room verification in addition to static tests.

**Tech Stack:** Node.js 22, TypeScript strict mode, React 18, Vite 5, Vitest 2, `@privos_ai/app-react@^0.5.0`, `@privos_ai/app-server@^0.9.0`, WebSocket Relay, PrivOS schema-v3 manifest.

**Spec:** `docs/superpowers/specs/2026-08-29-hr-miniapp-privos-reference-migration-design.md`

## Global Constraints

- Preserve app id `ai.privos.demo-hr-management-ws`, title `HR Mini app V3`, and UI resource `ui://demo-hr-management/form.html`.
- Set the migration release to `2.0.0`; `package.json`, lockfile root metadata, and `privos-app.json` must match exactly.
- Use Node.js `>=22.0.0`, `@privos_ai/app-server@^0.9.0`, and `@privos_ai/app-react@^0.5.0`.
- Do not retain `@privos/app-react`, a `file:../privos-app-packages/app-react` dependency, or a production dependency on a sibling checkout.
- Do not rename or recreate existing Room folders, Lists, stages, fields, files, App Database collection `payroll_records`, or email-history List `Quản lí Email`.
- Preserve all nine mounted UI surfaces and every source/template file that currently participates in an HR workflow.
- Use constructor/factory injection for services, repositories, queues, clocks, fetch clients, and Hub clients; instantiate them only in composition roots.
- Treat `ToolCallContext.actor` and SDK-verified runtime authorization as the only backend caller evidence.
- Never accept caller-supplied `userId`, `roomId`, role arrays, or owner booleans as authorization proof.
- Keep payroll fail-closed until a real Hub test proves an authoritative Room-owner decision on the backend.
- Make `privos-app.json` the only manifest/permission source of truth; `package.json` contains no second `scopes` array.
- EmailJS is external processing and must be declared as such; no credentials or example credential values enter source, tests, logs, archives, or plan output.
- Use `cross-env` in npm scripts so commands work in Windows PowerShell.
- Do not run or prescribe mutating Git commands under the current `AGENTS.md`; each task ends with a review checkpoint instead of `git add`/`git commit`.
- A passing unit suite/build is not end-to-end proof; Task 14 is required before declaring the migration complete.

---

## Target file structure

### Platform shell and manifest

- Create `privos-app.json`: canonical schema-v3 application, tool, permission, data-policy, runtime-resource, and environment declaration.
- Create `src/manifest.ts`: returns only the reviewed manifest fields and builds the Relay descriptor from that manifest.
- Create `src/app-icon.ts`: reads the existing company SVG as a data URI without changing the visual identity.
- Create `src/runtime/start-privos-runtime.ts`: SDK `serveApp()` runtime factory and manifest-only production fallback.
- Replace `src/server.ts` only at the final cutover in Task 13; until then the old and new shells coexist without sharing business state.
- Replace `src/relay-client.ts` with `src/relay-transport.ts`: development-only pairing/Relay adapter; managed and standalone transports stay SDK-owned.
- Modify `src/dev-server.ts`: keep Vite HMR, use ESM-safe paths, and retain localhost/cloudflared modes.
- Create `scripts/generate-manifest.ts`, `scripts/pair.ts`, and `scripts/preflight.ts`.
- Create `Dockerfile`, `.dockerignore`, and `.gitattributes` from the reference policies, using the HR app identity and build output.

### MCP server boundary

- Create `src/mcp/tool-names.ts`: immutable public app-tool names.
- Create `src/mcp/tool-definitions.ts`: `tools/list` definitions; exact parity with manifest tools.
- Create `src/mcp/ui-resource.ts`: development HTML and production JS/CSS inlining.
- Create `src/mcp/create-mcp-handler.ts`: MCP dispatch router with injected dependencies.
- Replace `src/mcp-message-handlers.ts` at Task 13 with a compatibility re-export after all concrete services are ready; it constructs no dependencies in the final tree.
- Create `src/composition/create-application-services.ts`: production dependency graph.

### Server-side Hub boundary

- Create `src/platform/hub/RoomPlatformGateway.ts`: narrow generic interface for approved Room platform tools.
- Create `src/platform/hub/AgentBotRoomPlatformGateway.ts`: `/api/v1/mcp-apps.tool-call` implementation using an injected SDK Hub client.
- Create `src/platform/hub/resolve-hub-origin.ts` and `src/platform/hub/resolve-own-mcp-app-id.ts`: mode-aware non-secret identity resolution based on the reference app.
- Create `src/platform/hub/parse-tool-result.ts`: strict response-envelope parser.

### Browser-side Hub boundary

- Modify `src/ui/privos-rest.ts`: reference-compatible REST error parsing and permission-safe errors.
- Create `src/ui/platform/contracts.ts`: `ListsClient`, `FilesClient`, `FoldersClient`, `SandboxClient`, and their DTOs.
- Create `src/ui/platform/create-room-clients.ts`: adapters around `app.rest()`, `app.uploadFile()`, and documented MCP tools.
- Create `docs/migration/platform-call-matrix.md`: one verified row per legacy Hub operation.

### Backend business services

- Modify `src/services/MailService.ts`: injected queue, configuration, and delivery client; no singleton.
- Create `src/services/EmailJsMailClient.ts`: the only EmailJS HTTP integration.
- Create `src/services/MailToolApplicationService.ts`: validates MCP mail inputs, Room binding, and verified actor before orchestration.
- Modify `src/services/EmailHistoryRepository.ts`: use `RoomPlatformGateway`; preserve list/field/stage contracts.
- Keep `src/services/TrackedMailService.ts`: preserve its existing orchestration semantics while injecting dependencies.
- Create `src/payroll/PayrollRepository.ts`: fixed collection access through `RoomPlatformGateway`.
- Create `src/payroll/PayrollApplicationService.ts`: validation, Room scoping, owner authorization, and CRUD orchestration.
- Create `src/payroll/PayrollAuthorizationPolicy.ts`: fail-closed trusted actor/owner policy.

### Tests and release documentation

- Create `vitest.config.ts` and migrate the existing test to Vitest.
- Create focused tests under `tests/contracts`, `tests/mcp`, `tests/platform`, `tests/services`, `tests/payroll`, and `tests/ui`.
- Create `SCOPES.md`, `PUBLISHING.md`, `PRIVACY.md`, `TERMS.md`, and `CHANGELOG.md` with HR-specific content.
- Modify `.env.example` to document all three runtime modes and EmailJS configuration without values.

---

### Task 1: Freeze the existing HR business surface with characterization tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/ui/navigation.ts`
- Create: `src/payroll/payroll-types.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/payroll/types.ts`
- Modify: `src/ui/payroll/services/PayrollService.ts`
- Modify: `tests/payroll-access-context.test.ts`
- Create: `tests/contracts/navigation-contract.spec.ts`
- Create: `tests/contracts/storage-contract.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `PRIMARY_TABS`, `TAB_SECTIONS`, `Tab`, and `SectionId` from `src/ui/navigation.ts`.
- Produces: `PAYROLL_COLLECTION_NAME = 'payroll_records'` from `src/payroll/payroll-types.ts`.
- Preserves: existing `App` rendering and payroll access behavior.

- [ ] **Step 1: Add the test runner before changing runtime code**

Add these script/dev-dependency entries while leaving all existing application dependencies in place:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.9"
  }
}
```

Run:

```powershell
npm.cmd install --package-lock-only
```

Expected: `package-lock.json` records Vitest and retains the current application dependency graph.

- [ ] **Step 2: Configure Vitest for the existing Node-only tests**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
```

- [ ] **Step 3: Convert the existing payroll test without changing assertions**

Replace `node:test`/`node:assert` imports with:

```ts
import { describe, expect, it } from 'vitest';
```

Keep four cases: exact owner grants, member denies, malformed result denies, and request failure denies.

- [ ] **Step 4: Write the failing navigation contract test**

Create `tests/contracts/navigation-contract.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PRIMARY_TABS, TAB_SECTIONS } from '../../src/ui/navigation';

describe('HR navigation contract', () => {
  it('preserves all business tabs in their current order', () => {
    const tabs = [
      ...PRIMARY_TABS,
      ...TAB_SECTIONS.flatMap((section) => section.tabs),
    ];
    expect(tabs).toEqual([
      { id: 'home', label: 'Company' },
      { id: 'email', label: 'Email' },
      { id: 'recruitment', label: 'Tuyển dụng' },
      { id: 'pipeline', label: 'CV Pipeline' },
      { id: 'cvScored', label: 'CV đã chấm' },
      { id: 'chatbotJD', label: 'Chỉnh sửa JD' },
      { id: 'lifecycle', label: 'Hồ sơ NS' },
      { id: 'payroll', label: 'Quản lý Lương' },
      { id: 'botDrafting', label: 'Bot soạn thảo' },
    ]);
  });
});
```

Run:

```powershell
npm.cmd test -- tests/contracts/navigation-contract.spec.ts
```

Expected: FAIL because `src/ui/navigation.ts` is missing.

- [ ] **Step 5: Extract navigation constants without changing JSX behavior**

Create `src/ui/navigation.ts` with the exact current order:

```ts
export type Tab =
  | 'home'
  | 'email'
  | 'recruitment'
  | 'pipeline'
  | 'cvScored'
  | 'chatbotJD'
  | 'lifecycle'
  | 'payroll'
  | 'botDrafting';

export type SectionId = 'hr' | 'admin';

export type NavTab = Readonly<{
  id: Tab;
  label: string;
}>;

export const PRIMARY_TABS: readonly NavTab[] = [
  { id: 'home', label: 'Company' },
  { id: 'email', label: 'Email' },
] as const;

export type TabSection = Readonly<{
  id: SectionId;
  label: string;
  tabs: readonly NavTab[];
}>;

export const TAB_SECTIONS: readonly TabSection[] = [
  {
    id: 'hr',
    label: 'HR',
    tabs: [
      { id: 'recruitment', label: 'Tuyển dụng' },
      { id: 'pipeline', label: 'CV Pipeline' },
      { id: 'cvScored', label: 'CV đã chấm' },
      { id: 'chatbotJD', label: 'Chỉnh sửa JD' },
    ],
  },
  {
    id: 'admin',
    label: 'Hành chính',
    tabs: [
      { id: 'lifecycle', label: 'Hồ sơ NS' },
      { id: 'payroll', label: 'Quản lý Lương' },
      { id: 'botDrafting', label: 'Bot soạn thảo' },
    ],
  },
] as const;
```

Import these exports from `App.tsx` and remove only the duplicated local declarations. Keep the two existing primary-button elements and read their ids/labels from `PRIMARY_TABS`; do not alter their DOM order, classes, handlers, or lazy-mount behavior. Re-run the Step 4 test; expected: PASS.

- [ ] **Step 6: Write the failing persisted-storage contract test**

Create `tests/contracts/storage-contract.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMAIL_HISTORY_FIELD_IDS,
  EMAIL_HISTORY_LIST_NAME,
  EMAIL_HISTORY_STAGES,
} from '../../src/email-history/email-history-model';
import {
  PAYROLL_COLLECTION_NAME,
  type PayrollRecordInput,
} from '../../src/payroll/payroll-types';
import { calculateNetSalary } from '../../src/ui/payroll/utils';

describe('persisted HR identifiers', () => {
  it('keeps the payroll collection and shared email List identity unchanged', () => {
    expect(PAYROLL_COLLECTION_NAME).toBe('payroll_records');
    expect(EMAIL_HISTORY_LIST_NAME).toBe('Quản lí Email');
    expect(Object.keys(EMAIL_HISTORY_FIELD_IDS)).toHaveLength(15);
    expect(Object.values(EMAIL_HISTORY_STAGES)).toEqual([
      'Email Phỏng vấn - Đã gửi',
      'Email Phỏng vấn - Gửi lỗi',
      'Email Nhân sự - Đã gửi',
      'Email Nhân sự - Gửi lỗi',
    ]);
  });

  it('keeps every payroll business field and the 85 percent probation rule', () => {
    const record: PayrollRecordInput = {
      employeeId: 'employee-1',
      baseSalary: 10_000_000,
      taxId: '0123456789',
      bankAccount: '123456789',
      bankName: 'Vietcombank',
      contractType: 'Thử việc (85%)',
      applyProbationRate: true,
      probationRate: 85,
    };
    expect(Object.keys(record)).toEqual([
      'employeeId', 'baseSalary', 'taxId', 'bankAccount',
      'bankName', 'contractType', 'applyProbationRate', 'probationRate',
    ]);
    expect(calculateNetSalary(10_000_000, 'Thử việc (85%)', true, 85)).toEqual({
      netSalary: 8_500_000,
      effectiveRate: 85,
      isProbationDiscounted: true,
    });
    expect(calculateNetSalary(10_000_000, 'Thử việc (85%)', false, 85).netSalary)
      .toBe(10_000_000);
  });
});
```

Run `npm.cmd test -- tests/contracts/storage-contract.spec.ts`. Expected: FAIL because `src/payroll/payroll-types.ts` does not exist.

- [ ] **Step 7: Export and freeze the payroll storage contract**

Create `src/payroll/payroll-types.ts` with the shared persisted identifier:

```ts
export const PAYROLL_COLLECTION_NAME = 'payroll_records' as const;

export interface PayrollRecordInput {
  employeeId: string;
  baseSalary: number;
  taxId: string;
  bankAccount: string;
  bankName?: string;
  contractType?: string;
  applyProbationRate?: boolean;
  probationRate?: number;
}
```

Make the current UI `PayrollRecord` extend this shared input and retain its optional `_id`/`roomId` metadata. Import the constant and DTO inside `PayrollService` instead of retaining private duplicates. Do not change the existing bank choices, contract choices, 85% default, salary calculation, tax-id normalization, or bank-account normalization. Re-run `npm.cmd test -- tests/contracts/storage-contract.spec.ts`; expected: PASS.

- [ ] **Step 8: Run the characterization suite**

Run:

```powershell
npm.cmd test
```

Expected: all existing payroll tests and both new contract suites PASS.

- [ ] **Step 9: Review checkpoint**

Inspect `App.tsx` and confirm no component, tab id, label, initial tab, visited-tab behavior, or payroll revocation behavior changed. Do not run a mutating Git command.

---

### Task 2: Replace the linked SDK boundary and make the toolchain reference-compatible

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: every source file listed in **SDK import inventory** below
- Create: `tests/contracts/sdk-boundary.spec.ts`

**Interfaces:**
- Consumes: business characterization tests from Task 1.
- Produces: registry-backed `@privos_ai/app-react` and `@privos_ai/app-server` imports.
- Produces: Windows-safe scripts and strict typecheck command.

**SDK import inventory:**

`src/ui/App.tsx`, `src/ui/bot-drafting-tab.tsx`, `src/ui/company-home.tsx`, `src/ui/contact-collector-form.tsx`, `src/ui/cv-scored/CVScoredTab.tsx`, `src/ui/drafting/services/CompanyContextProvider.ts`, `src/ui/email-history/email-history-service.ts`, `src/ui/email-history/EmailTab.tsx`, `src/ui/email-templates/interview-email-template-default.ts`, `src/ui/email-templates/interview-email-template-repository.ts`, `src/ui/jd-chatbot-functional.tsx`, `src/ui/lifecycle/components/CreateDetailedProfileForm.tsx`, `src/ui/lifecycle/components/EmailComposerModal.tsx`, `src/ui/lifecycle/components/ProfileCard.tsx`, `src/ui/lifecycle/components/ProfileListView.tsx`, `src/ui/lifecycle/LifecycleDashboard.tsx`, `src/ui/lifecycle/services/lifecycleService.ts`, `src/ui/lifecycle/services/PrivOSLifecycleService.ts`, `src/ui/list-items-table.tsx`, `src/ui/payroll/access/usePayrollAccessPolling.ts`, `src/ui/payroll/components/PayrollDashboard.tsx`, `src/ui/payroll/PayrollTab.tsx`, `src/ui/payroll/services/PayrollExportService.ts`, `src/ui/payroll/services/PayrollService.ts`, `src/ui/pipeline-dashboard.tsx`, `src/ui/pipeline-service.ts`, `src/ui/privos-rest.ts`, `src/ui/recruitment-panel.tsx`, and `src/ui/training-dashboard.tsx`.

- [ ] **Step 1: Write the failing SDK-boundary test**

Create `tests/contracts/sdk-boundary.spec.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

describe('PrivOS SDK boundary', () => {
  it('uses registry SDK packages and no legacy namespace', () => {
    const packageText = JSON.stringify(packageJson);
    const sourceText = sourceFiles(path.resolve('src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(packageText).not.toContain('file:../privos-app-packages');
    expect(packageText).not.toContain('@privos/app-react');
    expect(sourceText).not.toContain("'@privos/app-react'");
    expect(packageJson.dependencies?.['@privos_ai/app-server']).toBe('^0.9.0');
    expect(packageJson.devDependencies?.['@privos_ai/app-react']).toBe('^0.5.0');
  });
});
```

Run:

```powershell
npm.cmd test -- tests/contracts/sdk-boundary.spec.ts
```

Expected: FAIL on the linked dependency and legacy imports.

- [ ] **Step 2: Update package identity, runtime, scripts, and dependencies**

Apply these exact fields while retaining HR-specific libraries:

```json
{
  "name": "ai.privos.demo-hr-management-ws",
  "version": "2.0.0",
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "build": "vite build && tsx scripts/generate-manifest.ts && npm run manifest:lint",
    "dev": "cross-env PRIVOS_TRANSPORT=relay PRIVOS_DEV_UI=1 tsx src/server.ts",
    "start": "tsx src/server.ts",
    "pair": "tsx scripts/pair.ts",
    "start:relay": "cross-env PRIVOS_TRANSPORT=relay npm start",
    "start:standalone": "cross-env NODE_ENV=production npm start",
    "typecheck": "tsc --noEmit",
    "typecheck:strict-unused": "tsc --noEmit --noUnusedLocals --noUnusedParameters",
    "test": "vitest run",
    "test:watch": "vitest",
    "manifest:lint": "privos-app lint privos-app.json",
    "preflight": "tsx scripts/preflight.ts"
  },
  "dependencies": {
    "@privos_ai/app-server": "^0.9.0"
  },
  "devDependencies": {
    "@privos_ai/app-react": "^0.5.0",
    "cross-env": "^7.0.3",
    "vitest": "^2.1.9"
  }
}
```

Do not remove `@ant-design/icons`, `@emailjs/browser`, `docx`, `dotenv`, `pdfjs-dist`, `ws`, `xlsx`, React, Vite, or their type packages in this task.

- [ ] **Step 3: Replace every legacy React SDK import**

For every file in the SDK import inventory, replace only the package specifier:

```ts
import { usePrivosApp, usePrivosContext } from '@privos_ai/app-react';
```

Do not rename imported types/hooks or alter component logic in this step.

- [ ] **Step 4: Align TypeScript with the reference ESM boundary**

Use:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **Step 5: Align Vite output with the reference UI inliner**

Remove `vite-plugin-singlefile` and `envDir`. Use:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  base: '/ui/',
  server: { cors: true },
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 6: Regenerate the lockfile from the registry dependency graph**

Run:

```powershell
npm.cmd install
```

Expected: lockfile root version is `2.0.0`; no `../privos-app-packages/app-react` package entry exists; registry resolutions exist for both PrivOS SDKs.

- [ ] **Step 7: Verify dependency and type boundaries**

Run:

```powershell
npm.cmd test -- tests/contracts/sdk-boundary.spec.ts
npm.cmd run typecheck
```

Expected: SDK-boundary test and typecheck PASS. If the registry SDK exposes a stricter type than the linked package, adapt that boundary with an explicit typed helper in this task; do not defer a failing typecheck and do not add an unchecked cast.

- [ ] **Step 8: Review checkpoint**

Confirm this task changed package/import/config boundaries only. No tool name, REST path, folder name, business DTO, or UI behavior changed.

---

### Task 3: Add the canonical schema-v3 manifest and permission contract

**Files:**
- Create: `privos-app.json`
- Create: `src/manifest.ts`
- Create: `src/app-icon.ts`
- Create: `src/mcp/tool-names.ts`
- Create: `SCOPES.md`
- Create: `tests/contracts/manifest.spec.ts`
- Create: `tests/contracts/permission-catalog.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createManifest(): AppManifest`.
- Produces: `buildRelayAppDescriptor(): AppDescriptor`.
- Produces: `APP_TOOL_NAMES` consumed by manifest parity tests and Task 5.

- [ ] **Step 1: Define immutable public tool names**

Create `src/mcp/tool-names.ts`:

```ts
export const APP_TOOL_NAMES = {
  dashboard: 'hr_management_dashboard',
  payrollQuery: 'hrm.payroll.query',
  mailSend: 'hrm.mail.send',
  mailRetry: 'hrm.mail.retry',
  payrollCreate: 'hrm.payroll.create',
  payrollUpdate: 'hrm.payroll.update',
  payrollDelete: 'hrm.payroll.delete',
} as const;

export type AppToolName = (typeof APP_TOOL_NAMES)[keyof typeof APP_TOOL_NAMES];
```

- [ ] **Step 2: Write the failing manifest parity test**

Create `tests/contracts/manifest.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import manifest from '../../privos-app.json';
import packageJson from '../../package.json';
import { APP_TOOL_NAMES } from '../../src/mcp/tool-names';

describe('publisher manifest', () => {
  it('matches package identity and exposes the preserved HR tools', () => {
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.kind).toBe('mcp-app');
    expect(manifest.name).toBe(packageJson.name);
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.title).toBe(packageJson.title);
    expect(manifest.tools.map((tool) => tool.name)).toEqual(Object.values(APP_TOOL_NAMES));
    expect(manifest.tools[0]?.ui?.resourceUri).toBe('ui://demo-hr-management/form.html');
  });
});
```

Run:

```powershell
npm.cmd test -- tests/contracts/manifest.spec.ts
```

Expected: FAIL because `privos-app.json` is absent.

- [ ] **Step 3: Create the exact manifest identity/runtime envelope**

Use these fixed top-level fields:

```json
{
  "schemaVersion": 3,
  "kind": "mcp-app",
  "name": "ai.privos.demo-hr-management-ws",
  "version": "2.0.0",
  "title": "HR Mini app V3",
  "description": "PrivOS Room-scoped HR management application for recruitment, CV processing, employee lifecycle, payroll, email history, and document drafting.",
  "icon": "/public/images/company-logos/logo.svg",
  "homepage": "https://privos.ai",
  "repository": "https://github.com/PrivOS-AI/privos-demo-hrm-ws",
  "availabilityTier": "single",
  "capabilities": { "verifiedActor": true },
  "agentBot": { "name": "HR Mini App Service", "slug": "hr-mini-app-service" },
  "port": 3000,
  "resources": { "memoryMb": 256, "cpus": 0.25, "tmpSizeMb": 64 },
  "volumes": [],
  "stateless": true,
  "resourceManifestTemplate": []
}
```

Use the existing author identity from `package.json`. Use the scaffold-compatible tier `{ "id": "default", "name": "Free", "features": [] }` and omit `limits`; the migration must not add a paid tier, feature gate, or new record cap.

- [ ] **Step 4: Declare the exact permission matrix**

Create permission objects with the exact keys `{ scope, requirement, context, executionContext, feature, reason, degradedBehavior? }`; each optional object also contains the stated degraded behavior:

| Scope | Requirement | Context | Execution | Feature | Degraded behavior |
|---|---|---|---|---|---|
| `basic:information` | required | room | both | `core.context` | Installation is cancelled if rejected. |
| `lists:read` | required | room | user | `hr.lists.read` | Installation is cancelled if rejected. |
| `lists:query` | optional | room | user | `hr.lists.query` | List screens use the bounded non-query route and display that results may be capped. |
| `lists:write` | optional | room | user | `hr.lists.manage` | Recruitment, CV, lifecycle, and email-history writes are disabled; reads remain available. |
| `files:read` | optional | room | user | `hr.files.read` | Existing document previews and Room file discovery are unavailable. |
| `files:write` | optional | room | user | `hr.files.manage` | Upload, generated-document persistence, and payroll export upload are disabled. |
| `sandbox:skills:use` | optional | room | user | `hr.sandbox.skills` | Skill-backed drafting and screening controls are hidden. |
| `sandbox:botkey:push` | optional | room | user | `hr.sandbox.connect` | Sandbox bot-key connection actions are unavailable. |
| `sandbox:wake` | optional | room | user | `hr.sandbox.wake` | Sandbox wake actions are unavailable. |
| `sandbox:generate` | optional | room | user | `hr.sandbox.generate` | AI generation and polling actions are disabled. |
| `sandbox:ai-chat` | optional | room | user | `hr.chat.read` | Existing AI chat/session history is unavailable. |
| `sandbox:ai-chat:write` | optional | room | user | `hr.chat.write` | New AI chat/generation actions are disabled. |
| `db:read` | optional | room | user | `hr.payroll.read` | Payroll is unavailable. |
| `db:write` | optional | room | user | `hr.payroll.manage` | Payroll create/update/delete is unavailable. |
| `db:schema:read` | optional | room | user | `hr.payroll.schema.read` | Payroll schema verification is unavailable. |
| `db:schema:write` | optional | room | user | `hr.payroll.schema.manage` | Payroll collection registration is unavailable. |

Each `reason` must name the concrete HR call sites listed in `SCOPES.md`; do not reuse demo reasons.

- [ ] **Step 5: Declare HR tools with closed input schemas**

Manifest tool order must match `APP_TOOL_NAMES`. Use these inputs:

```ts
const dashboardInput = {
  type: 'object',
  properties: { roomId: { type: 'string' } },
} as const;

const mailSendInput = {
  type: 'object',
  properties: {
    toName: { type: 'string' },
    toEmail: { type: 'string' },
    subject: { type: 'string' },
    htmlContent: { type: 'string' },
    roomId: { type: 'string' },
    source: { type: 'string', enum: ['cv_scored', 'lifecycle'] },
    cvItemId: { type: 'string' },
    cvListId: { type: 'string' },
    jdName: { type: 'string' }
  },
  required: ['toName', 'toEmail', 'subject', 'htmlContent'],
  additionalProperties: false,
} as const;

const mailRetryInput = {
  type: 'object',
  properties: { roomId: { type: 'string' }, itemId: { type: 'string' } },
  required: ['roomId', 'itemId'],
  additionalProperties: false,
} as const;
```

Payroll query has no caller-selected collection/filter. Create accepts a `record` object containing `employeeId`, `baseSalary`, `taxId`, `bankAccount`, and the existing optional `bankName`, `contractType`, `applyProbationRate`, and `probationRate`; update requires `id` plus that same record; delete requires `id`. The server derives Room and always uses `payroll_records`.

- [ ] **Step 6: Declare external processing and environment configuration**

Use:

```json
{
  "dataPolicy": {
    "version": "2026-08-29",
    "retention": "HR records, including tracked email content and delivery metadata, remain in the PrivOS Room until an authorized user deletes them; the stateless app container keeps no local persistent copy.",
    "externalProcessing": true
  }
}
```

Declare `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, and `EMAILJS_PUBLIC_KEY` as required non-secret runtime configuration; declare `EMAILJS_PRIVATE_KEY` as optional secret. Also declare `PRIVOS_AGENT_BOT_CREDENTIAL` as optional secret and `PRIVOS_AGENT_BOT_USER_ID` as optional non-secret platform-injected configuration. Do not include defaults or values.

- [ ] **Step 7: Create manifest projection and descriptor functions**

Create `src/manifest.ts` using the reference field whitelist and build the Relay descriptor exclusively from `privos-app.json`. Create `src/app-icon.ts` with ESM-safe `fileURLToPath(import.meta.url)` and the manifest icon path.

The public signatures are:

```ts
export function createManifest(): AppManifest;
export function buildRelayAppDescriptor(): AppDescriptor;
export function getAppIconDataUri(): string | undefined;
```

- [ ] **Step 8: Document every permission call site**

Create `SCOPES.md` with one row per permission from Step 4. Each row must include requirement, Room/workspace context, execution identity, exact source files, and exact behavior when missing. The payroll rows explicitly state that backend owner authorization is additional to the PrivOS grant.

- [ ] **Step 9: Test catalog and documentation parity**

Create a test that imports the reference catalog accepted by the installed SDK linter and verifies:

```ts
expect(new Set(manifest.permissions.map((permission) => permission.scope))).toEqual(
  new Set(expectedScopes),
);
for (const permission of manifest.permissions.filter((item) => item.requirement === 'optional')) {
  expect(permission.degradedBehavior?.trim().length).toBeGreaterThan(0);
  expect(fs.readFileSync('SCOPES.md', 'utf8')).toContain(`\`${permission.scope}\``);
}
```

Run:

```powershell
npm.cmd run manifest:lint
npm.cmd test -- tests/contracts/manifest.spec.ts tests/contracts/permission-catalog.spec.ts
```

Expected: lint succeeds and both tests PASS.

- [ ] **Step 10: Review checkpoint**

Confirm the manifest contains no sample demo tools, sample license features, YouTube CSP, sample agent-set upload, or sample App Objects functionality.

---

### Task 4: Install the SDK-owned runtime and MCP UI resource delivery

**Files:**
- Create: `src/runtime/start-privos-runtime.ts`
- Create: `src/relay-transport.ts`
- Modify: `src/dev-server.ts`
- Create: `src/mcp/ui-resource.ts`
- Create: `src/mcp/FileSystemUiAssetReader.ts`
- Create: `scripts/generate-manifest.ts`
- Create: `tests/mcp/ui-resource.spec.ts`
- Create: `tests/mcp/runtime-mode.spec.ts`

**Interfaces:**
- Consumes: `createManifest()` and `buildRelayAppDescriptor()` from Task 3.
- Produces: `startPrivosRuntime(handler)` and `startDevelopmentRelay(handler)` for the Task 13 cutover.
- Produces: `createUiResourceProvider()` and `setDevPublicUrl(url)`.

- [ ] **Step 1: Write the failing production UI-resource test**

Create `tests/mcp/ui-resource.spec.ts` with an injected asset reader:

```ts
import { describe, expect, it } from 'vitest';
import { createUiResourceProvider } from '../../src/mcp/ui-resource';

describe('MCP UI resource', () => {
  it('inlines production JS and CSS under the preserved URI', () => {
    const provider = createUiResourceProvider({
      assetReader: {
        readAssets: () => ({ js: 'globalThis.__hrLoaded=true;', css: 'body{color:red}' }),
      },
    });

    const resource = provider.read('ui://demo-hr-management/form.html');
    expect(resource.mimeType).toBe('text/html;profile=mcp-app');
    expect(resource.text).toContain('<style>body{color:red}</style>');
    expect(resource.text).toContain('globalThis.__hrLoaded=true;');
    expect(resource.text).not.toContain('/assets/');
  });
});
```

Expected: FAIL because the provider is absent.

- [ ] **Step 2: Implement an injectable UI resource provider**

Use this interface:

```ts
export interface UiAssetReader {
  readAssets(): Readonly<{ js: string; css: string }>;
}

export interface HrUiResourceProvider {
  read(uri: string): Readonly<{ uri: string; mimeType: 'text/html;profile=mcp-app'; text: string }>;
  setDevPublicUrl(url: string | null): void;
}

export function createUiResourceProvider(dependencies: {
  assetReader: UiAssetReader;
}): HrUiResourceProvider;
```

Implement `FileSystemUiAssetReader` as the only filesystem adapter and constructor-inject its absolute `dist/ui/assets` directory. Export `resolveUiAssetsDirectory(): string` from that file using `fileURLToPath(new URL('../../dist/ui/assets/', import.meta.url))`; Task 13 uses this exact resolver. Reject any URI other than `ui://demo-hr-management/form.html`. In production read the single JS and optional CSS asset through the injected reader; reject zero or multiple JS entry assets. In development emit Vite client, React refresh, and `/ui/main.tsx` references exactly as the reference app does.

- [ ] **Step 3: Write the failing Relay adapter identity tests**

Call the handler returned by `createRelayMcpHandler(fakeHandler)` and cover these cases using `ToolCallContext` fixtures:

1. verified actor is forwarded unchanged;
2. missing actor stays missing;
3. plain `_meta.privosUser` fields never create an actor;
4. `context.roomId` reaches the handler context;
5. `context.signal` reaches the handler context.

- [ ] **Step 4: Implement `src/relay-transport.ts` from the reference boundary**

Use SDK `pairFromDescriptor`, `connectRelay`, `ApplicationMcpRequest`, `ToolCallContext`, and `RelayHandle`. Keep `persistIdentityFile: false` in development and cache only `PRIVOS_URL`, `CLIENT_ID`, `CLIENT_SECRET`, and returned `MCP_APP_ID` in `.env`.

Use constructor/factory injection instead of a mutable active-handler global:

```ts
export function createRelayMcpHandler(handler: AppMcpHandler): AppMcpHandler {
  return async (request: ApplicationMcpRequest, context: ToolCallContext): Promise<unknown> =>
    handler(request, context);
}

export async function startDevelopmentRelay(handler: AppMcpHandler): Promise<RelayHandle>;
```

Tests inject a fake handler. The adapter never parses actor identity from request params.

- [ ] **Step 5: Implement an injected runtime factory without switching the current entrypoint**

Create `src/runtime/start-privos-runtime.ts` with the reference structure and accept the application handler as an argument:

```ts
export async function startPrivosRuntime(handler: AppMcpHandler): Promise<ServeAppHandle> {
  const transportOverride = process.env.PRIVOS_TRANSPORT === 'relay' ? 'relay' : undefined;
  const handle = await serveApp({
    descriptor: buildRelayAppDescriptor(),
    createHandler: () => handler,
    port: Number(process.env.PORT || 3000),
    ...(transportOverride ? { transportOverride } : {}),
    resolveManifest: () => createManifest(),
    configure: (app) => {
      app.get('/.well-known/mcp/manifest.json', (_request, response) => {
        response.json(createManifest());
      });
    },
  });
  return handle;
}
```

Retain the reference fail-closed manifest-only surface for `PRODUCTION_WITHOUT_IDENTITY`. Do not catch `AMBIGUOUS_RUNTIME_IDENTITY`. Leave `src/server.ts` on the current shell until Task 13 can inject fully implemented mail/payroll services atomically.

- [ ] **Step 6: Update development UI startup**

Keep `DEV_TUNNEL=localhost|cloudflared`, `VITE_PORT=5179`, and optional `PUBLIC_URL`. Use ESM-safe module paths and type HMR configuration without `any`:

```ts
type HmrOptions = Readonly<{
  protocol: 'ws' | 'wss';
  host: string;
  clientPort: number;
}>;
```

- [ ] **Step 7: Generate the built manifest**

Create `scripts/generate-manifest.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { createManifest } from '../src/manifest';

const output = path.resolve('dist/manifest.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(createManifest(), null, 2)}\n`);
```

- [ ] **Step 8: Verify runtime and UI resource tests**

Run:

```powershell
npm.cmd test -- tests/mcp/ui-resource.spec.ts tests/mcp/runtime-mode.spec.ts
npm.cmd run typecheck
npm.cmd run build
```

Expected: tests, typecheck, and build PASS; `dist/ui/assets` and `dist/manifest.json` exist.

- [ ] **Step 9: Review checkpoint**

Confirm managed and standalone transports are not reimplemented locally. Confirm the new runtime modules have no module-level business services. The old `src/relay-client.ts` remains active only until Task 13.

---

### Task 5: Split MCP routing from business services and add dependency injection

**Files:**
- Create: `src/mcp/tool-definitions.ts`
- Create: `src/mcp/create-mcp-handler.ts`
- Create: `src/composition/application-services.ts`
- Create: `src/mcp/tool-inputs.ts`
- Create: `tests/mcp/tool-parity.spec.ts`
- Create: `tests/mcp/handler-routing.spec.ts`

**Interfaces:**
- Produces: `HrApplicationServices`.
- Produces: `createMcpHandler(dependencies): AppMcpHandler`.
- Consumes: Task 4 UI provider.
- Defers: concrete mail/payroll/gateway implementations to Tasks 6–8.

- [ ] **Step 1: Write the failing tool parity test**

```ts
import { describe, expect, it } from 'vitest';
import manifest from '../../privos-app.json';
import { HR_TOOL_DEFINITIONS } from '../../src/mcp/tool-definitions';

describe('MCP tool parity', () => {
  it('keeps runtime tools identical to the reviewed manifest', () => {
    expect(HR_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual(
      manifest.tools.map((tool) => tool.name),
    );
  });
});
```

- [ ] **Step 2: Define narrow application service interfaces**

Create `src/mcp/tool-inputs.ts` with exact application inputs:

```ts
import type { EmailSource } from '../email-history/email-history-model';
import type { PayrollRecordInput } from '../payroll/payroll-types';

export interface MailSendInput {
  toName: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
  roomId?: string;
  source?: EmailSource;
  cvItemId?: string;
  cvListId?: string;
  jdName?: string;
}

export interface MailRetryInput {
  roomId: string;
  itemId: string;
}

export interface PayrollCreateInput {
  record: PayrollRecordInput;
}

export interface PayrollUpdateInput {
  id: string;
  record: PayrollRecordInput;
}

export interface PayrollDeleteInput {
  id: string;
}
```

Export parser functions that accept `unknown`, whitelist the keys above, validate types, and reject unknown keys. Then define service interfaces:

```ts
import type { VerifiedActor } from '@privos_ai/app-server';

export interface MailToolService {
  send(input: MailSendInput, actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
  retry(input: MailRetryInput, actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
}

export interface PayrollToolService {
  query(actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
  create(input: PayrollCreateInput, actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
  update(input: PayrollUpdateInput, actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
  delete(input: PayrollDeleteInput, actor: VerifiedActor | undefined, roomId: string | undefined): Promise<unknown>;
}

export interface HrApplicationServices {
  mail: MailToolService;
  payroll: PayrollToolService;
  ui: HrUiResourceProvider;
}
```

Define and validate each input as a whitelisted object; never spread raw `params.arguments` into a downstream query or HTTP payload.

- [ ] **Step 3: Build tool definitions from immutable schemas**

Create `HR_TOOL_DEFINITIONS` in the same order and with the same schemas as the manifest. Import `APP_TOOL_NAMES`; do not duplicate string tool names in the handler.

- [ ] **Step 4: Write routing tests with injected fakes**

Cover dashboard, mail send/retry, four payroll operations, unknown tool, `tools/list`, `resources/read`, and unsupported method. Assert each service receives the exact verified actor and context Room; assert unknown tools do not invoke a service. Assert neither diagnostic-only `debug_log` nor reference-only `hr_whoami` appears in `tools/list`.

- [ ] **Step 5: Implement `createMcpHandler()`**

Use:

```ts
export function createMcpHandler(services: HrApplicationServices): AppMcpHandler {
  return async (request, context) => {
    switch (request.method) {
      case 'tools/list':
        return { tools: HR_TOOL_DEFINITIONS };
      case 'tools/call':
        return handleToolCall(request.params, context, services);
      case 'resources/read':
        return { contents: [services.ui.read(readRequestedUri(request.params))] };
      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  };
}
```

Define these helpers in the same file so every identifier in the router is concrete:

```ts
function readRequestedUri(params: unknown): string;
async function handleToolCall(
  params: unknown,
  context: ToolCallContext,
  services: HrApplicationServices,
): Promise<unknown>;
```

`readRequestedUri` accepts only a string `uri` and defaults to the one HR UI URI when the Hub omits it. `handleToolCall` validates the tool name against `APP_TOOL_NAMES`, invokes the matching parser from `tool-inputs.ts`, and then invokes exactly one service.

The SDK answers `initialize` and `notifications/initialized`; keep compatibility cases only if a test proves the development Relay adapter still forwards them.

- [ ] **Step 6: Create the application-service contract used by the later composition root**

Create `src/composition/application-services.ts` exporting `HrApplicationServices`. Task 13 will instantiate one queue, one EmailJS client, one authenticated Hub client, one Room platform gateway, one email repository, one tracked-mail service, one payroll repository, one payroll authorization policy, one payroll application service, one UI resource provider, and one MCP handler.

No component outside `src/composition` or `src/server.ts` may use `new` for a service/repository/external client after cutover.

- [ ] **Step 7: Keep the new handler parallel to the current handler until concrete services exist**

Do not modify `src/mcp-message-handlers.ts` or `src/server.ts` in this task. The new handler is compiled and fully tested through injected fakes; Task 13 performs the atomic entrypoint switch after Tasks 7 and 8 provide concrete services.

- [ ] **Step 8: Run routing/parity tests**

```powershell
npm.cmd test -- tests/mcp/tool-parity.spec.ts tests/mcp/handler-routing.spec.ts
npm.cmd run typecheck
```

Expected: PASS with no global service construction.

- [ ] **Step 9: Review checkpoint**

Confirm controllers/handlers only parse MCP concerns and delegate business behavior. Confirm service error text is mapped to generic tool errors at the MCP boundary while full secrets/documents are never logged.

---

### Task 6: Add the injected server-side Room platform gateway

**Files:**
- Create: `src/platform/hub/RoomPlatformGateway.ts`
- Create: `src/platform/hub/AgentBotRoomPlatformGateway.ts`
- Create: `src/platform/hub/parse-tool-result.ts`
- Create: `src/platform/hub/resolve-hub-origin.ts`
- Create: `src/platform/hub/resolve-own-mcp-app-id.ts`
- Create: `docs/migration/platform-call-matrix.md`
- Create: `tests/platform/room-platform-gateway.spec.ts`

**Interfaces:**
- Produces: `RoomPlatformGateway.call<T>(request): Promise<T>`.
- Consumes: SDK `createAgentBotHubClient()` only in the composition root.
- Used by: email history and payroll repositories.

- [ ] **Step 1: Verify the backend tool catalog before coding the union**

Against a throwaway Room on the target Hub, inspect the authorized MCP App tool catalog/request schemas for the List, stage, and App Database operations required by Tasks 7 and 8. Record exact tool names, required arguments, response envelope, required scope, Hub build/version, and one non-destructive success fixture in the backend rows of `docs/migration/platform-call-matrix.md`. For App Database query, record pagination/cursor semantics and maximum page size. For schema registration, record the exact non-destructive behavior when a collection already exists and whether optional fields/indexes can be added without recreation.

The reference already proves `mcpapp.lists.create`, `mcpapp.lists.addField`, `mcpapp.lists.createItem`, `mcpapp.lists.updateCustomField`, `mcpapp.lists.getItems`, `mcpapp.db.registerCollection`, `mcpapp.db.create`, `mcpapp.db.query`, and `mcpapp.db.getSchema`. Room List discovery, stage movement/lookup, whole-item update, DB update, and DB delete must be confirmed before their provisional names enter the implemented union. If an operation is absent, keep the dependent write disabled and do not invent a name; Task 14 cannot declare the migration complete while a retained business workflow is disabled.

- [ ] **Step 2: Define a closed gateway request type**

```ts
export type ServerPlatformScope =
  | 'lists:read'
  | 'lists:write'
  | 'db:read'
  | 'db:write'
  | 'db:schema:read'
  | 'db:schema:write';

export type ServerPlatformTool =
  | 'mcpapp.lists.create'
  | 'mcpapp.lists.createItem'
  | 'mcpapp.lists.getAll'
  | 'mcpapp.lists.getItems'
  | 'mcpapp.lists.moveItemToStage'
  | 'mcpapp.lists.updateCustomField'
  | 'mcpapp.lists.updateItem'
  | 'mcpapp.stages.getByList'
  | 'mcpapp.db.registerCollection'
  | 'mcpapp.db.create'
  | 'mcpapp.db.query'
  | 'mcpapp.db.update'
  | 'mcpapp.db.delete'
  | 'mcpapp.db.getSchema';

export interface RoomPlatformCall {
  roomId: string;
  requiredScope: ServerPlatformScope;
  toolName: ServerPlatformTool;
  arguments: Readonly<Record<string, unknown>>;
}

export interface RoomPlatformGateway {
  call<T>(request: RoomPlatformCall): Promise<T>;
}
```

`mcpapp.lists.getAll`, `mcpapp.lists.moveItemToStage`, `mcpapp.lists.updateItem`, `mcpapp.stages.getByList`, `mcpapp.db.update`, and `mcpapp.db.delete` are provisional names copied from current HR usage. Keep each one in the implemented union only when Task 6 Step 1 records that exact target-Hub name and request fixture; otherwise replace it with the verified target name. `mcpapp.lists.updateCustomField` is the documented fallback for email-field updates when whole-item update is unavailable.

- [ ] **Step 3: Write the failing transport-shape test**

Inject an `AuthorizedHubClient` fake and assert the request is exactly:

```json
{
  "mcpAppId": "app-1",
  "toolName": "mcpapp.db.query",
  "arguments": { "collection": "payroll_records" },
  "roomId": "room-1"
}
```

Assert path `/api/v1/mcp-apps.tool-call`, method `POST`, `requiredScope: 'db:read'`, `retryMode: 'never'`, and `content-type: application/json`.

- [ ] **Step 4: Implement strict tool-result parsing**

`parseToolResult<T>(response)` must reject HTTP failure, `{ success: false }`, missing `content[0].text`, and invalid JSON. Return parsed JSON only. Error messages include tool name/status but never response headers, credentials, or full HR documents.

- [ ] **Step 5: Implement mode-aware app id and Hub origin resolution**

Port the reference `resolve-hub-origin.ts` and `resolve-own-mcp-app-id.ts`, retaining its precedence:

1. managed workload identity;
2. standalone identity file;
3. development `PRIVOS_URL`/`MCP_APP_ID`.

Return `undefined` rather than guessing; the gateway throws a clear configuration error before issuing a request.

- [ ] **Step 6: Implement `AgentBotRoomPlatformGateway`**

Constructor-inject:

```ts
export interface AuthorizedHubClient {
  authorizedFetch(input: string, init: {
    method: 'POST';
    requiredScope: ServerPlatformScope;
    retryMode: 'never';
    headers: Readonly<Record<string, string>>;
    body: string;
  }): Promise<Response>;
}
```

Also inject `resolveMcpAppId: () => Promise<string | undefined>`. Do not instantiate the SDK Hub client inside the class.

- [ ] **Step 7: Define the concrete SDK client wiring used by Task 13**

Specify the one-time composition used by Task 13:

```ts
const hubClient = createAgentBotHubClient({ resolveHubOrigin });
const roomPlatform = new AgentBotRoomPlatformGateway(
  hubClient,
  resolveOwnMcpAppId,
);
```

- [ ] **Step 8: Run gateway tests**

```powershell
npm.cmd test -- tests/platform/room-platform-gateway.spec.ts
npm.cmd run typecheck
```

Expected: success/failure/malformed-response tests PASS and no request accepts an arbitrary scope/tool string.

- [ ] **Step 9: Review checkpoint**

Confirm there is one server-side Hub client per process and no per-request OAuth/Relay client construction.

---

### Task 7: Migrate mail delivery and email-history persistence without behavior changes

**Files:**
- Create: `src/config/emailjs-config.ts`
- Create: `src/services/EmailJsMailClient.ts`
- Create: `src/services/MailToolApplicationService.ts`
- Modify: `src/services/MailService.ts`
- Modify: `src/services/TrackedMailService.ts`
- Modify: `src/services/EmailHistoryRepository.ts`
- Modify: `src/utils/TaskQueue.ts`
- Create: `src/composition/create-legacy-mail-services.ts`
- Modify: `src/mcp-message-handlers.ts`
- Create: `tests/services/mail-service.spec.ts`
- Create: `tests/services/tracked-mail-service.spec.ts`
- Create: `tests/services/email-history-repository.spec.ts`

**Interfaces:**
- Consumes: `RoomPlatformGateway` from Task 6.
- Produces: `MailToolService` implementation consumed by Task 5.
- Preserves: EmailJS provider, 1.5-second queue spacing, history List schema, status transitions, and retry lock.

- [ ] **Step 1: Write the tracked-mail characterization tests first**

Cover these exact scenarios with injected fake history/delivery gateways:

1. delivery success then history `sent` record;
2. delivery failure then history `failed` record and original delivery error rethrown;
3. delivery failure plus history failure produces the combined Vietnamese error;
4. delivery success plus history failure reports that email was sent but history failed;
5. retry is allowed only for a failed record;
6. concurrent retry of the same `roomId:itemId` is rejected;
7. retry delivery failure marks failed;
8. retry delivery success marks sent.

Use a deferred promise in case 6 so concurrency is deterministic; do not use real timers or EmailJS.

- [ ] **Step 2: Extract validated EmailJS configuration**

```ts
export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
}

export function readEmailJsConfig(environment: NodeJS.ProcessEnv): EmailJsConfig;
```

Trim all values. Throw a configuration error naming missing keys only; never include values.

- [ ] **Step 3: Implement an injected EmailJS client**

```ts
export interface MailDeliveryClient {
  send(params: SendMailParams, signal?: AbortSignal): Promise<void>;
}

export class EmailJsMailClient implements MailDeliveryClient {
  constructor(
    private readonly config: EmailJsConfig,
    private readonly fetchFn: typeof fetch,
  ) {}
}
```

Whitelist the outbound payload keys. On non-2xx, read at most 1,000 characters, redact token-like fields, and throw a generic delivery error. Do not log recipient, message body, or provider response.

- [ ] **Step 4: Inject queue and client into `MailService`**

```ts
export class MailService implements MailDeliveryGateway {
  constructor(
    private readonly queue: TaskQueue,
    private readonly client: MailDeliveryClient,
  ) {}

  async queueMail(params: SendMailParams): Promise<void> {
    await this.queue.enqueue(() => this.client.send(params));
  }
}
```

Delete the exported `mailService` singleton. Configure `TaskQueue({ delayMs: 1500 })` only in a composition root.

- [ ] **Step 5: Replace repository Relay calls with `RoomPlatformGateway`**

Keep all current list/field/stage constants. Use the Task 6 matrix to map the current repository calls as follows:

| Current repository need | Target contract |
|---|---|
| find `Quản lí Email` in the verified Room | live-confirmed Room List discovery operation from Task 6 |
| load the four stage ids | live-confirmed stage lookup operation from Task 6 |
| create the List with 15 fields and four stages | documented `mcpapp.lists.create` |
| create a history item | documented `mcpapp.lists.createItem` |
| load bounded history items | documented `mcpapp.lists.getItems` with finite `count` and verified `listId` |
| change a history stage | live-confirmed stage-movement operation from Task 6 |
| update history values | live-confirmed whole-item update, or documented `mcpapp.lists.updateCustomField` once per changed field when whole-item update is absent |

Every call includes the method's verified `roomId`; `getRecord` confirms the returned item belongs to the repository's Room-scoped List. The per-field fallback does not rewrite the immutable record id and does not report success until every required field update and stage movement succeeds.

Require `EmailHistoryRepository` constructor dependencies `{ now: () => string; createRecordId: () => string }` in addition to `RoomPlatformGateway`; tests inject deterministic values and the composition root injects the production clock/id generator. Do not change `recordToCustomFields`, `recordPayload`, `getStageId`, retry counters, timestamps, or error redaction except to replace `any` with validated records.

- [ ] **Step 6: Add repository tests for exact Hub requests**

Assert:

- existing `Quản lí Email` is reused;
- missing List creates one List with the 15 existing fields and four stages;
- `createItem` receives `title`, `stageId`, and exact custom field ids;
- item id is required before success;
- move/update failures reject;
- room A's cached store is never reused for room B.

- [ ] **Step 7: Build the mail MCP service adapter**

The new `MailToolService` adapter derives `requestedBy` from verified `actor.userId` and ignores a caller-supplied value. It receives the SDK context Room as its third parameter. Tracked send/retry requires a verified actor, a non-empty context Room, exact equality between the context Room and any compatibility `input.roomId`, and a supported source. Untracked send remains available because the current tool permits mail without history metadata; it still requires a verified actor in production and never accepts caller identity.

Implement it as `MailToolApplicationService implements MailToolService`, constructor-injecting `TrackedMailService` and `MailDeliveryGateway`. Its `send()` and `retry()` methods accept only the parsed inputs from Task 5.

For the still-active legacy entrypoint, create `src/composition/create-legacy-mail-services.ts` and construct the queue/client/repository/tracked service there. Modify `src/mcp-message-handlers.ts` only to receive that composed object rather than importing a singleton or calling `new`; retain its current `requestedBy` behavior solely until Task 13 switches to the verified-actor handler. This transitional path is never used for production acceptance.

- [ ] **Step 8: Run mail tests**

```powershell
npm.cmd test -- tests/services/mail-service.spec.ts tests/services/tracked-mail-service.spec.ts tests/services/email-history-repository.spec.ts
npm.cmd run typecheck
```

Expected: all eight orchestration cases and repository request-shape cases PASS.

- [ ] **Step 9: Review checkpoint**

Confirm no test or log contains an email credential, full HTML email body, or full stored HR item.

---

### Task 8: Move payroll behind a fixed repository and trusted backend authorization

**Files:**
- Modify: `src/payroll/payroll-types.ts`
- Create: `src/payroll/PayrollRepository.ts`
- Create: `src/payroll/PayrollAuthorizationPolicy.ts`
- Create: `src/payroll/PayrollApplicationService.ts`
- Create: `tests/payroll/payroll-repository.spec.ts`
- Create: `tests/payroll/payroll-authorization.spec.ts`
- Create: `tests/payroll/payroll-application-service.spec.ts`
- Create: `tests/integration/payroll-owner-contract.spec.ts`

**Interfaces:**
- Consumes: `RoomPlatformGateway`, `AuthorizedHubClient`, and verified `ToolCallContext.actor`.
- Produces: fixed-collection payroll CRUD service.
- Hard gate: real Hub owner proof before production acceptance.

- [ ] **Step 1: Define a strict payroll DTO**

```ts
export interface PayrollRecordInput {
  employeeId: string;
  baseSalary: number;
  taxId: string;
  bankAccount: string;
  bankName?: string;
  contractType?: string;
  applyProbationRate?: boolean;
  probationRate?: number;
}

export interface StoredPayrollRecord extends PayrollRecordInput {
  _id: string;
  roomId: string;
  _createdAt?: string;
  _updatedAt?: string;
}

export const PAYROLL_COLLECTION_NAME = 'payroll_records' as const;
```

Retain the `PayrollRecordInput` and collection constant created in Task 1, and extend that file only with `StoredPayrollRecord`; do not declare a second copy in UI code.

Validation trims strings and rejects unknown input keys. It requires a non-empty employee id; requires `baseSalary` to be an integer from `0` through `999999999999` (the current `^\d{1,12}$` rule); after removing whitespace, accepts an empty tax id or `^(?:\d{10}|\d{12}|\d{10}-?\d{3})$`; after removing whitespace, accepts an empty bank account or `^[0-9-]{6,24}$`; accepts only booleans for `applyProbationRate`; and accepts only finite `probationRate` values from 0 through 100. It does not rename or drop `bankName`, `contractType`, the 85% probation default, or empty tax/bank strings already accepted by the form.

- [ ] **Step 2: Write failing repository query-shape tests**

Assert the repository always emits:

```ts
{
  collection: 'payroll_records',
  where: [{ field: 'roomId', op: '==', value: 'room-1' }],
  orderBy: [{ field: 'employeeId', direction: 'asc' }],
  limit: 200,
}
```

Assert subsequent pages use only the live-confirmed cursor field from the Task 6 response contract and retain the same Room filter/order/limit. Assert create/update overwrite any caller-supplied Room with the verified Room; delete accepts only a validated record id and verified Room.

- [ ] **Step 3: Implement fixed App Database access**

Register these fields and no caller-defined fields:

```ts
const PAYROLL_SCHEMA_FIELDS = [
  { name: 'employeeId', type: 'string', required: true, maxLength: 200 },
  { name: 'baseSalary', type: 'number', required: true },
  { name: 'taxId', type: 'string', required: false, maxLength: 200 },
  { name: 'bankAccount', type: 'string', required: false, maxLength: 200 },
  { name: 'bankName', type: 'string', required: false, maxLength: 200 },
  { name: 'contractType', type: 'string', required: false, maxLength: 200 },
  { name: 'applyProbationRate', type: 'boolean', required: false },
  { name: 'probationRate', type: 'number', required: false },
  { name: 'roomId', type: 'string', required: true, maxLength: 200 },
] as const;
```

`PayrollRepository` constructor accepts `RoomPlatformGateway`. It uses `mcpapp.db.registerCollection`, `.query`, `.create`, `.update`, `.delete`, and `.getSchema` with the exact `db:*` scope per operation. It projects only payroll fields; every query includes verified `roomId`, `limit: 200`, and the live-confirmed cursor where pagination is available. It follows pages until the Hub reports no next cursor, then returns the same complete array expected by the current `IPayrollService`; a repeated cursor or malformed page rejects instead of returning a partial successful dataset. If the target query contract has no pagination, Task 6 must prove a documented complete-result bound and use that bound as the finite limit; otherwise payroll remains production-disabled. It never issues an unbounded empty query or accepts a raw filter/collection from MCP arguments.

Call `getSchema` before registration. For a new collection, register all fields above. For an existing collection, treat “already registered” as success only after `getSchema` confirms the original five fields and any already-used optional business fields have compatible types. If `bankName`, `contractType`, `applyProbationRate`, or `probationRate` requires schema evolution, use only a non-destructive schema operation confirmed in Task 6; never delete/recreate `payroll_records`. If the target offers no compatible schema-evolution path, leave existing data untouched and keep payroll production-disabled until the Hub contract supports it.

When reading legacy documents created under the original five-field schema, normalize absent `taxId` and `bankAccount` to empty strings and leave the four later optional fields absent so the existing UI defaults (`Vietcombank`, `Chính thức`, enabled 85%, rate 85) remain authoritative. Do not persist those defaults merely because a record was read.

The reference demo proves that `registerCollection` accepts an `indexes` array, but does not document a non-empty index descriptor. Use the exact descriptor returned or accepted by the target Hub contract discovery in Task 6 to register an index whose leading field is `roomId` and whose second field is `employeeId`; record the confirmed descriptor in `SCOPES.md` and assert it in the repository contract test. Do not guess the JSON shape. If the target Hub cannot guarantee that supporting index, keep payroll production-disabled rather than ship a growable unindexed Room query.

- [ ] **Step 4: Define a fail-closed owner policy interface**

```ts
export interface PayrollOwnerEvidence {
  userId: string;
  roomId: string;
  isOwner: true;
  provenance: 'verified-actor-claim' | 'hub-authorization';
}

export interface PayrollAuthorizationPolicy {
  requireOwner(actor: VerifiedActor | undefined, roomId: string | undefined): Promise<PayrollOwnerEvidence>;
}

export interface PayrollAuthorizationDependencies {
  roomPlatform: RoomPlatformGateway;
  hubClient: AuthorizedHubClient;
}

export function createProvenPayrollAuthorizationPolicy(
  dependencies: PayrollAuthorizationDependencies,
): PayrollAuthorizationPolicy;
```

Missing actor, missing Room, actor/Room mismatch, missing trusted role evidence, malformed claims, and Hub request failure all reject with `PAYROLL_ACCESS_DENIED`.

- [ ] **Step 5: Add the live Hub owner-contract probe before choosing the adapter**

Run this test only when `PRIVOS_E2E=1` and approved test credentials/Room are supplied through the environment. It must exercise one Owner and one Member and record only booleans/provenance, never tokens or claim values.

Acceptance is exactly:

```ts
expect(ownerDecision).toEqual({ allowed: true, source: expectedTrustedSource });
expect(memberDecision).toEqual({ allowed: false, source: expectedTrustedSource });
```

If the Hub exposes neither a documented signed owner claim nor an authorized backend role operation, implement `createProvenPayrollAuthorizationPolicy(dependencies)` with the tested deny-all policy and mark payroll production-disabled. The factory receives external clients from the composition root and never creates one internally. Do not implement authorization from UI `userRoles`, tool arguments, or guessed claim keys.

- [ ] **Step 6: Implement the proven authorization adapter**

Use only the exact contract proven in Step 5. Unit fixtures must include the signed/authorized response shape and tests for Owner, Member, malformed response, wrong Room, missing actor, and request failure. The policy returns `PayrollOwnerEvidence`; no boolean-only helper crosses into the application service.

- [ ] **Step 7: Implement payroll application service**

Every method calls `requireOwner()` before repository access. It derives Room from the verified context, validates DTOs, and returns projected records. It maps repository failures to generic service errors without logging salary, tax id, or bank account.

- [ ] **Step 8: Add contract fixtures for the final browser payroll payload**

Add tests that define the Task 13 cutover contract: keep the four `hrm.payroll.*` names but send no `collection`, `where`, or `roomId` as authority. The expected payloads are:

```ts
{ name: 'hrm.payroll.query', arguments: {} }
{ name: 'hrm.payroll.create', arguments: { record } }
{ name: 'hrm.payroll.update', arguments: { id, record } }
{ name: 'hrm.payroll.delete', arguments: { id } }
```

Use a `record` fixture containing all existing business fields: employee id, base salary, tax id, bank account, bank name, contract type, probation toggle, and probation rate. Do not change the mounted browser service in this task; Task 13 switches its payload atomically with the new server handler. The tests created here must fail against a payload containing collection/filter authority or a dropped business field and pass against the new payload builder.

- [ ] **Step 9: Run payroll suites**

```powershell
npm.cmd test -- tests/payroll
npm.cmd run typecheck
```

Expected: repository, authorization, validation, Room mismatch, and all CRUD service tests PASS. The E2E contract remains explicitly skipped unless `PRIVOS_E2E=1`.

- [ ] **Step 10: Review checkpoint**

Do not mark payroll production-ready unless the Owner/Member live contract test has passed against the target Hub. UI-only owner gating is not acceptance.

---

### Task 9: Introduce typed browser platform clients and complete the legacy-call matrix

**Files:**
- Modify: `src/ui/privos-rest.ts`
- Create: `src/ui/platform/contracts.ts`
- Create: `src/ui/platform/create-room-clients.ts`
- Modify: `docs/migration/platform-call-matrix.md`
- Create: `tests/ui/privos-rest.spec.ts`
- Create: `tests/ui/room-clients.spec.ts`

**Interfaces:**
- Produces: `RoomClients` consumed by Tasks 10–11.
- Preserves: current-user execution for browser Room operations.
- Prevents: blind tool renames and raw response envelopes in feature services.

- [ ] **Step 1: Port the reference REST envelope behavior with tests**

Test and implement:

- unwrap `{ statusCode, body }`;
- throw `OptionalFeatureUnavailableError` on 403;
- surface machine-readable `errorType` separately from user text;
- reject `{ success: false }`;
- return a typed body on success;
- map permission-looking errors to a stable degraded-feature message.

- [ ] **Step 2: Define browser client contracts**

```ts
import type { McpApp } from '@privos_ai/app-react';

export interface FieldDefinition {
  _id: string;
  name: string;
  type: string;
}

export interface ListSummary {
  _id: string;
  name: string;
  fieldDefinitions?: readonly FieldDefinition[];
}

export interface StageSummary {
  _id: string;
  name?: string;
}

export interface ListItem {
  _id: string;
  name: string;
  stageId?: string;
  customFields?: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface ListInfo {
  list: ListSummary;
  stages: readonly StageSummary[];
}

export interface ItemsQuery {
  listId: string;
  text?: string;
  updatedAtGte?: string;
  cursor?: string;
  count: number;
}

export interface ItemsPage {
  items: readonly ListItem[];
  nextCursor: string | null;
}

export interface BoundedItems {
  items: readonly ListItem[];
  truncated: boolean;
}

export interface CreateListInput {
  roomId: string;
  name: string;
  description?: string;
  fieldDefinitions: readonly Readonly<{ fieldId?: string; name: string; type: string }>[];
  stages?: readonly Readonly<{ name: string; color?: string }>[];
  isolatedList?: boolean;
}

export interface CreatedList {
  list: ListSummary;
  defaultStage?: StageSummary;
  stages: readonly StageSummary[];
}

export interface AddFieldInput {
  listId: string;
  fieldId?: string;
  name: string;
  type: string;
}

export interface CreateItemInput {
  listId: string;
  title: string;
  description?: string;
  stageId: string;
  customFields: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface UpdateItemInput {
  itemId: string;
  title: string;
  description?: string;
  customFields: readonly Readonly<{ fieldId: string; value: unknown }>[];
}

export interface ListsClient {
  listByRoom(roomId: string): Promise<readonly ListSummary[]>;
  getInfo(listId: string): Promise<ListInfo>;
  queryItems(input: ItemsQuery): Promise<ItemsPage>;
  listItemsBounded(listId: string): Promise<BoundedItems>;
  createList(input: CreateListInput): Promise<CreatedList>;
  addField(input: AddFieldInput): Promise<FieldDefinition>;
  createItem(input: CreateItemInput): Promise<ListItem>;
  updateItem(input: UpdateItemInput): Promise<ListItem>;
  moveItemToStage(itemId: string, stageId: string): Promise<ListItem>;
  deleteItem(itemId: string): Promise<void>;
}

export interface RoomFile {
  _id: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface UploadInput {
  roomId: string;
  fileName: string;
  base64Data: string;
  mimeType: string;
}

export type UploadedFile = RoomFile;

export interface FilesClient {
  listRoomFiles(roomId: string): Promise<readonly RoomFile[]>;
  readFile(fileId: string, fileName: string): Promise<string>;
  upload(input: UploadInput): Promise<UploadedFile>;
}

export interface FolderRef {
  _id: string;
  name: string;
}

export interface FoldersClient {
  ensurePath(roomId: string, segments: readonly string[]): Promise<FolderRef>;
  findByPath(roomId: string, segments: readonly string[]): Promise<FolderRef | null>;
}

export interface AiMessageInput {
  roomId: string;
  content: string;
  sessionId?: string;
  fileIds?: readonly string[];
}

export interface AiMessageDispatch {
  sessionId: string;
  aiMessageId?: string;
}

export interface AiMessage {
  _id: string;
  status?: string;
  content?: string;
  createdAt?: string;
}

export interface SandboxClient {
  sendAiMessage(input: AiMessageInput): Promise<AiMessageDispatch>;
  listAiMessages(sessionId: string, count: number): Promise<readonly AiMessage[]>;
}

export interface RoomClients {
  lists: ListsClient;
  files: FilesClient;
  folders: FoldersClient;
  sandbox: SandboxClient;
}

export function createRoomClients(
  app: Pick<McpApp, 'rest' | 'uploadFile' | 'callServerTool'>,
): RoomClients;
```

Implement `FoldersClient` only after Step 4 proves the target operations; if the target Hub lacks them, its adapter throws `OptionalFeatureUnavailableError` and the affected feature remains disabled. Feature services inject these interfaces, not raw `McpApp`.

- [ ] **Step 3: Implement documented reference routes**

Use these exact mappings:

| Operation | Target |
|---|---|
| context | `app.callServerTool({ name: 'mcpapp.context.get', arguments: {} })` |
| list Room lists | `GET lists.listByRoomId?roomId={roomId}` |
| list info | `GET lists.info?listId={listId}` |
| paged/search items | `POST items.query` |
| bounded fallback | `GET items.listByListId?listId={listId}` |
| create list | `POST lists.create` |
| create list with explicit stages/field ids | `app.callServerTool({ name: 'mcpapp.lists.create', arguments: { roomId, name, description, fieldDefinitions, stages, isolatedList } })` |
| add field | `POST lists.fields.create` |
| create item | `POST items.create` |
| update item | `POST items.update` |
| delete item | `POST items.delete` |
| list files | `GET file-management.files.channel/<roomId>` |
| read file | `GET file-management.files/<fileId>/content/<encodedName>` |
| upload file | `app.uploadFile()` |
| send AI message | `POST ai-messages.send` |
| poll AI messages | `GET ai-messages.list?sessionId={sessionId}&count={count}` |

- [ ] **Step 4: Probe every undocumented mutation required by retained workflows against a real development Hub**

For each current `privos.folders.*` call, file update/delete call, stage lookup/movement call, List batch-create call, and whole-item update call not covered by Step 3, capture `tools/list`/route schema and one non-destructive request in a throwaway Room. Record the exact operation, arguments, response keys, required scope, and Hub version in `platform-call-matrix.md`. The allowed result is either a verified target operation or an explicit unsupported row that keeps the feature disabled; invented names are not allowed, and Task 14 cannot complete while a retained mounted workflow is disabled.

- [ ] **Step 5: Populate every legacy operation row**

The matrix must include all current unique calls: context; DB register/query/create/update/delete; file get/getByChannel/getContent/search/update/delete; folder create/getByChannel/search; List addField/batchCreate/create/createItem/create_item/deleteMany/get/getAll/getItems/moveItemToStage/searchItems/updateItem; stage getByList; message send/getRecent; `api/files/list`; `api/files/content`; and `lists.info`.

Each row has columns: source files, old operation, target, identity, scope, request fixture, response fixture, unit test, live result.

- [ ] **Step 6: Test client request/response contracts**

Inject a fake `McpApp` containing only `rest`, `uploadFile`, and `callServerTool`. Assert exact HTTP method/path/query/body and strict response parsing for every documented mapping in Step 3.

- [ ] **Step 7: Run browser platform tests**

```powershell
npm.cmd test -- tests/ui/privos-rest.spec.ts tests/ui/room-clients.spec.ts
npm.cmd run typecheck
```

Expected: documented routes PASS; unsupported matrix rows remain feature-disabled with an explicit test.

- [ ] **Step 8: Review checkpoint**

Confirm no client sends a bearer token, OAuth secret, agent-bot credential, or claimed caller identity.

---

### Task 10: Migrate recruitment, CV pipeline, scored CV, and JD editing as one tested slice

**Files:**
- Modify: `src/ui/recruitment-panel.tsx`
- Modify: `src/ui/pipeline-service.ts`
- Modify: `src/ui/pipeline-dashboard.tsx`
- Modify: `src/ui/cv-scored/CVScoredTab.tsx`
- Modify: `src/ui/jd-chatbot-functional.tsx`
- Modify: `src/ui/jd-chat-history.ts`
- Modify: `src/ui/cv-context-builder.ts`
- Modify: `src/ui/cv-scoring-policy.ts`
- Modify: `src/ui/screening-strategy.ts`
- Modify: `src/ui/email-templates/interview-email-template-repository.ts`
- Create: `tests/ui/recruitment-persistence.spec.ts`
- Create: `tests/ui/pipeline-platform-adapter.spec.ts`
- Create: `tests/ui/cv-scored-mail.spec.ts`
- Create: `tests/ui/jd-chat-contract.spec.ts`

**Interfaces:**
- Consumes: `RoomClients` and mail tool names.
- Preserves: templates, scoring, stage order, Room paths, generated files, and UI messages.

- [ ] **Step 1: Write recruitment persistence tests before adapter changes**

Cover successful JD save, upload rejection, missing Room, and duplicate replacement. Assert local state/form close happens only after persistence succeeds. Assert target path remains `hr-miniapp/jds` and MIME type remains `text/markdown`.

- [ ] **Step 2: Inject platform clients into recruitment and pipeline services**

Components obtain clients from `createRoomClients(app)` and pass narrow interfaces to services. `PipelineService` constructor becomes:

```ts
constructor(
  private readonly roomId: string,
  private readonly lists: ListsClient,
  private readonly files: FilesClient,
  private readonly folders: FoldersClient,
  private readonly sandbox: SandboxClient,
) {}
```

Do not instantiate a transport/client inside the service.

- [ ] **Step 3: Replace only green matrix rows**

Move list/file/message operations to Task 9 clients. Preserve existing parsing/scoring/poll timeouts, fixed Kanban field ids, field labels/types, stage names/order/colors, and the system stage-mapping item. If a required folder/List/stage mutation row is unsupported, expose the existing error state and keep write controls disabled rather than falling back to local state; Task 14 remains incomplete.

- [ ] **Step 4: Preserve AI message semantics using native AI Chat routes**

Replace `privos.messages.send/getRecent` with `ai-messages.send/list`. Maintain the existing 30-second window, 3-second interval, and one retry, but identify completion from the returned AI message/session status rather than username substring matching.

- [ ] **Step 5: Preserve batch/list semantics**

If `batchCreateItems` is not a verified target operation, use a verified bulk Hub operation when available; otherwise process at concurrency `4` with a deterministic operation id derived from Room, source file id, list id, and candidate index. Return separate succeeded/failed item ids and never claim the whole batch succeeded after a rejected item.

- [ ] **Step 6: Preserve scored-CV invitation behavior**

Keep validation, default template loading, `hrm.mail.send`, Room/source metadata, CV item/list ids, JD name, and visible success/failure states. Remove `requestedBy` from caller arguments because backend derives it from verified actor.

- [ ] **Step 7: Run feature slice tests**

```powershell
npm.cmd test -- tests/ui/recruitment-persistence.spec.ts tests/ui/pipeline-platform-adapter.spec.ts tests/ui/cv-scored-mail.spec.ts tests/ui/jd-chat-contract.spec.ts
npm.cmd run typecheck
```

Expected: all preserved business tests PASS and no legacy call remains in these files unless its matrix row is explicitly unsupported/disabled.

- [ ] **Step 8: Manual development acceptance for the slice**

In a throwaway Room: create and reload a JD; process one real CV file; verify pass/fail output location; verify List item/stage; open scored CV; send one test invitation; verify `Quản lí Email` downstream. Record ids/status only, not CV/email contents.

- [ ] **Step 9: Review checkpoint**

Confirm no CV/JD template, scoring threshold, folder segment, stage label, or email template changed.

---

### Task 11: Migrate lifecycle, company, drafting, email UI, and retained onboarding/training code

**Files:**
- Modify: `src/ui/company-home.tsx`
- Modify: `src/ui/bot-drafting-tab.tsx`
- Modify: `src/ui/drafting/services/CompanyContextProvider.ts`
- Modify: `src/ui/drafting/services/DraftingTemplateService.ts`
- Modify: `src/ui/email-history/email-history-service.ts`
- Modify: `src/ui/email-history/EmailTab.tsx`
- Modify: `src/ui/lifecycle/LifecycleDashboard.tsx`
- Modify: `src/ui/lifecycle/services/lifecycleService.ts`
- Modify: `src/ui/lifecycle/services/PrivOSLifecycleService.ts`
- Modify: `src/ui/lifecycle/components/CreateDetailedProfileForm.tsx`
- Modify: `src/ui/lifecycle/components/EmailComposerModal.tsx`
- Modify: `src/ui/training-dashboard.tsx`
- Modify: `src/ui/onboarding/services/OnboardingService.ts`
- Create: `tests/ui/company-context.spec.ts`
- Create: `tests/ui/drafting-contract.spec.ts`
- Create: `tests/ui/email-history-ui.spec.ts`
- Create: `tests/ui/lifecycle-persistence.spec.ts`
- Create: `tests/ui/training-onboarding-boundary.spec.ts`

**Interfaces:**
- Consumes: Task 9 Room clients and Task 7 mail tools.
- Preserves: existing Room paths, profile/file identity, lifecycle stages, drafting templates, and email retry UI.

- [ ] **Step 1: Characterize lifecycle persistence before changing calls**

Test success, create rejection, missing Room, optional image-upload rejection, Markdown upload rejection, List item rejection, reload, stage movement, and email send. Assert no `local-*` success id is created after a rejected server write and no destructive List recreation is attempted.

- [ ] **Step 2: Inject Room clients into lifecycle services**

Replace raw `McpApp` dependencies with narrow clients. Keep `LifecycleContext` as the UI composition boundary. Preserve all profile DTOs and document-link parsing.

- [ ] **Step 3: Replace legacy lifecycle calls from green matrix rows**

Use REST List/item routes and file upload/content routes. Preserve title/name conversion at the adapter boundary: domain code continues to use its current profile terminology while the adapter emits the exact Hub field (`name` for REST item creation).

Remove the fire-and-forget `debug_log` server-tool call from `PrivOSLifecycleService` without changing its stage-resolution result. Add a lifecycle assertion that the same raw item/stage fixture resolves to the same status and invokes no app-owned tool; do not replace it with `hr_whoami` or another diagnostic tool.

- [ ] **Step 4: Preserve company/drafting context**

`CompanyContextProvider` continues resolving `hr-miniapp/company` in the current Room. Missing folder/files abort drafting with the current visible error; do not substitute hard-coded company facts. All built-in templates under `src/ui/drafting/templates` remain unchanged.

- [ ] **Step 5: Preserve email history UI**

Keep stage/status parsing and `hrm.mail.retry`. The browser reads the Room List using `ListsClient`; retry stays app-owned/server-side. Permission denial displays degraded behavior instead of an empty successful mailbox.

- [ ] **Step 6: Remove backend-only environment access from browser code**

The current browser references are exactly `src/ui/onboarding/PrivosApi.ts` and `src/ui/onboarding/services/OnboardingService.ts`. Remove their reads of `process.env.PRIVOS_AUTH_TOKEN`, `PRIVOS_USER_ID`, and `PRIVOS_URL`; replace reachable calls with Room clients. Keep retained unmounted code compiling, and add a test plus built-output scan proving none of those three identifiers remains under `src/ui` or enters the browser bundle.

- [ ] **Step 7: Run the feature suites**

```powershell
npm.cmd test -- tests/ui/company-context.spec.ts tests/ui/drafting-contract.spec.ts tests/ui/email-history-ui.spec.ts tests/ui/lifecycle-persistence.spec.ts tests/ui/training-onboarding-boundary.spec.ts
npm.cmd run typecheck
npm.cmd run build
```

Expected: tests, typecheck, and build PASS; build output contains no `PRIVOS_AUTH_TOKEN` or `PRIVOS_USER_ID` string.

- [ ] **Step 8: Manual development acceptance for the slice**

In a throwaway Room: load company context; generate one draft; create a profile with and without image; reload profile; move lifecycle stage; send/retry a test email; verify List/file downstream results.

- [ ] **Step 9: Review checkpoint**

Confirm all source data/templates remain present and no existing Room List/folder was deleted or recreated.

---

### Task 12: Add deterministic permission degradation and preserve navigation behavior

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/navigation.ts`
- Create: `src/ui/access/feature-capabilities.ts`
- Modify: `src/ui/company-home.tsx`
- Modify: `src/ui/email-history/EmailTab.tsx`
- Modify: `src/ui/recruitment-panel.tsx`
- Modify: `src/ui/pipeline-dashboard.tsx`
- Modify: `src/ui/cv-scored/CVScoredTab.tsx`
- Modify: `src/ui/jd-chatbot-functional.tsx`
- Modify: `src/ui/lifecycle/LifecycleDashboard.tsx`
- Modify: `src/ui/payroll/PayrollTab.tsx`
- Modify: `src/ui/bot-drafting-tab.tsx`
- Create: `tests/ui/feature-capabilities.spec.ts`
- Create: `tests/ui/navigation-permissions.spec.ts`

**Interfaces:**
- Consumes: `effectiveScopes` from `@privos_ai/app-react`.
- Produces: pure `resolveFeatureCapabilities(scopes)` used by navigation/components.
- Preserves: payroll owner polling and lazy tab mounting.

- [ ] **Step 1: Write the failing pure capability tests**

Cover unresolved scopes, required scopes present, every optional scope missing, read-only list mode, missing upload permission, missing sandbox write permission, missing DB permissions, and a complete grant.

- [ ] **Step 2: Implement a pure capability model**

```ts
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

export function resolveFeatureCapabilities(
  effectiveScopes: readonly string[] | undefined,
): FeatureCapabilities;
```

Unresolved/malformed scopes produce the least-privileged state. Required-scope installation failure is handled by PrivOS; the UI still fails closed during initialization.

- [ ] **Step 3: Apply degradation without changing business layout**

Keep all current navigation labels/order. Disable/hide only controls whose manifest permission is optional and absent. Read-only views remain visible when their read permission exists. Show the exact degraded behavior from `SCOPES.md`.

- [ ] **Step 4: Retain payroll's two independent gates**

Payroll navigation requires both DB capabilities and the latest successful `mcpapp.context.get` owner result. Initialize access to `false`; do not grant from raw host `userRoles` while the mediated context result is pending. Backend authorization remains Task 8's trusted policy. When either client gate becomes false, remove payroll from visited tabs and return Home exactly as today.

- [ ] **Step 5: Test revocation behavior**

Use fake scope updates and owner polling results. Assert active payroll unmounts, navigation disappears, visited state removes payroll, and no payroll service call occurs after revocation.

- [ ] **Step 6: Run UI policy tests**

```powershell
npm.cmd test -- tests/ui/feature-capabilities.spec.ts tests/ui/navigation-permissions.spec.ts tests/payroll-access-context.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 7: Review checkpoint**

Confirm permission gating changed availability only, not domain calculations, labels, data transformations, or persistence payloads.

---

### Task 13: Cut over the runtime and add pairing, preflight, packaging, and release documentation

**Files:**
- Create: `src/composition/create-application-services.ts`
- Replace: `src/server.ts`
- Replace: `src/mcp-message-handlers.ts` with a compatibility re-export of the new handler factory
- Modify: `src/ui/payroll/services/PayrollService.ts`
- Modify: `src/ui/payroll/access/usePayrollAccessPolling.ts`
- Create: `scripts/pair.ts`
- Create: `scripts/preflight.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `.gitattributes`
- Modify: `.gitignore`
- Modify: `.env.example`
- Create: `PUBLISHING.md`
- Create: `PRIVACY.md`
- Create: `TERMS.md`
- Create: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete after importer check: `src/relay-client.ts`
- Delete after importer check: `src/composition/create-legacy-mail-services.ts`
- Create: `tests/contracts/packaging.spec.ts`
- Create: `tests/contracts/preflight.spec.ts`

**Interfaces:**
- Consumes: manifest/runtime/build from Tasks 2–5.
- Produces: deterministic Marketplace/standalone package and documented operator flow.

- [ ] **Step 1: Perform the atomic application composition and runtime cutover**

Create `src/composition/create-application-services.ts` and instantiate the final dependency graph exactly once:

```ts
import { randomUUID } from 'node:crypto';

export function createApplicationServices(): Readonly<{
  mcpHandler: AppMcpHandler;
  ui: HrUiResourceProvider;
}> {
  const emailConfig = readEmailJsConfig(process.env);
  const queue = new TaskQueue({ delayMs: 1500 });
  const emailClient = new EmailJsMailClient(emailConfig, fetch);
  const mailDelivery = new MailService(queue, emailClient);
  const hubClient = createAgentBotHubClient({ resolveHubOrigin });
  const roomPlatform = new AgentBotRoomPlatformGateway(hubClient, resolveOwnMcpAppId);
  const emailHistory = new EmailHistoryRepository(roomPlatform, {
    now: () => new Date().toISOString(),
    createRecordId: randomUUID,
  });
  const trackedMail = new TrackedMailService(emailHistory, mailDelivery);
  const mail = new MailToolApplicationService(trackedMail, mailDelivery);
  const payrollRepository = new PayrollRepository(roomPlatform);
  const payrollAuthorization = createProvenPayrollAuthorizationPolicy({ roomPlatform, hubClient });
  const payroll = new PayrollApplicationService(payrollRepository, payrollAuthorization);
  const uiAssetReader = new FileSystemUiAssetReader(resolveUiAssetsDirectory());
  const ui = createUiResourceProvider({ assetReader: uiAssetReader });
  const mcpHandler = createMcpHandler({ mail, payroll, ui });
  return Object.freeze({ mcpHandler, ui });
}
```

`createProvenPayrollAuthorizationPolicy({ roomPlatform, hubClient })` must be the exact adapter that passed Task 8's live contract; if no adapter passed, the factory returns the tested deny-all production policy and payroll remains unavailable.

Replace `src/server.ts` with a minimal composition root that loads dotenv, calls `createApplicationServices()`, passes the handler to `startPrivosRuntime()`, and passes the same handler to `startDevelopmentRelay()` only in development Relay mode. Replace `src/mcp-message-handlers.ts` with exports from `src/mcp/create-mcp-handler.ts`; it constructs nothing.

Update the browser `PayrollService` to emit the four authority-free payload fixtures from Task 8 and update polling to `mcpapp.context.get`. Run the full test/typecheck suite before deleting any old transport/compatibility file.

- [ ] **Step 2: Port standalone pairing from the reference app**

Use `pairAndAwaitApproval`/resume APIs from `@privos_ai/app-server`, announce the canonical descriptor/manifest, write the SDK identity file at mode `0600`, require the two-run approval flow described by the installed SDK, and never place a pairing URL in command arguments or logs.

- [ ] **Step 3: Add release and container scripts before invoking them**

Add these scripts and regenerate the lockfile root metadata:

```json
{
  "scripts": {
    "verify:fast-pr": "npm run typecheck:strict-unused && npm run test && npm run build && npm run preflight",
    "publish:marketplace": "privos-app publish",
    "docker:build": "docker build -t privos-hr-miniapp:local .",
    "docker:run": "docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 100 --tmpfs /tmp -p 3000:3000 -e PORT=3000 privos-hr-miniapp:local"
  }
}
```

Run:

```powershell
npm.cmd install --package-lock-only
```

Expected: `package.json` and lockfile root both remain version `2.0.0`.

- [ ] **Step 4: Implement preflight gates**

Preflight verifies:

- manifest/package/lock versions and identity;
- supported schema v3;
- manifest lint;
- no local link packages;
- each permission documented in `SCOPES.md`;
- each manifest tool present in runtime definitions;
- EmailJS external processing/env declarations;
- production manifest endpoint equality;
- Docker/package inputs;
- no `.env*`, identity file, credential-like path, dependencies, build output, or archive in the source package.

Exit non-zero with a concrete fix for every failure.

- [ ] **Step 5: Create a hardened multi-stage Dockerfile**

Use Node 22, `npm ci`, build in the builder stage, copy only production dependencies plus built/source runtime inputs, run as non-root `node`, expose 3000, and set the manifest digest label in the Marketplace build path. The runtime must work with `--read-only`, dropped capabilities, `no-new-privileges`, PID limit, and `/tmp` tmpfs as in the reference command.

- [ ] **Step 6: Add archive exclusion policies**

`.gitattributes` marks `.env.example`, agent-context files, local plans, screenshots not needed at runtime, test output, and credential-like files `export-ignore`. `.dockerignore` excludes `.git`, `node_modules`, `dist-source`, `.env*`, identity files, tests, and local documentation not required by runtime.

Replace the broad `docs` ignore with exact local-output rules and add credential-safe patterns:

```gitignore
node_modules/
dist/
dist-source/
.env*
!.env.example
privos-standalone-identity*.json
*.tsbuildinfo
.test-outputs/
AGENTS.md
CLAUDE.md
tools_files.md
```

This allows the design, plan, migration matrix, and acceptance procedure to be reviewed while keeping environment/identity files out of normal source tracking.

- [ ] **Step 7: Replace `.env.example` with three-mode documentation**

Document development Relay cache, optional Vite tunnel, standalone identity file, managed workload socket/platform values, and EmailJS keys without values. State that production runtime mode is auto-detected and that development credentials are never used in managed/standalone production.

- [ ] **Step 8: Write HR-specific privacy/release documents**

`PRIVACY.md` names HR data categories and EmailJS external processing. `TERMS.md` states operator responsibility. `PUBLISHING.md` uses the reference CLI flow and HR listing requirements. `CHANGELOG.md` documents `2.0.0` as a platform migration with no intended business/data contract changes. `README.md` documents development, managed, standalone, health/readiness, and exact verification commands.

- [ ] **Step 9: Remove old transport and transitional composition only after proof of zero importers**

Run:

```powershell
rg -n "relay-client|callHubTool|pairWithPrivos|create-legacy-mail-services" src tests
```

Expected before deletion: no importer of `src/relay-client.ts`, no business service using `callHubTool`, and no importer of the transitional mail composition. Then delete `src/relay-client.ts` and `src/composition/create-legacy-mail-services.ts`; re-run the same command and typecheck.

- [ ] **Step 10: Add packaging/preflight tests**

Assert required root entries, denied paths, canonical manifest endpoint, no local dependency, and no credential-like file in the packaged file list. Tests must not read `.env`, `.env.backup`, or standalone identity contents.

- [ ] **Step 11: Run release gates**

```powershell
npm.cmd run typecheck:strict-unused
npm.cmd test
npm.cmd run build
npm.cmd run preflight
npm.cmd run docker:build
```

Expected: every command exits 0. If Bash is unavailable for a retained parity script, use the cross-platform `privos-app publish --dry-run` path and record the skipped parity script without calling publication successful.

- [ ] **Step 12: Review checkpoint**

Confirm packaging reads tracked/reviewed inputs, not a broad working-tree sweep, and contains no secrets or previous identity files.

---

### Task 14: Execute real PrivOS acceptance and controlled rollout

**Files:**
- Create: `docs/migration/acceptance-results.md`
- Create: `tests/e2e/README.md`
- Modify: `docs/migration/platform-call-matrix.md`
- Modify: `CHANGELOG.md` only if acceptance reveals a user-visible migration correction

**Interfaces:**
- Consumes: completed build/image, manifest, pairing flow, and all feature slices.
- Produces: evidence that app runtime, approval, installation, UI resources, authorization, and business persistence work independently.

- [ ] **Step 1: Prepare an isolated acceptance environment**

Use a throwaway PrivOS tenant/Room, one Owner account, one Member account, and test-only HR documents. Do not reuse production credentials or real employee payroll data.

- [ ] **Step 2: Verify development Relay as separate checkpoints**

Record pass/fail for:

1. process starts;
2. Vite starts on 5179;
3. OAuth token succeeds;
4. Relay connects;
5. `initialize` succeeds;
6. `tools/list` returns the seven manifest tools;
7. dashboard `tools/call` returns the UI resource;
8. `resources/read` returns `text/html;profile=mcp-app`;
9. iframe assets load;
10. app is approved and installed in the Room.

Do not combine these into one “working” result.

- [ ] **Step 3: Verify health, readiness, and manifest**

Run against managed or standalone production:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000/ready -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000/.well-known/mcp/manifest.json -UseBasicParsing
```

Expected: health 200; ready 200 only after identity/manifest trust is active; served manifest equals `privos-app.json` projection.

- [ ] **Step 4: Exercise every existing business surface**

Record one real interaction and downstream verification for Company, Email, Tuyển dụng, CV Pipeline, CV đã chấm, Chỉnh sửa JD, Hồ sơ NS, Quản lý Lương, and Bot soạn thảo. For each, record generated PrivOS ids/paths/status only and redact person/contact/payroll content.

- [ ] **Step 5: Verify persistence after reload**

Reload the iframe and confirm saved JD, CV stage/item, employee profile/document link, email status, payroll record, and drafted file still exist in the same Room locations/collections.

- [ ] **Step 6: Verify failure behavior**

Revoke each optional permission in turn. Confirm the documented degraded behavior, no local success after rejected writes, no destructive List repair, and no swallowed load error rendered as an empty successful dataset.

- [ ] **Step 7: Verify payroll with two sessions**

Owner opens payroll. Member cannot open or directly call payroll tools. While Owner payroll is active, revoke/downgrade that user's owner authorization using a second admin session; confirm navigation disappears, view returns Home, payroll DOM unmounts, and subsequent backend CRUD is denied.

- [ ] **Step 8: Verify EmailJS and history as separate outcomes**

Send one test invitation and one lifecycle email. Confirm EmailJS success separately from `Quản lí Email` persistence. Force one provider failure and verify failed history plus retry transition.

- [ ] **Step 9: Complete the platform-call matrix**

Mark every row with target Hub version, live result, response-shape confirmation, and acceptance evidence. No row used by a mounted feature may remain unverified or unsupported without a corresponding disabled UI state.

- [ ] **Step 10: Pilot and rollback drill**

Install `2.0.0` in one pilot HR Room, verify the acceptance subset, switch back to the previous app version, and confirm existing Room Lists/files/App Database records remain intact. Reinstall `2.0.0` and confirm the same data reappears.

- [ ] **Step 11: Final verification command set**

Run from `hr-miniapp`:

```powershell
npm.cmd ci
npm.cmd run typecheck:strict-unused
npm.cmd test
npm.cmd run build
npm.cmd run manifest:lint
npm.cmd run preflight
npm.cmd run docker:build
```

Expected: all commands exit 0 and acceptance-results contains no unresolved failure for a mounted feature.

- [ ] **Step 12: Review and completion checkpoint**

Declare migration complete only when static gates, runtime probes, registration/approval/Room installation, Owner/Member authorization, and real downstream business persistence all pass. Do not run a mutating Git command under the current repository instruction.

---

## Task dependency order

```text
Task 1 characterization
  -> Task 2 SDK/toolchain
  -> Task 3 manifest
  -> Task 4 runtime/UI resource
  -> Task 5 MCP routing/DI
  -> Task 6 server Hub gateway
       -> Task 7 mail
       -> Task 8 payroll
  -> Task 9 browser clients/call matrix
       -> Task 10 recruitment/CV/JD
       -> Task 11 lifecycle/company/drafting/email
  -> Task 12 permission degradation
  -> Task 13 packaging/release
  -> Task 14 real PrivOS acceptance
```

Tasks 7 and 8 may run in parallel after Task 6. Tasks 10 and 11 may run in parallel after Task 9. All other arrows are hard dependencies.
