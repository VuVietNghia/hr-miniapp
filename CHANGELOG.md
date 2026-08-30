# Changelog

Every release must update `privos-app.json`, `package.json`, the lockfile root metadata, and this file together.

## [2.0.0] - 2026-08-30

- Migrated the runtime to registry `@privos_ai/app-server` and `@privos_ai/app-react` contracts with one injected application graph.
- Added canonical schema-v3 manifest/runtime parity, SDK-owned runtime and standalone pairing, fail-loud preflight, deterministic package policy, and hardened container/release documentation.
- Replaced legacy browser/server platform calls with typed Room clients and explicit fail-closed capability gates.
- Preserved the nine HR navigation surfaces, seven public tools, Room paths/List fields/stages/templates, payroll business DTO/calculation rules, and tracked-email mapping. No business or data migration is intended.
- Production payroll remains deny-all until a trusted live Owner authorization adapter passes acceptance. Other unverified Room operations remain visibly degraded and zero-call.
