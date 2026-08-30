import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { lintManifest } from '@privos_ai/app-server/manifest-tools';

import { HR_TOOL_DEFINITIONS } from '../src/mcp/tool-definitions';

export const PREFLIGHT_RULESET = 'hr-miniapp-release/2026-08-30';

export const REQUIRED_PACKAGE_ENTRIES = Object.freeze([
  'src',
  '!src/ui/scratch-test.ts',
  '!src/ui/test-docx-gen.ts',
  '!src/ui/test-upload-md.ts',
  'scripts/generate-manifest.ts',
  'scripts/build-docker.ts',
  'scripts/pair.ts',
  'scripts/preflight.ts',
  'public',
  'privos-app.json',
  'SCOPES.md',
  'Dockerfile',
  '.dockerignore',
  'README.md',
  'PUBLISHING.md',
  'PRIVACY.md',
  'TERMS.md',
  'CHANGELOG.md',
] as const);

export const REQUIRED_PACKAGE_EXCLUSIONS = Object.freeze([
  'src/ui/scratch-test.ts',
  'src/ui/test-docx-gen.ts',
  'src/ui/test-upload-md.ts',
] as const);

export const REQUIRED_SOURCE_ROOT_ENTRIES = Object.freeze([
  'package.json',
  'package-lock.json',
] as const);

export const REQUIRED_MARKETPLACE_EXPORT_IGNORES = Object.freeze([
  '/.env.example',
  '/.agents',
  '/.codex',
  '/.superpowers',
  '/.test-outputs',
  '/docs/superpowers',
  '/docs/**/*.png',
  '/docs/**/*.jpg',
  '/docs/**/*.jpeg',
  '/docs/**/*.webp',
  '/tests',
  '/privos-standalone-identity*.json',
  '/.env*',
  '/*.pem',
  '/*.key',
  '/*.p12',
  '/*.pfx',
  '/dist-source',
  '/src/ui/scratch-test.ts',
  '/src/ui/test-docx-gen.ts',
  '/src/ui/test-upload-md.ts',
  '/CLAUDE.md',
  '/AGENTS.md',
  '/tools_files',
] as const);

const REQUIRED_EMAILJS_KEYS = Object.freeze([
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
] as const);

export interface PreflightFailure {
  message: string;
  fix: string;
}

export interface PreflightSnapshot {
  packageName: string;
  packageVersion: string;
  packageIdentityMatches: boolean;
  lockRootVersions: readonly string[];
  manifestName: string;
  manifestVersion: string;
  schemaVersion: number;
  manifestKind: string;
  manifestLintErrors: readonly string[];
  localPackageLinks: readonly string[];
  manifestScopes: readonly string[];
  documentedScopes: readonly string[];
  manifestToolNames: readonly string[];
  runtimeToolNames: readonly string[];
  emailJsEnvironmentKeys: readonly string[];
  externalProcessing: boolean;
  manifestEndpointMatches: boolean;
  dockerInputsPresent: boolean;
  marketplaceArchivePolicy: Readonly<{
    declaredExportIgnores: readonly string[];
  }>;
  npmPackageInventoryChecks: Readonly<{
    allowlistMatches: boolean;
    entries: readonly string[];
  }>;
  changelogVersions: readonly string[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonRecord(filePath: string): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!isRecord(parsed)) throw new Error(`${path.basename(filePath)} must contain a JSON object`);
  return parsed;
}

