# HR Mini App PrivOS Reference Migration Design

## Status and decision

This design migrates `hr-miniapp` to the runtime, manifest, SDK, verification, and packaging conventions demonstrated by `privos-mcp-app-demo` at commit `ebb891e27329bcf1f55406b5ed61a20cc9d6c8bf`.

The selected strategy is **reference shell around existing HR business code**:

- keep the existing HR user experience, business rules, Room folder layout, List layout, App Database collection names, templates, and app-owned business tool names;
- replace the custom Relay-only platform shell with `@privos_ai/app-server`;
- replace the linked React SDK alias with the registry package `@privos_ai/app-react`;
- move Hub access behind explicit, injected gateways and migrate each call only after its current Hub contract is verified;
- make `privos-app.json` the canonical application and permission contract;
- produce a Marketplace-ready application that also supports development Relay and standalone production.

## Goal

Produce a schema-v3 PrivOS MCP App that can run in development, managed, and standalone-production modes without changing what HR users can do or how existing HR data is named and stored.

## Non-goals

- Redesigning the HR interface or navigation.
- Renaming Room folders, Lists, List fields, List stages, App Database collections, or stored files.
- Changing CV scoring, recruitment, lifecycle, email retry, payroll calculation, export, document drafting, or onboarding business rules.
- Importing sample panels, demo records, demo license features, or sample bot workloads from `privos-mcp-app-demo`.
- Carrying the diagnostic-only `debug_log` tool into the Marketplace manifest or adding the reference-only `hr_whoami` sample tool; neither is an HR business workflow.
- Deleting dormant HR source files merely because they are not mounted by the current navigation.
- Claiming production completion from unit tests without a real PrivOS installation and real user interactions.

## Fixed target values

- Node.js: `>=22.0.0`.
- App server SDK: `@privos_ai/app-server@^0.9.0`.
- React SDK: `@privos_ai/app-react@^0.5.0`.
- Manifest schema: `schemaVersion: 3` and `kind: "mcp-app"`.
- App id: `ai.privos.demo-hr-management-ws`.
- Migration release: `2.0.0`.
- App title: `HR Mini app V3`.
- UI resource: `ui://demo-hr-management/form.html`.
- Default HTTP port: `3000`.
- Default local Vite port: `5179`.
- Production root filesystem: read-only compatible.
- Production data ownership: PrivOS Room storage and App Database; the app container remains stateless.

## Business preservation contract

### Navigation and mounting

The following navigation and lazy-mount behavior remains unchanged:

1. `Company` opens the home/company surface.
2. `Email` opens the shared email history.
3. HR section contains `Tuyển dụng`, `CV Pipeline`, `CV đã chấm`, and `Chỉnh sửa JD`.
4. Hành chính section contains `Hồ sơ NS`, `Quản lý Lương`, and `Bot soạn thảo`.
5. Previously visited tabs remain mounted.
6. Payroll disappears and is unmounted when access is revoked.
7. Host theme continues to flow through `ThemeProvider`.

The dashboard entry tool remains `hr_management_dashboard` and continues returning `ui://demo-hr-management/form.html`.

### Recruitment and JD

- Existing JD state, manual creation, generated content, editing, and history behavior stays intact.
- Existing Room storage paths under `hr-miniapp/jds` remain unchanged.
- A failed persistence operation must not be reported as saved.
- The current data templates under `src/ui/data` remain the source material unless a separate feature request changes them.

### CV pipeline and scoring

- Existing input/output folder conventions under `hr-miniapp` remain unchanged.
- Existing stage names and ordering remain unchanged.
- Existing CV parsing, scoring, classification, explanation, batch persistence, and retry behavior remain unchanged.
- Existing file references remain canonical PrivOS file references; migration must not replace them with local paths or transient browser URLs.
- Existing invitation-email action continues to call the app-owned `hrm.mail.send` tool.

### Employee lifecycle

- Existing profile form fields, profile Markdown generation, optional ID image upload, file attachment identity, Kanban stages, list view, and email composer remain unchanged.
- Existing folder, List, stage, field, and document-link names remain unchanged.
- Creation remains fail-closed: a rejected PrivOS write cannot produce a local success record.
- Migration must not delete/recreate existing employee Lists as a repair mechanism.

