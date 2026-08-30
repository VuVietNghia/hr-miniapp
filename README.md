# HR Mini App V3

PrivOS Room-scoped HR application for Company, Email, recruitment, CV Pipeline, scored CVs, JD editing, employee lifecycle, payroll, and document drafting. Version 2.0.0 migrates the platform/runtime boundary while retaining the established HR contracts.

## Runtime modes

The installed SDK auto-detects exactly one mode:

- Development: no production identity is present. `npm run dev` uses the development Relay and optional Vite iframe/HMR transport. Its ignored `.env` cache is development-only.
- Managed production: the platform-mounted `PRIVOS_WORKLOAD_SOCKET` supplies workload identity and installation context.
- Standalone production: `npm run pair` registers the exact manifest; after Hub-owner approval, a second `npm run pair` resumes and persists the owner-only identity. `npm run start:standalone` then uses SDK Relay trust.

Managed identity and standalone identity together are a fatal configuration error. Production without either identity is fail-closed. Development OAuth credentials are never production authorization. See [.env.example](.env.example) for names-only configuration.

## Local setup and verification

Use Node 22 and the committed dependency graph. Installing dependencies may access a registry and is therefore an explicit operator action.

```powershell
npm.cmd run typecheck:strict-unused
npm.cmd test
npm.cmd run build
npm.cmd run manifest:lint
npm.cmd run preflight
npm.cmd pack --dry-run --json --ignore-scripts
```

`npm run verify:fast-pr` runs the first four release gates plus preflight. Live opt-in tests, pairing, Marketplace publishing, PrivOS registration, Room calls, EmailJS delivery, and Docker pulls are not part of local verification.

## Health, readiness, and manifest

Managed and standalone runtime surfaces expose:

- `GET /health`: process liveness.
- `GET /ready`: 200 only when runtime identity/trust and the active transport are ready; otherwise fail closed.
- `GET /.well-known/mcp/manifest.json`: canonical `createManifest()` projection of `privos-app.json`.

The production-without-identity fallback exposes the manifest and liveness only; readiness is 503 and no MCP tool surface is admitted.

## Packaging and container

Marketplace publishing uses a Git archive from the tracked revision. Preflight validates the exact closed `.gitattributes export-ignore` policy for that archive without executing Git archive. The separate `package.json.files` inventory is only a secondary npm/standalone package sanity check; it is not Marketplace archive parity. Both checks reject environment, credential, standalone identity, dependency, build-output, test, archive, and local-artifact paths without opening denied files.

The Node 22 multi-stage image runs as `node`, contains production dependencies and minimum runtime inputs, and supports the hardened `npm run docker:run` flags: read-only root, all capabilities dropped, no-new-privileges, PID limit, and `/tmp` tmpfs. `npm run docker:build` canonicalizes the actual manifest, supplies both image labels, and verifies their readback. Do not run it offline unless the Node 22 base image is already cached and pulling/network access is disabled.

## Authorization and data

PrivOS permission grants drive feature availability; trusted backend services remain the authorization boundary. Payroll is deliberately deny-all in production until the Task 8 live Owner adapter is proven. Unsupported persistence/generation/stage routes remain disabled rather than reporting local success.

See [SCOPES.md](SCOPES.md), [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md), and [PUBLISHING.md](PUBLISHING.md). Real registration, approval, Room installation, Owner/Member behavior, EmailJS/history outcomes, persistence after reload, pilot, and rollback are Task 14 acceptance checkpoints and must not be inferred from local tests.
