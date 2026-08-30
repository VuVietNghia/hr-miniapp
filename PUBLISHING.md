# Publishing HR Mini App 2.0.0

Publishing is an operator-controlled external action. Do not run these steps from an unreviewed or dirty release workspace.

## Local release gates

Run on Node 22 with the committed lockfile:

```powershell
npm.cmd run typecheck:strict-unused
npm.cmd test
npm.cmd run build
npm.cmd run manifest:lint
npm.cmd run preflight
npm.cmd pack --dry-run --json --ignore-scripts --offline
```

`preflight` validates the closed `.gitattributes export-ignore` policy used by the Marketplace source boundary. The npm pack dry-run is only a secondary standalone/npm-package sanity check over `package.json.files`; it is not Marketplace archive parity and is not the source uploaded by `privos-app publish`.

The installed Marketplace publisher creates a Git archive from the tracked revision and applies `.gitattributes export-ignore`. A real publisher archive dry-run therefore remains an explicitly authorized Task 14 action; do not substitute the npm inventory for that evidence. A Docker build is a separate gate and must not be run in an offline review unless the Node 22 base image is already present and pulling/network access is disabled.

## Marketplace submission

After local review and explicit authorization, use the installed SDK CLI:

```powershell
npm.cmd run publish:marketplace
```

The CLI packages the reviewed tracked source as a Git archive, performs its own manifest and policy checks, obtains a scoped Portal authorization, uploads a version, and submits it for review. Version, manifest identity, changelog, privacy, terms, scopes, Dockerfile, screenshots/listing copy, and HR external-processing disclosure must describe the same 2.0.0 release. Never put a publisher token in command arguments or logs.

Publication does not establish PrivOS registration, approval, Room installation, authorization, UI loading, or business persistence. Record those checkpoints separately in Task 14 acceptance evidence.

## Standalone pairing

`npm run pair` prompts for the one-time URL through standard input; the URL is never accepted from command arguments or logged. First run announces the canonical descriptor and exact schema-v3 manifest and persists only a non-dispatchable pending identity. After the Hub Owner approves the ceiling, run the same command again to resume and atomically persist the 0600 production identity. Verify the printed Hub fingerprint out of band before starting production.
