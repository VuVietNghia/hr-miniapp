# PrivOS HR Mini App 2.0.0 acceptance results

## Decision

**BLOCKED / NOT COMPLETE**

This record was prepared on 2026-08-30 under a local-only authorization. No tenant, Room, user
session, OAuth flow, Relay, registration, approval, installation, Hub call, EmailJS delivery,
payroll operation, Docker operation, Marketplace operation, pilot, rollback, or network request was
performed. Local tests and build gates are recorded only as **LOCAL PASS** and are not evidence of
live PrivOS behavior.

Task 14 can be unblocked only by the user's explicit authorization for a real acceptance session
and by supplying operator-controlled access to a throwaway PrivOS tenant/Room, one Owner session,
one Member session, the target Hub build/version, a reviewed test installation of version 2.0.0,
test-only EmailJS configuration/recipient, and an approved pilot/rollback window. Unsupported
mounted dependencies must first have documented target contracts or remain visibly disabled.

## Record metadata and evidence rules

| Field | Value |
|---|---|
| Application | `ai.privos.demo-hr-management-ws` |
| Release | `2.0.0` |
| UI resource | `ui://demo-hr-management/form.html` |
| Record date | 2026-08-30 |
| Target tenant / Room | **NOT PROVIDED** |
| Target Hub build/version | **UNKNOWN / NOT LIVE VERIFIED** |
| Runtime mode | **NOT SELECTED** |
| Authorization boundary | Local deterministic execution only |
| Live evidence directory | **NOT CREATED**; create only in an authorized session outside the release archive |

For future evidence, record only timestamp, checkpoint id, target build/version, redacted actor
role, HTTP/MCP status, and stable redacted evidence tokens. A token must be either a redacted suffix
or a one-way evidence hash. Store only the token plus a non-identifying container category such as
`hr-miniapp/<redacted>`, `Quản lí Email`, `payroll_records`, or a generic List/file category.

Never record a full tenant, Room, user, object, file, List, item, history, payroll-record, session,
message, or provider identifier. Never record a filename or path segment containing a person,
contact value, or other HR identifier. This prohibition applies equally to results, screenshots,
logs, matrix evidence, provider evidence, pilot records, rollback records, and cleanup records.
Exact identifiers may be compared transiently inside the authorized live session, but they must not
be copied into stored evidence. Reuse the same redacted suffix/token or one-way hash to demonstrate
object equality across downstream readback, reload, rollback, and reinstall. Crop or redact every
screenshot/log before retaining it. Also never record tokens, pairing URLs, identity files, email
addresses, names, document bodies, CV content, payroll values, provider payloads, or real HR data.
A row is `PASS` only when the stated live action and its independent downstream check both pass in
the same target environment. Unit tests, fakes, build output, or UI success alone cannot upgrade a
live row.

Status vocabulary:

- `LOCAL PASS`: deterministic local static gate passed; not live acceptance.
- `NOT RUN`: action was not executed.
- `PASS` / `FAIL`: reserved for explicitly authorized live evidence.

## Development Relay, resource, approval, and installation

All ten checkpoints are separate; none may be collapsed into a generic “app works” result.

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| R01 | Application process starts | **NOT RUN** | None | Local-only authorization prohibits starting a real Relay acceptance process. |
| R02 | Vite starts on port 5179 | **NOT RUN** | None | No Relay/Vite acceptance session was started. |
| R03 | OAuth token succeeds | **NOT RUN** | None | OAuth and credential use are prohibited. |
| R04 | Relay WebSocket connects | **NOT RUN** | None | No network or Relay call was allowed. |
| R05 | MCP `initialize` succeeds | **NOT RUN** | None | Requires the live Relay session. |
| R06 | `tools/list` returns exactly seven manifest tools | **NOT RUN** | None | Local parity tests are not a live Relay response. |
| R07 | Dashboard `tools/call` returns the UI resource | **NOT RUN** | None | No live MCP dispatch was allowed. |
| R08 | `resources/read` returns `text/html;profile=mcp-app` | **NOT RUN** | None | No live resource read was allowed. |
| R09 | Iframe HTML, JS, CSS, and icon assets load | **NOT RUN** | None | Local build output is not host iframe evidence. |
| R10 | Version 2.0.0 is approved and installed in the throwaway Room | **NOT RUN** | None | Registration, approval, and installation are prohibited external actions. |

