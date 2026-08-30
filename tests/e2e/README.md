# Task 14 PrivOS acceptance operator runbook

Use this runbook only in a new session where the user has explicitly authorized external PrivOS,
EmailJS, Docker, publication/pilot, rollback, and cleanup actions. The current local-only session did
not execute any step in this file. Record results in
[`docs/migration/acceptance-results.md`](../../docs/migration/acceptance-results.md); do not replace
its `NOT RUN` rows without contemporaneous live evidence.

## Pass/fail and evidence policy

A checkpoint passes only when its exact action and downstream assertion both succeed against the
same target Hub build and throwaway Room. UI output, unit tests, mocks, build output, OAuth success,
or Relay connectivity cannot stand in for another checkpoint. Stop and mark `FAIL` on an unexpected
response, partial write, local fallback id, destructive repair, ambiguous actor/Room, or missing
downstream object. Do not continue a workflow after a failed precondition because that can create
partial HR records.

For each checkpoint record:

- timestamp and acceptance checkpoint id;
- target Hub build/version and app version;
- runtime mode and redacted actor role (`Owner` or `Member`);
- a stable redacted suffix or one-way evidence hash for each referenced container/object, a
  non-identifying container category such as `hr-miniapp/<redacted>`, `Quản lí Email`,
  `payroll_records`, or generic List/file category, and the status code;
- a redacted screenshot/log reference and the downstream verification result.

Never record a full tenant, Room, user, object, file, List, item, history, payroll-record, session,
message, or provider identifier. Never record a filename or path segment containing a person,
contact value, or other HR identifier. This applies to results, screenshots, logs, matrix entries,
provider evidence, pilot/rollback records, and cleanup records. Exact identifiers may be compared
transiently in the authorized live session, but must never be copied to stored evidence. Reuse the
same redacted suffix/token or one-way hash to prove equality after readback, reload, rollback, and
reinstall. Crop or redact every retained screenshot/log.

Also never record secrets, OAuth/pairing URLs, standalone identities, provider payloads, email
addresses, names, document/CV bodies, payroll numbers, or real HR data. Store evidence outside the
repository/release archive. Use synthetic test documents and a test-only recipient; never use real
employee, applicant, payroll, company-confidential, or contact data.

## 1. Obtain explicit authority and freeze the target

Before executing anything, document the user's authorization for every intended external action:
tenant/Room creation, two test users, Relay/OAuth, pairing or managed deployment, registration,
approval, install, target Hub tool calls, EmailJS failure injection, Docker, pilot, rollback,
reinstall, publication/archive inspection, and cleanup.

Record without secrets:

- target Hub build/version;
- release `2.0.0` and app id `ai.privos.demo-hr-management-ws`;
- selected managed or standalone production path;
- previous app version used for rollback;
- approval and pilot owner;
- cleanup owner and retention deadline.

If the target Hub version is unknown, production payroll still uses the deny-all policy, or a
mounted workflow depends on an unsupported folder, stage-movement, file-mutation, batch,
`ai-messages.startGeneration`, or DB update/delete contract, stop. Obtain and review the exact
target contract first, or prove the dependent control is disabled. A disabled control cannot satisfy
a required business-surface interaction.

## 2. Prepare the isolated acceptance environment

Create a new throwaway tenant and one throwaway Room. Create exactly two dedicated test identities:
one Room Owner and one ordinary Member. Keep separate browser profiles/sessions so evidence cannot
inherit the other actor's privileges.

Prepare only synthetic fixtures:

- company context Markdown with non-sensitive placeholder facts;
- one synthetic JD Markdown file;
- one synthetic CV with fictitious person/contact values;
- one synthetic employee profile and document;
- one synthetic payroll record with unmistakably fake values;
- one drafting request; and
- one test-only EmailJS recipient controlled by the operator.

Record a fixture-category hash and generic filename category only, never the full filename or any
path segment containing a person/contact/HR identifier. Do not copy production Lists, files,
database records, identities, credentials, or provider configuration into the throwaway Room.

## 3. Run release gates before external setup

Use Node 22 from the reviewed source. Installation and Docker commands require the separate authority
captured in step 1.

```powershell
npm.cmd ci
npm.cmd run typecheck:strict-unused
npm.cmd test
npm.cmd run build
npm.cmd run manifest:lint
npm.cmd run preflight
npm.cmd run docker:build
```

Require exit code 0 for every command, record test pass/skip counts and manifest hashes, and inspect
the built image label readback produced by `docker:build`. A skipped live test remains open. Do not
publish or install if any local gate fails.