### Email and retry

- Public MCP tool names remain `hrm.mail.send` and `hrm.mail.retry`.
- The shared List name remains `Quản lí Email`.
- Existing field ids and stage names in `email-history-model.ts` remain unchanged.
- Successful delivery followed by failed history persistence remains a distinct error.
- Failed delivery remains recorded as failed when history persistence succeeds.
- Concurrent retries for the same `roomId:itemId` remain rejected.
- EmailJS remains the delivery provider for this migration.

### Payroll

- Public MCP tool names remain `hrm.payroll.query`, `hrm.payroll.create`, `hrm.payroll.update`, and `hrm.payroll.delete`.
- Collection name remains `payroll_records`.
- Stored record fields remain `employeeId`, `baseSalary`, `taxId`, `bankAccount`, optional `bankName`, `contractType`, `applyProbationRate`, `probationRate`, and server-derived `roomId`, plus PrivOS-managed identifiers/timestamps.
- The existing bank/contract selections, 85% probation behavior, tax-id validation, bank-account validation, filters, calculations, and orphan-record cleanup remain unchanged.
- Existing exports and document upload behavior remain unchanged.
- Payroll stays owner-only and fails closed when caller identity, Room binding, or trusted owner evidence is unavailable.
- Client-side navigation gating is retained for UX but is not treated as backend authorization.

### Company, drafting, and onboarding/training sources

- Company content continues to come from the current Room.
- Drafting continues to load company context and the existing built-in templates.
- Existing document diff/export behavior remains unchanged.
- Existing onboarding/training source files remain in the build and must continue to typecheck even if not currently mounted as a top-level tab.

## Target architecture

```text
PrivOS iframe
  -> @privos_ai/app-react
  -> current-user Hub bridge
     -> app.rest() for approved REST routes
     -> app.uploadFile() for file uploads
     -> app.callServerTool() for app-owned tools and documented MCP App tools

PrivOS MCP dispatch
  -> @privos_ai/app-server serveApp()
  -> ToolCallContext (verified actor, Room, transport, abort signal)
  -> createMcpHandler(dependencies)
     -> mail service -> EmailJS client
     -> email history repository -> injected RoomPlatformGateway
     -> payroll service -> injected PayrollRepository -> RoomPlatformGateway

Runtime modes
  managed               -> workload socket and signed private dispatch
  standalone-production -> paired identity file and verified Relay dispatch
  development           -> Relay compatibility and optional Vite HMR
```

## Dependency boundaries

### Browser-side boundaries

- React components may obtain `McpApp` and host context from hooks.
- Browser services accept narrow interfaces such as `ListsClient`, `FilesClient`, `FoldersClient`, and `SandboxClient`; they do not import or instantiate transport implementations.
- `src/ui/privos-rest.ts` owns REST envelope parsing and permission-safe error mapping.
- `src/ui/platform/create-room-clients.ts` is the browser composition root for PrivOS clients.

### Server-side boundaries

- `src/server.ts` is only the process/runtime composition root.
- `src/mcp/create-mcp-handler.ts` owns MCP method routing.
- `src/mcp/tool-definitions.ts` owns app tool definitions and must match `privos-app.json`.
- `src/platform/hub/RoomPlatformGateway.ts` is the only server-side interface allowed to issue Hub platform calls.
- `src/platform/hub/AgentBotRoomPlatformGateway.ts` implements that interface using the SDK-provided authenticated Hub client.
- `MailService`, `TrackedMailService`, `EmailHistoryRepository`, payroll services, and authorization policies are constructor-injected.
- Production code contains no exported global service singleton.

## Identity and authorization

1. Backend code names a caller only from `ToolCallContext.actor`.
2. `params.arguments.userId`, `roomId`, `roles`, `roomRoles`, `userRoles`, and `isOwner` are never accepted as proof.
3. An app-owned tool that touches Room data requires an exact Room id and rejects when it differs from the verified runtime/actor Room binding.
4. Payroll requires a trusted owner decision in the service layer.
5. The migration cannot go live until a real Hub call proves the authoritative owner contract. Accepted proof is either:
   - an exact role claim covered by the SDK-verified user token/dispatch assertion and documented by the Hub; or
   - a Hub-authorized backend role/membership operation that evaluates the verified `actor.userId` in the verified Room.
