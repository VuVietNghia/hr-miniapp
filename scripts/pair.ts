import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

import {
  buildPairingMetadata,
  pairOverWebSocket,
  resolveStandalonePendingIdentityFilePath,
  resumeStandalonePairing,
  type AppDescriptor,
  type PairAppMeta,
} from '@privos_ai/app-server';
import WebSocket from 'ws';

import { buildRelayAppDescriptor, createManifest } from '../src/manifest';

interface PairingOutcome {
  state: 'legacy-complete' | 'pending-approval' | 'complete';
  pairingVersion?: 2;
  identityFilePath?: string;
}

export interface StandalonePairingDependencies {
  descriptor: AppDescriptor;
  manifest: Record<string, unknown>;
  pendingIdentityExists: () => boolean;
  promptForPairingUrl: () => Promise<string>;
  pair: (
    pairingUrl: string,
    metadata: PairAppMeta,
    options: Readonly<{
      persistIdentityFile: true;
      onFingerprint: (fingerprint: string) => void;
    }>,
  ) => Promise<PairingOutcome>;
  resume: () => Promise<PairingOutcome>;
  verifyIdentityMode: (identityFilePath: string) => Promise<void>;
  log: (message: string) => void;
}

function promptForPairingUrl(): Promise<string> {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    terminal.question('Enter the one-time pairing URL from Hub Admin: ', (answer) => {
      terminal.close();
      resolve(answer.trim());
    });
  });
}

async function verifyIdentityMode(identityFilePath: string): Promise<void> {
  if (process.platform === 'win32') return;
  const metadata = await fs.promises.stat(identityFilePath);
  if ((metadata.mode & 0o777) !== 0o600) {
    throw new Error('Standalone identity permissions are not 0600');
  }
}

function requireProtocolV2(result: PairingOutcome): void {
  if (result.pairingVersion !== 2 || result.state === 'legacy-complete') {
    throw new Error('Standalone production requires pairing protocol v2');
  }
}

export function createStandalonePairingRunner(
  dependencies: StandalonePairingDependencies,
): () => Promise<void> {
  return async () => {
    const finish = async (result: PairingOutcome): Promise<void> => {
      requireProtocolV2(result);
      if (result.state === 'pending-approval') {
        dependencies.log('Pairing is pending Hub owner approval. Approve it, then run npm run pair again.');
        return;
      }
      if (!result.identityFilePath) {
        throw new Error('Pairing completed without a persisted standalone identity');
      }
      await dependencies.verifyIdentityMode(result.identityFilePath);
      dependencies.log('Standalone identity persisted with owner-only permissions.');
      dependencies.log('Verify the Hub fingerprint out of band before starting production.');
    };

    if (dependencies.pendingIdentityExists()) {
      dependencies.log('Resuming the durable pending pairing after Hub approval.');
      await finish(await dependencies.resume());
      return;
    }

    const pairingUrl = await dependencies.promptForPairingUrl();
    if (!pairingUrl) throw new Error('No pairing URL provided');
    const metadata: PairAppMeta = {
      ...buildPairingMetadata(dependencies.descriptor),
      manifest: dependencies.manifest,
    };
    await finish(await dependencies.pair(pairingUrl, metadata, {
      persistIdentityFile: true,
      onFingerprint: (fingerprint) => dependencies.log(`Hub fingerprint: ${fingerprint}`),
    }));
  };
}

function defaultDependencies(): StandalonePairingDependencies {
  const pendingPath = resolveStandalonePendingIdentityFilePath();
  return {
    descriptor: buildRelayAppDescriptor(),
    manifest: createManifest(),
    pendingIdentityExists: () => fs.existsSync(path.resolve(pendingPath)),
    promptForPairingUrl,
    pair: (pairingUrl, metadata, options) => pairOverWebSocket(
      pairingUrl,
      metadata,
      WebSocket,
      options,
    ),
    resume: () => resumeStandalonePairing(),
    verifyIdentityMode,
    log: console.log,
  };
}

async function main(): Promise<void> {
  await createStandalonePairingRunner(defaultDependencies())();
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  void main().catch(() => {
    console.error('Standalone pairing failed. No pairing URL or credential was logged.');
    process.exitCode = 1;
  });
}