## 4. Verify the development Relay as ten independent checkpoints

Start development from the reviewed source:

```powershell
npm.cmd run dev
```

Using the authorized development OAuth/Relay flow and the throwaway Room, record these separately and
in order:

1. `R01`: application process starts.
2. `R02`: Vite listens on 5179.
3. `R03`: OAuth token exchange succeeds; record status only.
4. `R04`: Relay WebSocket connects.
5. `R05`: MCP `initialize` succeeds.
6. `R06`: `tools/list` returns exactly the seven names in `privos-app.json`.
7. `R07`: `hr_management_dashboard` through `tools/call` returns
   `ui://demo-hr-management/form.html`.
8. `R08`: `resources/read` returns MIME `text/html;profile=mcp-app`.
9. `R09`: iframe HTML, JS, CSS, and icon requests load without host/permission failure.
10. `R10`: the exact 2.0.0 app is registered, approved, and installed in the throwaway Room.

Keep OAuth, Relay, resource delivery, registration, approval, and Room installation evidence
separate. Stop the development process after the Relay checks; do not infer production readiness.

## 5. Verify production liveness, trust, and manifest

For standalone, perform the SDK's prompted two-run approval flow without putting a pairing URL in
arguments or logs:

```powershell
npm.cmd run pair
npm.cmd run pair
npm.cmd run start:standalone
```

The first and second pair commands are separated by Hub Owner approval. For managed mode, deploy the
reviewed image through the authorized workload process instead; do not also configure standalone
identity. Then enter the loopback base URI interactively and run:

```powershell
$acceptanceBaseUri = Read-Host 'Acceptance runtime base URI'
Invoke-WebRequest "$acceptanceBaseUri/health" -UseBasicParsing
Invoke-WebRequest "$acceptanceBaseUri/ready" -UseBasicParsing
Invoke-WebRequest "$acceptanceBaseUri/.well-known/mcp/manifest.json" -UseBasicParsing
```

Record `P01` health 200 separately. Record `P02` readiness 200 only after identity/manifest trust and
transport are active. For `P03`, compare the served JSON with the canonical manifest projection;
path availability alone is insufficient. Do not expose identity file contents.

## 6. Verify installation and authorization boundaries

From the Owner session, open the installed Room app. From the Member session, open the same Room.
Compare the Room and actor identifiers transiently to confirm both sessions bind to the same Room
but different verified actors. Store only stable redacted Room/user tokens; never use
caller-supplied room/user/role fields as proof.

Before payroll business testing, verify the backend has the reviewed target-specific authoritative
Owner adapter. Then execute in order:

1. `A01`: Owner sees payroll only with the required DB grants and successful mediated Owner proof.
2. `A02`: Member cannot navigate to payroll and direct `hrm.payroll.*` calls are denied.
3. `A03`: while Owner payroll is mounted, use a second authorized admin session to downgrade/revoke
   that Owner role.
4. `A04`: payroll navigation disappears, Home becomes active, and payroll DOM unmounts.
5. `A05`: subsequent query/create/update/delete calls are rejected by the backend.

If production remains deny-all, record `FAIL`/blocked; do not replace it with a fake policy or UI
role evidence.

## 7. Exercise all nine business surfaces with downstream checks

Run each interaction once using only the fixtures from step 2. Record visible result and downstream
Room/provider result separately.

1. `B01` Company: load the synthetic company context, compare Room file identifiers transiently,
   and store only reused redacted file tokens plus a generic container category.
2. `B02` Email: send a tracked test email; verify provider delivery and `Quản lí Email`
   independently using redacted provider/history tokens only.
3. `B03` Tuyển dụng: save the synthetic JD; verify Markdown MIME and transient file readback under
   generic container `hr-miniapp/<redacted>`, storing only the redacted file token.
4. `B04` CV Pipeline: process the synthetic CV; verify List/item/file identifiers transiently and
   store redacted tokens plus the resulting non-identifying stage label/category.
5. `B05` CV đã chấm: open the scored item and send its test email; link metadata and history using
   only redacted item/history tokens.
6. `B06` Chỉnh sửa JD: edit/save the synthetic JD and transiently read back the object/content;
   store only the reused redacted object token.
7. `B07` Hồ sơ NS: create the synthetic employee profile and linked document; prove the employee
   List category was reused through redacted List/item/file tokens, never full identifiers.
8. `B08` Quản lý Lương: as Owner, perform the authorized synthetic record flow in
   `payroll_records`; confirm Room scoping and Member denial using redacted Room/record tokens.