6. Until that proof exists, payroll handlers return a generic access-denied result and `/ready` reports a payroll-authorization dependency failure for the production acceptance environment.

This is an explicit production gate, not a client-side fallback.

## Manifest and permission model

`privos-app.json` is the only publisher/runtime manifest. `package.json` mirrors identity/version fields but does not contain a second scope list.

Initial permission set:

- required: `basic:information`, `lists:read`;
- optional: `lists:query`, `lists:write`, `files:read`, `files:write`;
- optional sandbox permissions already used by HR: `sandbox:skills:use`, `sandbox:botkey:push`, `sandbox:wake`, `sandbox:generate`, `sandbox:ai-chat`, `sandbox:ai-chat:write`;
- optional payroll/App Database permissions: `db:read`, `db:write`, `db:schema:read`, `db:schema:write`.

Every optional permission has three matching artifacts:

1. a manifest declaration;
2. a documented call site in `SCOPES.md`;
3. deterministic UI/service behavior when the grant is absent.

EmailJS makes `dataPolicy.externalProcessing` true. The manifest declares the four EmailJS settings without values; secrets are marked secret. Marketplace listing disclosure covers EmailJS as an external destination and the recipient/contact/message data sent to it.

## Platform call migration rule

No blind `privos.*` to `mcpapp.*` rename is allowed. Each current call receives one row in `docs/migration/platform-call-matrix.md` containing:

- old caller and operation;
- exact old argument/response shape consumed by HR;
- target REST route or MCP tool;
- permission;
- current-user or app-bot execution identity;
- unit/contract test;
- live Hub evidence.

A feature slice moves only after its rows are green. Unknown or unavailable routes fail closed and keep the slice behind its existing error state; they do not fabricate local success.

## Packaging and runtime

- Development uses `cross-env PRIVOS_TRANSPORT=relay PRIVOS_DEV_UI=1 tsx src/server.ts` for Windows compatibility.
- Managed/standalone mode selection remains SDK-owned.
- The production MCP UI is built by Vite and inlined from `dist/ui/assets` by the UI resource provider.
- Development UI uses Vite at port 5179 and may use `DEV_TUNNEL=cloudflared` when the iframe browser is remote.
- The image serves `/health`, `/ready`, and `/.well-known/mcp/manifest.json`.
- Production without identity exposes only the reviewed manifest and health surface; it does not expose unsigned MCP dispatch.

## Verification levels

### Static and unit

- strict TypeScript typecheck;
- Vitest unit and contract tests;
- manifest/runtime tool parity;
- permission/call-site/degraded-behavior parity;
- no old SDK namespace or local file dependency;
- deterministic UI asset creation.

### Runtime probes

- direct development server health and readiness;
- manifest endpoint equals canonical manifest;
- Relay connects in development;
- `initialize`, `tools/list`, dashboard `tools/call`, and `resources/read` work;
- generated HTML contains inline JS/CSS in production and Vite URLs only in development.

### Real PrivOS acceptance

- app registered, permissions approved, and installed in a test Room;
- Owner and Member accounts exercise the UI separately;
- every existing tab opens without losing its prior state contract;
- real files, Lists, items, stages, App Database records, and email history are verified downstream;
- payroll access is revoked and rechecked with two sessions;
- Marketplace/standalone acceptance verifies `/health`, `/ready`, manifest digest, and Room installation separately.

Unit/build success alone is not production acceptance.

## Rollout and rollback

1. Publish/install version `2.0.0` into a throwaway Room first.
2. Exercise every migration acceptance scenario against existing-shaped test data.
3. Install into one pilot HR Room and retain the prior version for rollback.
4. Do not mutate or recreate existing Lists/collections during application rollback.
5. Rollback changes only the installed app version/identity binding; Room data remains in place.