## Production liveness, readiness, and manifest

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| P01 | `GET /health` returns 200 | **NOT RUN** | None | Managed/standalone production was not started. |
| P02 | `GET /ready` returns 200 only after identity and trust are active | **NOT RUN** | None | Identity and live transport were not authorized. |
| P03 | `GET /.well-known/mcp/manifest.json` equals the canonical manifest projection | **NOT RUN** | None | No production endpoint request was allowed. |

## Nine current business surfaces

Each downstream column must be checked independently from the visible UI action.

| ID | Surface and live interaction | Required downstream verification | Status | Evidence | Notes |
|---|---|---|---|---|---|
| B01 | Company: load the Room company context | Expected test-only files are read from the same non-identifying container; equality is stored only as reused redacted file tokens | **NOT RUN** | None | Folder-scoped target behavior is not live verified. |
| B02 | Email: send one tracked test message | Provider outcome and the `Quản lí Email` redacted item token/stage are verified separately | **NOT RUN** | None | EmailJS and Room writes were prohibited. |
| B03 | Tuyển dụng: save one synthetic JD | Markdown file exists in container category `hr-miniapp/<redacted>`; store only its redacted file token | **NOT RUN** | None | Real Room file/folder persistence was prohibited. |
| B04 | CV Pipeline: process one synthetic CV | Redacted List/item/file tokens and stage state are verified in the Room; full identifiers are transient only | **NOT RUN** | None | Generation and stage contracts remain unverified live. |
| B05 | CV đã chấm: open one scored CV and send its test email | Redacted CV-item and history tokens link the metadata and tracked-email outcome | **NOT RUN** | None | No Room or EmailJS call was allowed. |
| B06 | Chỉnh sửa JD: edit and save one synthetic JD | The persisted Markdown is read back transiently from the object represented by the same redacted token | **NOT RUN** | None | No Room write/readback was allowed. |
| B07 | Hồ sơ NS: create one synthetic employee profile/document link | Reused employee List category and redacted item/file tokens prove persistence without List recreation | **NOT RUN** | None | No real employee data may be used. |
| B08 | Quản lý Lương: Owner performs an authorized synthetic record operation | `payroll_records` contains the Room-scoped record represented by a redacted token and Member access is denied | **NOT RUN** | None | Production payroll remains deny-all pending a proven live Owner adapter. |
| B09 | Bot soạn thảo: generate and persist one synthetic document | A redacted file token in a non-identifying container category proves readback after completion | **NOT RUN** | None | AI generation and Room persistence were prohibited. |

## Persistence after iframe reload

| ID | Persisted object | Status | Evidence | Notes |
|---|---|---|---|---|
| L01 | Saved JD reuses its pre-reload redacted file token and non-identifying container category | **NOT RUN** | None | Exact identifier comparison is transient; requires live Room write and reload. |
| L02 | CV List item reuses its pre-reload redacted token and stage remains unchanged | **NOT RUN** | None | Requires live List/stage support. |
| L03 | Employee profile reuses its pre-reload redacted item token in the same List category | **NOT RUN** | None | No List recreation may be used as a repair. |
| L04 | Employee document link resolves transiently to the object represented by the same redacted file token | **NOT RUN** | None | Requires live file readback. |
| L05 | Email history reuses its redacted item token and retains the provider/status transition | **NOT RUN** | None | Provider and Room history are separate checks. |
| L06 | Payroll record reuses its redacted token in `payroll_records` | **NOT RUN** | None | Requires proven backend Owner authorization and complete DB behavior. |
| L07 | Drafted file reuses its redacted token and non-identifying container category | **NOT RUN** | None | Requires live generation and persistence. |

## Optional-permission degradation

Revoke one optional grant at a time, reload capabilities, and prove both the documented degraded
state and absence of forbidden transport/write calls. Required scopes are not revocation tests:
rejecting them must cancel installation.