function readString(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(record: Readonly<Record<string, unknown>>, key: string): number {
  const value = record[key];
  return typeof value === 'number' ? value : Number.NaN;
}

function readStringArray(record: Readonly<Record<string, unknown>>, key: string): readonly string[] {
  const value = record[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : [];
}

function normalizePackagePath(candidate: string): string {
  return candidate.split('\\').join('/').replace(/^\.\//, '').toLowerCase();
}

export function parseMarketplaceExportIgnores(source: string): readonly string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.match(/^(\S+)\s+export-ignore$/)?.[1])
    .filter((pattern): pattern is string => pattern !== undefined);
}

function marketplacePatternMatches(pattern: string, candidate: string): boolean {
  const normalizedPattern = normalizePackagePath(pattern).replace(/^\//, '');
  const normalizedCandidate = normalizePackagePath(candidate).replace(/^\//, '');
  if (!normalizedPattern.includes('*')) {
    return normalizedCandidate === normalizedPattern
      || normalizedCandidate.startsWith(`${normalizedPattern}/`);
  }

  let expression = '';
  for (let index = 0; index < normalizedPattern.length;) {
    const character = normalizedPattern[index];
    if (character === '*' && normalizedPattern[index + 1] === '*') {
      if (normalizedPattern[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 3;
      } else {
        expression += '.*';
        index += 2;
      }
      continue;
    }
    if (character === '*') {
      expression += '[^/]*';
      index += 1;
      continue;
    }
    expression += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    index += 1;
  }
  return new RegExp(`^${expression}$`).test(normalizedCandidate);
}

export function filterMarketplaceArchiveEntries(
  entries: readonly string[],
  exportIgnorePatterns: readonly string[],
): readonly string[] {
  return entries.filter((entry) => !exportIgnorePatterns.some(
    (pattern) => marketplacePatternMatches(pattern, entry),
  ));
}

export function isDeniedPackagePath(candidate: string): boolean {
  const normalized = normalizePackagePath(candidate);
  const segments = normalized.split('/').filter(Boolean);
  const baseName = segments.length === 0 ? '' : segments[segments.length - 1];
  if (segments.some((segment) => [
    '.git',
    '.superpowers',
    '.test-outputs',
    'node_modules',
    'dist',
    'dist-source',
    'coverage',
    'tests',
    'credentials',
    '.credentials',
  ].includes(segment))) return true;
  if (baseName.startsWith('.env')) return true;
  if (/^privos-standalone-identity.*\.json$/.test(baseName)) return true;
  if (/^(?:credential|credentials)(?:\.[^.]+)?$/.test(baseName)) return true;
  return /\.(?:pem|key|p12|pfx|zip|tgz|tar|gz)$/.test(baseName);
}

function listExplicitEntry(repositoryRoot: string, relativeEntry: string): string[] {
  const absolute = path.resolve(repositoryRoot, relativeEntry);
  const relative = path.relative(repositoryRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Package input escapes the repository: ${relativeEntry}`);
  }
  if (!fs.existsSync(absolute)) return [];
  const metadata = fs.statSync(absolute);
  if (metadata.isFile()) return [relativeEntry.split('\\').join('/')];
  if (!metadata.isDirectory()) return [];

  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files.push(path.relative(repositoryRoot, child).split('\\').join('/'));
    }
  };
  visit(absolute);
  return files;
}

function collectExplicitPackageEntries(
  repositoryRoot: string,
  allowlist: readonly string[],
): readonly string[] {
  const exclusions = allowlist
    .filter((entry) => entry.startsWith('!'))
    .map((entry) => entry.slice(1));
  return [
    ...REQUIRED_SOURCE_ROOT_ENTRIES,
    ...allowlist
      .filter((entry) => !entry.startsWith('!'))
      .flatMap((entry) => listExplicitEntry(repositoryRoot, entry)),
  ]
    .filter((entry) => !exclusions.includes(entry))
    .sort((left, right) => left.localeCompare(right));
}

function manifestRows(record: Readonly<Record<string, unknown>>, key: string): readonly Readonly<Record<string, unknown>>[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function repositoryUrl(packageJson: Readonly<Record<string, unknown>>): string {
  const repository = packageJson.repository;
  return isRecord(repository) ? readString(repository, 'url') : '';
}

function localLinks(
  packageJson: Readonly<Record<string, unknown>>,
  lockJson: Readonly<Record<string, unknown>>,
): readonly string[] {
  const links = new Set<string>();
  for (const dependencyKey of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const dependencies = packageJson[dependencyKey];
    if (!isRecord(dependencies)) continue;
    for (const value of Object.values(dependencies)) {
      if (typeof value === 'string' && /^(?:file:|link:|\.\.?[\\/])/.test(value)) links.add(value);
    }
  }
  const packages = lockJson.packages;
  if (isRecord(packages)) {
    for (const [entry, metadata] of Object.entries(packages)) {
      if (entry.startsWith('../')) links.add(entry);
      if (isRecord(metadata)) {
        const resolved = metadata.resolved;
        if (typeof resolved === 'string' && /^(?:file:|link:|\.\.?[\\/])/.test(resolved)) links.add(resolved);
      }
    }
  }
  return [...links].sort();
}

export function collectPreflightSnapshot(repositoryRoot: string): PreflightSnapshot {
  const packageJson = readJsonRecord(path.join(repositoryRoot, 'package.json'));
  const lockJson = readJsonRecord(path.join(repositoryRoot, 'package-lock.json'));
  const manifest = readJsonRecord(path.join(repositoryRoot, 'privos-app.json'));
  const packageAllowlist = readStringArray(packageJson, 'files');
  const packageExclusions = packageAllowlist
    .filter((entry) => entry.startsWith('!'))
    .map((entry) => entry.slice(1));
  const packageEntries = collectExplicitPackageEntries(repositoryRoot, packageAllowlist);
  const declaredExportIgnores = parseMarketplaceExportIgnores(
    fs.readFileSync(path.join(repositoryRoot, '.gitattributes'), 'utf8'),
  );
  const lint = lintManifest(manifest);

  const lockPackages = lockJson.packages;
  const lockRoot = isRecord(lockPackages) && isRecord(lockPackages[''])
    ? lockPackages['']
    : {};
  const lockRootVersions = [readString(lockJson, 'version'), readString(lockRoot, 'version')];
  const permissions = manifestRows(manifest, 'permissions');
  const tools = manifestRows(manifest, 'tools');
  const environmentDeclarations = manifestRows(manifest, 'env');
  const dataPolicy = isRecord(manifest.dataPolicy) ? manifest.dataPolicy : {};

  const scopesDocument = fs.readFileSync(path.join(repositoryRoot, 'SCOPES.md'), 'utf8');
  const changelog = fs.existsSync(path.join(repositoryRoot, 'CHANGELOG.md'))
    ? fs.readFileSync(path.join(repositoryRoot, 'CHANGELOG.md'), 'utf8')
    : '';
  const runtimeSource = fs.readFileSync(
    path.join(repositoryRoot, 'src/runtime/start-privos-runtime.ts'),
    'utf8',
  );
  const dockerfilePath = path.join(repositoryRoot, readString(packageJson, 'dockerfilePath'));
  const dockerfile = fs.existsSync(dockerfilePath) ? fs.readFileSync(dockerfilePath, 'utf8') : '';
  const packageScripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};

  const packageName = readString(packageJson, 'name');
  const packageVersion = readString(packageJson, 'version');
  const manifestName = readString(manifest, 'name');
  const manifestVersion = readString(manifest, 'version');
  const packageIdentityMatches = packageName === manifestName
    && packageVersion === manifestVersion
    && readString(packageJson, 'title') === readString(manifest, 'title')
    && readString(packageJson, 'description') === readString(manifest, 'description')
    && repositoryUrl(packageJson) === readString(manifest, 'repository');

  return {
    packageName,
    packageVersion,
    packageIdentityMatches,
    lockRootVersions,
    manifestName,
    manifestVersion,
    schemaVersion: readNumber(manifest, 'schemaVersion'),
    manifestKind: readString(manifest, 'kind'),
    manifestLintErrors: lint.errors,
    localPackageLinks: localLinks(packageJson, lockJson),
    manifestScopes: permissions.map((permission) => readString(permission, 'scope')),
    documentedScopes: permissions
      .map((permission) => readString(permission, 'scope'))
      .filter((scope) => scopesDocument.includes(`\`${scope}\``)),
    manifestToolNames: tools.map((tool) => readString(tool, 'name')),
    runtimeToolNames: HR_TOOL_DEFINITIONS.map((tool) => tool.name),
    emailJsEnvironmentKeys: environmentDeclarations
      .map((declaration) => readString(declaration, 'key'))
      .filter((key) => key.startsWith('EMAILJS_')),
    externalProcessing: dataPolicy.externalProcessing === true,
    manifestEndpointMatches: runtimeSource.includes("app.get('/.well-known/mcp/manifest.json'")
      && runtimeSource.includes('response.json(createManifest())'),
    dockerInputsPresent: [
      'package.json',
      'package-lock.json',
      'privos-app.json',
      'scripts/build-docker.ts',
      'src/server.ts',
      '.dockerignore',
      'Dockerfile',
    ].every((entry) => fs.existsSync(path.join(repositoryRoot, entry)))
      && dockerfile.includes('COPY package.json package-lock.json ./')
      && dockerfile.includes('COPY src ./src')
      && dockerfile.includes('test -n "${PRIVOS_MCP_MANIFEST_JSON}"')
      && dockerfile.includes('test -n "${PRIVOS_MCP_MANIFEST_DIGEST}"')
      && readString(packageScripts, 'docker:build') === 'tsx scripts/build-docker.ts'
      && !/COPY\s+\.\s+\./.test(dockerfile),
    marketplaceArchivePolicy: { declaredExportIgnores },
    npmPackageInventoryChecks: {
      allowlistMatches: JSON.stringify(packageAllowlist) === JSON.stringify(REQUIRED_PACKAGE_ENTRIES)
        && JSON.stringify(packageExclusions) === JSON.stringify(REQUIRED_PACKAGE_EXCLUSIONS),
      entries: packageEntries,
    },
    changelogVersions: [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((match) => match[1]),
  };
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validatePreflightSnapshot(snapshot: PreflightSnapshot): readonly PreflightFailure[] {
  const failures: PreflightFailure[] = [];
  const fail = (message: string, fix: string): void => { failures.push({ message, fix }); };

  if (!snapshot.packageIdentityMatches || snapshot.packageName !== snapshot.manifestName) {
    fail('Manifest and package identity fields differ.', 'Synchronize name, version, title, description, and repository in package.json and privos-app.json.');
  }
  if (snapshot.packageVersion !== snapshot.manifestVersion
    || snapshot.lockRootVersions.some((version) => version !== snapshot.packageVersion)) {
    fail('Manifest, package, and lockfile root versions differ.', 'Set every root version to 2.0.0 and update only lockfile root metadata.');
  }
  if (snapshot.schemaVersion !== 3 || snapshot.manifestKind !== 'mcp-app') {
    fail('Publisher manifest is not schema v3 MCP App.', 'Set schemaVersion to 3 and kind to mcp-app.');
  }
  for (const error of snapshot.manifestLintErrors) {
    fail(`Manifest lint: ${error}`, 'Run npm run manifest:lint and correct privos-app.json.');
  }
  if (snapshot.localPackageLinks.length > 0) {
    fail(`Local package links found: ${snapshot.localPackageLinks.join(', ')}`, 'Use published dependency versions only.');
  }
  if (!sameValues(snapshot.manifestScopes, snapshot.documentedScopes)) {
    fail('One or more manifest permissions are missing from SCOPES.md.', 'Document every exact manifest scope in SCOPES.md.');
  }
  if (!sameValues(snapshot.manifestToolNames, snapshot.runtimeToolNames)) {
    fail('Manifest tools differ from runtime tool definitions.', 'Make HR_TOOL_DEFINITIONS exactly match privos-app.json tool order and names.');
  }
  if (!sameValues(snapshot.emailJsEnvironmentKeys, REQUIRED_EMAILJS_KEYS) || !snapshot.externalProcessing) {
    fail('EmailJS processing declarations are incomplete.', 'Declare all four EMAILJS keys and dataPolicy.externalProcessing=true.');
  }
  if (!snapshot.manifestEndpointMatches) {
    fail('Runtime manifest endpoint is not canonical.', 'Serve createManifest() at /.well-known/mcp/manifest.json.');
  }
  if (!snapshot.dockerInputsPresent) {
    fail('Docker build inputs or explicit COPY policy are incomplete.', 'Restore Dockerfile, lockfile, manifest, server source, and explicit COPY instructions.');
  }
  if (!sameValues(
    snapshot.marketplaceArchivePolicy.declaredExportIgnores,
    REQUIRED_MARKETPLACE_EXPORT_IGNORES,
  )) {
    fail('Marketplace Git archive export-ignore policy differs from the reviewed closed list.', 'Restore every exact REQUIRED_MARKETPLACE_EXPORT_IGNORES rule in .gitattributes; npm package files are not Marketplace archive policy.');
  }
  if (!snapshot.npmPackageInventoryChecks.allowlistMatches) {
    fail('npm package.json files is not the reviewed secondary package allowlist.', 'Restore the exact REQUIRED_PACKAGE_ENTRIES list; this is a secondary npm-package check, not Marketplace archive parity.');
  }
  const deniedEntries = snapshot.npmPackageInventoryChecks.entries.filter(isDeniedPackagePath);
  if (deniedEntries.length > 0) {
    fail(`Denied source-package paths found: ${deniedEntries.join(', ')}`, 'Remove env, identity, credential, dependency, build, archive, test, and local-output paths from package inputs.');
  }
  for (const required of [
    ...REQUIRED_SOURCE_ROOT_ENTRIES,
    'privos-app.json',
    'Dockerfile',
    'src/server.ts',
  ]) {
    if (!snapshot.npmPackageInventoryChecks.entries.includes(required)) {
      fail(`Required package entry is missing: ${required}`, `Add ${required} to the reviewed package inputs.`);
    }
  }
  if (!snapshot.changelogVersions.includes(snapshot.packageVersion)) {
    fail(`CHANGELOG.md has no ${snapshot.packageVersion} release.`, `Add a ## [${snapshot.packageVersion}] release entry.`);
  }
  return failures;
}

async function main(): Promise<void> {
  console.log(`PrivOS HR Mini App preflight (${PREFLIGHT_RULESET})`);
  const failures = validatePreflightSnapshot(collectPreflightSnapshot(process.cwd()));
  if (failures.length > 0) {
    console.error(`Preflight failed (${failures.length}):`);
    for (const failure of failures) {
      console.error(`- ${failure.message}\n  Fix: ${failure.fix}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Preflight passed.');
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  void main().catch(() => {
    console.error('Preflight crashed before completion. Fix malformed release inputs and rerun.');
    process.exitCode = 1;
  });
}
