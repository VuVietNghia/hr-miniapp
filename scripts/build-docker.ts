import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { canonicalJson, sha256CanonicalJson } from '@privos_ai/app-server';

const DEFAULT_IMAGE_TAG = 'privos-hr-miniapp:local';
const MANIFEST_LABEL = 'io.privos.mcp.manifest';
const MANIFEST_DIGEST_LABEL = 'io.privos.mcp.manifest-digest';

export interface DockerCommandInvocation {
  command: 'docker';
  args: readonly string[];
}

export type DockerCommandRunner = (invocation: DockerCommandInvocation) => Promise<string>;

export interface DockerBuildResult {
  imageTag: string;
  manifestDigest: string;
}

interface DockerBuildInput {
  manifest: unknown;
  imageTag: string;
  runCommand: DockerCommandRunner;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalManifestInput(manifest: unknown): Readonly<{
  manifestJson: string;
  manifestDigest: string;
}> {
  if (!isRecord(manifest) || Object.keys(manifest).length === 0) {
    throw new Error('Manifest input is empty');
  }
  const manifestJson = canonicalJson(manifest);
  const manifestDigest = sha256CanonicalJson(manifest);
  if (!manifestJson.trim() || !/^sha256:[a-f0-9]{64}$/.test(manifestDigest)) {
    throw new Error('Canonical manifest or digest is empty');
  }
  return { manifestJson, manifestDigest };
}

function parseImageLabels(output: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(output.trim());
    if (!isRecord(parsed)) throw new Error('labels are not an object');
    return parsed;
  } catch {
    throw new Error('Docker label inspection returned malformed JSON');
  }
}

export async function buildDockerImage(input: DockerBuildInput): Promise<DockerBuildResult> {
  const imageTag = input.imageTag.trim();
  if (!imageTag) throw new Error('Docker image tag is empty');
  const { manifestJson, manifestDigest } = canonicalManifestInput(input.manifest);

  await input.runCommand({
    command: 'docker',
    args: [
      'build',
      '--build-arg',
      `PRIVOS_MCP_MANIFEST_JSON=${manifestJson}`,
      '--build-arg',
      `PRIVOS_MCP_MANIFEST_DIGEST=${manifestDigest}`,
      '-t',
      imageTag,
      '.',
    ],
  });

  const labels = parseImageLabels(await input.runCommand({
    command: 'docker',
    args: ['image', 'inspect', imageTag, '--format', '{{json .Config.Labels}}'],
  }));
  if (labels[MANIFEST_LABEL] !== manifestJson
    || labels[MANIFEST_DIGEST_LABEL] !== manifestDigest) {
    throw new Error('Built image manifest labels do not match canonical inputs');
  }

  return { imageTag, manifestDigest };
}

const runDockerCommand: DockerCommandRunner = (invocation) => new Promise((resolve, reject) => {
  const child = spawn(invocation.command, [...invocation.args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const streamBuildOutput = invocation.args[0] === 'build';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout.push(chunk);
    if (streamBuildOutput) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr.push(chunk);
    if (streamBuildOutput) process.stderr.write(chunk);
  });
  child.once('error', reject);
  child.once('close', (code) => {
    if (code === 0) {
      resolve(Buffer.concat(stdout).toString('utf8'));
      return;
    }
    const detail = Buffer.concat(stderr).toString('utf8').trim();
    reject(new Error(detail || `Docker command failed with exit code ${String(code)}`));
  });
});

async function main(): Promise<void> {
  const manifest: unknown = JSON.parse(fs.readFileSync('privos-app.json', 'utf8'));
  const result = await buildDockerImage({
    manifest,
    imageTag: process.argv[2]?.trim() || DEFAULT_IMAGE_TAG,
    runCommand: runDockerCommand,
  });
  console.log(`image=${result.imageTag} manifestDigest=${result.manifestDigest}`);
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Docker build verification failed');
    process.exitCode = 1;
  });
}