| ID | Optional scope | Expected degradation | Status | Evidence | Notes |
|---|---|---|---|---|---|
| D01 | `lists:query` | Bounded non-query reads remain visible and disclose possible capping | **NOT RUN** | None | Live scope changes prohibited. |
| D02 | `lists:write` | Recruitment, CV, lifecycle, and email-history writes are disabled; reads remain | **NOT RUN** | None | Must prove no local-success id and no destructive List repair. |
| D03 | `files:read` | Existing document preview and Room file discovery are unavailable | **NOT RUN** | None | Must not render an empty successful dataset after a rejected load. |
| D04 | `files:write` | Upload, generated-document persistence, and payroll export upload are disabled | **NOT RUN** | None | Must prove zero rejected-write fallback success. |
| D05 | `sandbox:skills:use` | Skill-backed drafting and screening controls are hidden | **NOT RUN** | None | Live permission revocation prohibited. |
| D06 | `sandbox:botkey:push` | Bot-key connection actions are unavailable | **NOT RUN** | None | Live permission revocation prohibited. |
| D07 | `sandbox:wake` | Sandbox wake actions are unavailable | **NOT RUN** | None | Live permission revocation prohibited. |
| D08 | `sandbox:generate` | AI generation and polling actions are disabled | **NOT RUN** | None | Live permission revocation prohibited. |
| D09 | `sandbox:ai-chat` | Existing AI chat/session history is unavailable | **NOT RUN** | None | Live permission revocation prohibited. |
| D10 | `sandbox:ai-chat:write` | New AI chat/generation actions are disabled | **NOT RUN** | None | `ai-messages.startGeneration` remains unsupported and mounted dependants disabled. |
| D11 | `db:read` | Payroll navigation/data is unavailable | **NOT RUN** | None | Backend Owner authorization remains independently required. |
| D12 | `db:write` | Payroll create/update/delete is unavailable | **NOT RUN** | None | Update/delete target contracts remain unverified. |
| D13 | `db:schema:read` | Payroll schema verification is unavailable | **NOT RUN** | None | No target schema read was performed. |
| D14 | `db:schema:write` | Payroll collection registration is unavailable | **NOT RUN** | None | Must not recreate or destructively repair the collection. |

## Payroll Owner, Member, and live revocation

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| A01 | Owner can open payroll after DB scopes and authoritative backend Owner proof | **NOT RUN** | None | No trusted live Owner adapter has passed; production remains deny-all. |
| A02 | Member cannot open payroll and direct tool calls are denied | **NOT RUN** | None | Requires a separate Member session and backend evidence. |
| A03 | Owner is downgraded/revoked from a second admin session while payroll is active | **NOT RUN** | None | External role mutation prohibited. |
| A04 | Navigation disappears, Home becomes active, payroll DOM unmounts | **NOT RUN** | None | Local integration test is not live host evidence. |
| A05 | All subsequent payroll query/create/update/delete calls are denied | **NOT RUN** | None | Requires live backend calls after revocation. |

## EmailJS delivery and Room history

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| E01 | Invitation EmailJS provider send succeeds | **NOT RUN** | None | Provider call and test recipient prohibited. |
| E02 | Invitation history item persists independently in `Quản lí Email` | **NOT RUN** | None | No Room write was allowed. |
| E03 | Lifecycle EmailJS provider send succeeds | **NOT RUN** | None | Provider call and test recipient prohibited. |
| E04 | Lifecycle history item persists independently in `Quản lí Email` | **NOT RUN** | None | No Room write was allowed. |
| E05 | Forced provider failure is recorded as a failed history state | **NOT RUN** | None | No controlled provider failure was authorized. |
| E06 | `hrm.mail.retry` transitions the history object represented by the same redacted token after a successful retry | **NOT RUN** | None | No provider retry or Room stage transition was allowed. |

## Platform call matrix completion

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| M01 | Target Hub build/version is captured | **NOT RUN** | None | Target is unknown. |
| M02 | Every retained browser operation has accepted request/response evidence linked only by redacted tokens/hashes | **NOT RUN** | None | All current live-result cells remain `NOT LIVE VERIFIED`. |
| M03 | Every retained server tool has accepted envelope/result evidence linked only by redacted tokens/hashes | **NOT RUN** | None | All current target-Hub evidence remains open. |
| M04 | DB pagination, maximum page, existing-schema, and evolution behavior are captured | **NOT RUN** | None | Required for complete payroll repository behavior. |
| M05 | Every unsupported mounted dependency is proven disabled or replaced by a documented contract | **NOT RUN** | None | Unsupported folder/stage/file mutation/batch/start-generation dependencies remain disabled. |

