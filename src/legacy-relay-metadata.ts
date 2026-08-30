import { MANIFEST_PERMISSION_SCOPES } from './manifest';

type LegacyPairingMetadataInput = Readonly<{
  name: string;
  description?: string;
  version?: string;
  icon?: string;
}>;

export type LegacyPairingMetadata = Readonly<{
  name: string;
  description?: string;
  version?: string;
  icon?: string;
  scopes: readonly string[];
}>;

type LegacyReconnectServerInfoInput = Readonly<{
  name: string;
  version: string;
  icon?: string;
}>;

export type LegacyReconnectServerInfo = Readonly<{
  name: string;
  version: string;
  icon?: string;
  scopes: readonly string[];
}>;

export function buildLegacyPairingMetadata(
  input: LegacyPairingMetadataInput,
): LegacyPairingMetadata {
  const { icon, ...identity } = input;
  return {
    ...identity,
    ...(icon === undefined ? {} : { icon }),
    scopes: MANIFEST_PERMISSION_SCOPES,
  };
}

export function buildLegacyReconnectServerInfo(
  input: LegacyReconnectServerInfoInput,
): LegacyReconnectServerInfo {
  const { icon, ...identity } = input;
  return {
    ...identity,
    ...(icon === undefined ? {} : { icon }),
    scopes: MANIFEST_PERMISSION_SCOPES,
  };
}
