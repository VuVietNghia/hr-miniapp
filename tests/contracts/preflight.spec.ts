import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  REQUIRED_MARKETPLACE_EXPORT_IGNORES,
  collectPreflightSnapshot,
  filterMarketplaceArchiveEntries,
  validatePreflightSnapshot,
  type PreflightSnapshot,
} from '../../scripts/preflight';

const root = path.resolve(import.meta.dirname, '../..');

describe('release preflight', () => {
  it('passes the actual explicit local package inputs without reading denied files', () => {
    const snapshot = collectPreflightSnapshot(root);
    expect(validatePreflightSnapshot(snapshot)).toEqual([]);
    expect(snapshot.marketplaceArchivePolicy.declaredExportIgnores)
      .toEqual(REQUIRED_MARKETPLACE_EXPORT_IGNORES);
    expect(snapshot.npmPackageInventoryChecks.entries).toContain('src/server.ts');
  });

  it('excludes every denied simulated publisher archive entry through the reviewed policy', () => {
    const snapshot = collectPreflightSnapshot(root);
    const simulatedPublisherEntries = [
      '.env.example',
      '.agents/session.json',
      '.codex/context.md',
      '.superpowers/plan.md',
      '.test-outputs/result.txt',
      'docs/superpowers/plan.md',
      'docs/screenshots/private.png',
      'tests/contracts/preflight.spec.ts',
      'privos-standalone-identity.json',
      '.env.backup',
      'operator.pem',
      'operator.key',
      'operator.p12',
      'operator.pfx',
      'dist-source/server.js',
      'src/ui/scratch-test.ts',
      'src/ui/test-docx-gen.ts',
      'src/ui/test-upload-md.ts',
      'CLAUDE.md',
      'AGENTS.md',
      'tools_files/context.md',
      'src/server.ts',
      'privos-app.json',
    ];

    expect(filterMarketplaceArchiveEntries(
      simulatedPublisherEntries,
      snapshot.marketplaceArchivePolicy.declaredExportIgnores,
    )).toEqual(['src/server.ts', 'privos-app.json']);
  });

  it('fails every gate loudly with an actionable fix', () => {
    const valid = collectPreflightSnapshot(root);
    const invalid: PreflightSnapshot = {
      ...valid,
      packageVersion: '9.9.9',
      lockRootVersions: ['2.0.0', '1.0.0'],
      manifestName: 'wrong.app',
      packageName: 'other.app',
      schemaVersion: 2,
      manifestLintErrors: ['bad manifest'],
      localPackageLinks: ['../private-sdk'],
      documentedScopes: [],
      runtimeToolNames: [],
      emailJsEnvironmentKeys: [],
      externalProcessing: false,
      manifestEndpointMatches: false,
      dockerInputsPresent: false,
      marketplaceArchivePolicy: { declaredExportIgnores: [] },
      npmPackageInventoryChecks: {
        allowlistMatches: false,
        entries: ['.env.backup'],
      },
      changelogVersions: [],
    };
    const failures = validatePreflightSnapshot(invalid);
    expect(failures.length).toBeGreaterThanOrEqual(12);
    for (const failure of failures) {
      expect(failure.message.trim()).not.toBe('');
      expect(failure.fix.trim()).not.toBe('');
    }
  });

  it('publishes the canonical manifest endpoint and all seven runtime tools', () => {
    const serverSource = fs.readFileSync(path.join(root, 'src/runtime/start-privos-runtime.ts'), 'utf8');
    expect(serverSource).toContain("app.get('/.well-known/mcp/manifest.json'");
    expect(serverSource).toContain('response.json(createManifest())');

    const snapshot = collectPreflightSnapshot(root);
    expect(snapshot.runtimeToolNames).toEqual(snapshot.manifestToolNames);
    expect(snapshot.manifestEndpointMatches).toBe(true);
  });
});
