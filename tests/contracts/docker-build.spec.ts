import { describe, expect, it } from 'vitest';

import {
  buildDockerImage,
  type DockerCommandRunner,
  type DockerCommandInvocation,
} from '../../scripts/build-docker';

const manifest = { z: 1, a: 'x' };
const canonicalManifest = '{"a":"x","z":1}';
const manifestDigest = 'sha256:8d6a75ac86d8b51bb56acfbb96108ed81474aa3504c317f77c0c576bde387cd3';

function labelReadback(
  manifestLabel = canonicalManifest,
  digestLabel = manifestDigest,
): string {
  return JSON.stringify({
    'io.privos.mcp.manifest': manifestLabel,
    'io.privos.mcp.manifest-digest': digestLabel,
  });
}

describe('Docker manifest-label build wrapper', () => {
  it('passes the canonical manifest and non-empty digest as exact Docker build arguments', async () => {
    const invocations: DockerCommandInvocation[] = [];
    const runCommand: DockerCommandRunner = async (invocation) => {
      invocations.push(invocation);
      return invocation.args[0] === 'image' ? labelReadback() : '';
    };

    await buildDockerImage({ manifest, imageTag: 'hr:test', runCommand });

    expect(invocations[0]).toEqual({
      command: 'docker',
      args: [
        'build',
        '--build-arg',
        `PRIVOS_MCP_MANIFEST_JSON=${canonicalManifest}`,
        '--build-arg',
        `PRIVOS_MCP_MANIFEST_DIGEST=${manifestDigest}`,
        '-t',
        'hr:test',
        '.',
      ],
    });
  });

  it('rejects empty manifest input before invoking Docker', async () => {
    const invocations: DockerCommandInvocation[] = [];
    const runCommand: DockerCommandRunner = async (invocation) => {
      invocations.push(invocation);
      return '';
    };

    await expect(buildDockerImage({ manifest: undefined, imageTag: 'hr:test', runCommand }))
      .rejects.toThrow('Manifest input is empty');
    expect(invocations).toEqual([]);
  });

  it('fails when the inspected image labels differ from the canonical inputs', async () => {
    const runCommand: DockerCommandRunner = async (invocation) => (
      invocation.args[0] === 'image'
        ? labelReadback(canonicalManifest, 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
        : ''
    );

    await expect(buildDockerImage({ manifest, imageTag: 'hr:test', runCommand }))
      .rejects.toThrow('Built image manifest labels do not match');
  });

  it('returns the verified image identity after successful label inspection', async () => {
    const runCommand: DockerCommandRunner = async (invocation) => (
      invocation.args[0] === 'image' ? labelReadback() : ''
    );

    await expect(buildDockerImage({ manifest, imageTag: 'hr:test', runCommand })).resolves.toEqual({
      imageTag: 'hr:test',
      manifestDigest,
    });
  });
});
