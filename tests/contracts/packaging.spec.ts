import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import packageJson from '../../package.json';
import {
  createStandalonePairingRunner,
  type StandalonePairingDependencies,
} from '../../scripts/pair';
import {
  REQUIRED_PACKAGE_ENTRIES,
  REQUIRED_PACKAGE_EXCLUSIONS,
  isDeniedPackagePath,
} from '../../scripts/preflight';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('release package contract', () => {
  it('uses exact local release scripts and an explicit reviewed package allowlist', () => {
    expect(packageJson.version).toBe('2.0.0');
    expect(packageJson.scripts['verify:fast-pr']).toBe(
      'npm run typecheck:strict-unused && npm run test && npm run build && npm run preflight',
    );
    expect(packageJson.scripts['publish:marketplace']).toBe('privos-app publish');
    expect(packageJson.scripts['docker:build']).toBe('tsx scripts/build-docker.ts');
    expect(packageJson.scripts['docker:run']).toBe(
      'docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 100 --tmpfs /tmp -p 3000:3000 -e PORT=3000 privos-hr-miniapp:local',
    );

    expect(packageJson.files).toEqual(REQUIRED_PACKAGE_ENTRIES);
    expect(packageJson.files).not.toContain('.');
    expect(packageJson.files.filter((entry) => entry.startsWith('!')).map((entry) => entry.slice(1)))
      .toEqual(REQUIRED_PACKAGE_EXCLUSIONS);
  });

  it('denies secrets, identities, dependencies, builds, archives, and local artifacts by path only', () => {
    const denied = [
      '.env',
      '.env.backup',
      'privos-standalone-identity.json',
      'privos-standalone-identity.pending.json',
      'credentials/operator.json',
      'node_modules/pkg/index.js',
      'dist-source/app.zip',
      'coverage/report.json',
      '.test-outputs/results.txt',
      'archive/app.tgz',
    ];
    for (const candidate of denied) expect(isDeniedPackagePath(candidate)).toBe(true);
    expect(isDeniedPackagePath('src/server.ts')).toBe(false);
    expect(isDeniedPackagePath('privos-app.json')).toBe(false);
  });

  it('uses a hardened Node 22 multi-stage image and exact context exclusions', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile.match(/^FROM node:22-alpine AS /gm)).toHaveLength(2);
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).toContain('RUN npm run build && npm prune --omit=dev');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('EXPOSE 3000');
    expect(dockerfile).toContain('io.privos.mcp.manifest-digest');
    expect(dockerfile).toContain('test -n "${PRIVOS_MCP_MANIFEST_JSON}"');
    expect(dockerfile).toContain('test -n "${PRIVOS_MCP_MANIFEST_DIGEST}"');
    expect(dockerfile).not.toMatch(/COPY\s+\.\s+\./);

    const dockerignore = read('.dockerignore');
    for (const required of ['.git', 'node_modules', '.env*', 'privos-standalone-identity*.json', 'tests', 'docs', '.superpowers']) {
      expect(dockerignore.split(/\r?\n/)).toContain(required);
    }
    for (const localOnly of REQUIRED_PACKAGE_EXCLUSIONS) {
      expect(dockerignore.split(/\r?\n/)).toContain(localOnly);
    }
  });

  it('keeps reviewable migration docs while export-ignoring local and credential-like artifacts', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).not.toMatch(/^docs\/?$/m);
    expect(gitignore).toContain('!.env.example');
    expect(gitignore).toContain('privos-standalone-identity*.json');

    const attributes = read('.gitattributes');
    for (const denied of ['/.env.example export-ignore', '/.superpowers export-ignore', '/.test-outputs export-ignore', '/privos-standalone-identity*.json export-ignore']) {
      expect(attributes).toContain(denied);
    }
  });

  it('uses a prompt-only two-run pairing/resume flow without logging the URL', async () => {
    const pairUrl = 'wss://hub.invalid/pair?token=do-not-log';
    const logs: string[] = [];
    const pair = vi.fn<StandalonePairingDependencies['pair']>(async () => ({
      state: 'pending-approval' as const,
      pairingVersion: 2 as const,
      awaitingApproval: true as const,
    }));
    const resume = vi.fn(async () => ({
      state: 'complete' as const,
      pairingVersion: 2 as const,
      identityFilePath: '/private/privos-standalone-identity.json',
    }));
    const common = {
      descriptor: { id: 'app', name: 'app', version: '2.0.0', title: 'App', description: 'App' },
      manifest: { schemaVersion: 3, name: 'app', version: '2.0.0' },
      promptForPairingUrl: async () => pairUrl,
      pair,
      resume,
      verifyIdentityMode: vi.fn(async () => undefined),
      log: (message: string) => logs.push(message),
    };

    const first = createStandalonePairingRunner({
      ...common,
      pendingIdentityExists: () => false,
    });
    await first();
    expect(pair).toHaveBeenCalledTimes(1);
    expect(pair.mock.calls[0][1]).toMatchObject({
      name: 'App',
      version: '2.0.0',
      manifest: common.manifest,
    });
    expect(pair.mock.calls[0][2]).toMatchObject({ persistIdentityFile: true });
    expect(resume).not.toHaveBeenCalled();
    expect(JSON.stringify(logs)).not.toContain(pairUrl);

    const second = createStandalonePairingRunner({
      ...common,
      pendingIdentityExists: () => true,
    });
    await second();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(common.verifyIdentityMode).toHaveBeenCalledWith('/private/privos-standalone-identity.json');
  });
});