9. `B09` Bot soạn thảo: generate/persist one synthetic document, compare its file identifier
   transiently, and store only a redacted file token plus generic container category.

An interaction fails if its downstream object cannot be found, the UI reports local success after a
rejected write, a load error becomes an empty successful view, or an existing List is deleted and
recreated.

## 8. Reload and verify persistence

Reload the iframe without changing Room or actor. Verify `L01` through `L07`: saved JD, CV item and
stage, employee profile, employee document link, email status, payroll record, and drafted file all
resolve transiently to their pre-reload objects and non-identifying container categories. Record
only the same redacted suffix/token or one-way hash used before reload. Read back persisted objects
through the normal mounted UI/platform path. A cached UI value without downstream readback is a
failure.

## 9. Revoke every optional permission separately

Restore the full grant set before each case, revoke only one scope, reload the app, and execute the
affected read/write control. Record `D01` through `D14` exactly as listed in the acceptance record:

- Lists: `lists:query`, then `lists:write`.
- Files: `files:read`, then `files:write`.
- Sandbox: `sandbox:skills:use`, `sandbox:botkey:push`, `sandbox:wake`, `sandbox:generate`,
  `sandbox:ai-chat`, then `sandbox:ai-chat:write`.
- Database: `db:read`, `db:write`, `db:schema:read`, then `db:schema:write`.

Require the precise degraded behavior from `SCOPES.md`, zero forbidden transport calls, no local
fallback success, no destructive repair, and no empty-success masking. Rejecting either required
scope (`basic:information` or `lists:read`) must cancel installation; do not treat it as an optional
degradation case.

## 10. Verify EmailJS and history as separate systems

Use only the test-only recipient and approved provider failure mechanism:

1. `E01`: invitation provider send succeeds.
2. `E02`: invitation history item/stage persists independently in `Quản lí Email`.
3. `E03`: lifecycle provider send succeeds.
4. `E04`: lifecycle history item/stage persists independently.
5. `E05`: force one provider failure and verify the same attempt is recorded failed.
6. `E06`: call `hrm.mail.retry` for that item and verify provider outcome plus transition on the
   object represented by the same redacted history token.

Do not record provider payloads, addresses, message content, or EmailJS keys. Provider success with
history failure, or history success with provider failure, is not an all-success outcome.

## 11. Complete the platform-call matrix

For every browser and server row in `docs/migration/platform-call-matrix.md`, record the target Hub
version, accepted request shape, response/envelope shape, redacted evidence token/hash, and live
result. Never copy full request/response identifiers or identifying filename/path segments into the
matrix. Also capture DB cursor/page limits, existing-collection behavior, schema evolution, and
index support.
No mounted feature may use a `NOT LIVE VERIFIED` or unsupported dependency unless its corresponding
control is visibly disabled and transport is zero-call. Do not change documentary fixture evidence;
append live evidence linked to this acceptance run.

## 12. Pilot, rollback, and reinstall

Only after all preceding rows pass, install 2.0.0 in the explicitly approved pilot HR Room. Run a
minimal synthetic subset covering all data stores. Compare identifiers transiently, then retain
only redacted tokens/hashes before changing versions.

Switch through the approved PrivOS operator interface to the recorded previous version. Do not
delete, migrate, rename, or repair Lists, files, stages, fields, or `payroll_records`. Compare exact
identifiers only inside the live session and use the same stored redacted tokens/hashes to prove the
objects remain intact. Reinstall 2.0.0 and repeat that transient comparison without copying full
identifiers or paths into evidence. If rollback requires an undocumented destructive step, stop and
mark `FAIL`; do not improvise.

## 13. Cleanup and completion decision

Cleanup is a separately authorized destructive phase. The operator must resolve exact throwaway
tenant/Room, test users, provider test messages, test objects, identities, images, and evidence
retention targets transiently at execution time before removal. Never copy those full identifiers,
filenames, or paths into cleanup evidence; store only their pre-established redacted tokens/hashes,
generic container categories, removal status, and whether recovery is possible. Prefer deleting the
entire throwaway environment through the approved operator control; never delete shared or
production data, and never use application “repair” behavior to clean Lists.

Declare migration complete only when all static gates, R/P/B/L/D/A/E/M/C rows, live matrix rows,
pilot, rollback, and reinstall pass with no unresolved mounted dependency. Otherwise retain
`BLOCKED / NOT COMPLETE` and list the exact failing checkpoint and required authority/contract.
