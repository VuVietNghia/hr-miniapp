import { describe, expect, it } from 'vitest';
import publisherManifest from '../../privos-app.json';
import {
  buildLegacyPairingMetadata,
  buildLegacyReconnectServerInfo,
} from '../../src/legacy-relay-metadata';
import { MANIFEST_PERMISSION_SCOPES } from '../../src/manifest';

describe('legacy Relay scope advertisement', () => {
  it('feeds pairing and reconnect from the exact immutable manifest scope projection', () => {
    const expectedScopes = publisherManifest.permissions.map((permission) => permission.scope);

    expect(MANIFEST_PERMISSION_SCOPES).toEqual(expectedScopes);
    expect(Object.isFrozen(MANIFEST_PERMISSION_SCOPES)).toBe(true);

    const pairingMetadata = buildLegacyPairingMetadata({
      name: publisherManifest.title,
      description: publisherManifest.description,
      version: publisherManifest.version,
      icon: 'data:image/svg+xml;base64,PAIRING',
    });
    expect(pairingMetadata).toEqual({
      name: publisherManifest.title,
      description: publisherManifest.description,
      version: publisherManifest.version,
      icon: 'data:image/svg+xml;base64,PAIRING',
      scopes: expectedScopes,
    });
    expect(pairingMetadata.scopes).toBe(MANIFEST_PERMISSION_SCOPES);

    const reconnectServerInfo = buildLegacyReconnectServerInfo({
      name: publisherManifest.title,
      version: publisherManifest.version,
      icon: 'data:image/svg+xml;base64,RECONNECT',
    });
    expect(reconnectServerInfo).toEqual({
      name: publisherManifest.title,
      version: publisherManifest.version,
      icon: 'data:image/svg+xml;base64,RECONNECT',
      scopes: expectedScopes,
    });
    expect(reconnectServerInfo.scopes).toBe(MANIFEST_PERMISSION_SCOPES);
  });
});