## Pilot, rollback, and reinstall

| ID | Checkpoint | Status | Evidence | Notes |
|---|---|---|---|---|
| C01 | Install 2.0.0 in one pilot HR Room and run the acceptance subset using redacted evidence tokens only | **NOT RUN** | None | Pilot/install prohibited. |
| C02 | Switch to the previous app version and verify stored redacted List/file/DB tokens still resolve transiently | **NOT RUN** | None | Rollback prohibited; full identifiers/paths are never stored. |
| C03 | Reinstall 2.0.0 and verify the same redacted tokens resolve transiently to the same objects | **NOT RUN** | None | Reinstall prohibited; full identifiers remain session-only. |

## Deterministic local gates

These results prove only the current local source/build contracts.

| ID | Gate | Status | Evidence | Notes |
|---|---|---|---|---|
| S01 | `npm.cmd run verify:fast-pr` | **LOCAL PASS** | Exit 0 on 2026-08-30 | Aggregate gate below. |
| S02 | Strict unused/typecheck | **LOCAL PASS** | 0 diagnostics | Executed inside `verify:fast-pr`. |
| S03 | Vitest | **LOCAL PASS** | 39 files / 299 tests passed; 1 live payroll file/test skipped | The skipped test remains live-only. |
| S04 | Production build | **LOCAL PASS** | Vite 5.4.21; 2,713 modules transformed | Advisory: one minified chunk exceeds 500 kB. |
| S05 | Manifest lint | **LOCAL PASS** | Valid; zero errors | Executed by `npm run build`; no separate rerun needed. |
| S06 | Canonical manifest hash | **LOCAL PASS** | `sha256:e57484719810e846d92cc33fff327316e7d258f573cc6d5cafd3d609db78b979` | Static canonical manifest only. |
| S07 | Publisher permission declaration hash | **LOCAL PASS** | `sha256:028a525bdd70763c3bec5870a6e581149ad044332cca12444daa205495285806` | Static permission declaration only. |
| S08 | Preflight | **LOCAL PASS** | `hr-miniapp-release/2026-08-30`; “Preflight passed.” | Does not execute the publisher archive, Docker, or external acceptance. |

## Final command set

| Command | Status | Notes |
|---|---|---|
| `npm.cmd ci` | **NOT RUN** | Installation/registry behavior was outside the permitted deterministic command set. |
| `npm.cmd run typecheck:strict-unused` | **LOCAL PASS** | Executed as a child of `verify:fast-pr`. |
| `npm.cmd test` | **LOCAL PASS** | Executed as a child of `verify:fast-pr`; live payroll test skipped. |
| `npm.cmd run build` | **LOCAL PASS** | Executed as a child of `verify:fast-pr`. |
| `npm.cmd run manifest:lint` | **LOCAL PASS** | Executed inside the build script. |
| `npm.cmd run preflight` | **LOCAL PASS** | Executed as a child of `verify:fast-pr`. |
| `npm.cmd run docker:build` | **NOT RUN** | Docker build/inspect and possible registry access were prohibited. |
| `npm.cmd run pair` | **NOT RUN** | Pairing/resume and identity writes were prohibited. |
| `npm.cmd run publish:marketplace` | **NOT RUN** | Marketplace archive/publication was prohibited. |
| Git archive / publisher dry-run | **NOT RUN** | Current Git allowlist and local-only authorization prohibit it. |

## Completion gate

The migration is not complete. Local static gates are green, but they do not establish server
readiness, Relay transport, UI resource loading, registration, approval, Room installation,
trusted authorization, external delivery, downstream persistence, platform-call compatibility,
pilot safety, rollback, or reinstall behavior. The final verdict remains **BLOCKED / NOT COMPLETE**
until every live row above has authorized evidence and no mounted feature depends on an unverified
operation without an explicit disabled state.
