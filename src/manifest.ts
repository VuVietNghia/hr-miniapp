import type {
  AppDescriptor,
  AppPermissionContext,
  AppPermissionDescriptor,
  AppPermissionExecutionContext,
  AppPermissionRequirement,
} from '@privos_ai/app-server';

import publisherManifest from '../privos-app.json';
import { getAppIconDataUri } from './app-icon';

export const MARKETPLACE_MANIFEST_FIELDS = [
  'schemaVersion', 'kind', 'name', 'version', 'title', 'description', 'icon',
  'author', 'homepage', 'repository', 'permissions', 'dataPolicy', 'availabilityTier',
  'capabilities', 'agentBot', 'tools', 'port', 'resources', 'volumes', 'stateless', 'license', 'env',
  'resourceManifestTemplate',
] as const;

export const HUB_MANIFEST_FIELDS = MARKETPLACE_MANIFEST_FIELDS;

export const MANIFEST_PERMISSION_SCOPES: readonly string[] = Object.freeze(
  publisherManifest.permissions.map((permission) => permission.scope),
);

export type AppManifest = Pick<typeof publisherManifest, (typeof MARKETPLACE_MANIFEST_FIELDS)[number]>;

export function createManifest(): AppManifest {
  return {
    schemaVersion: publisherManifest.schemaVersion,
    kind: publisherManifest.kind,
    name: publisherManifest.name,
    version: publisherManifest.version,
    title: publisherManifest.title,
    description: publisherManifest.description,
    icon: publisherManifest.icon,
    author: publisherManifest.author,
    homepage: publisherManifest.homepage,
    repository: publisherManifest.repository,
    permissions: publisherManifest.permissions,
    dataPolicy: publisherManifest.dataPolicy,
    availabilityTier: publisherManifest.availabilityTier,
    capabilities: publisherManifest.capabilities,
    agentBot: publisherManifest.agentBot,
    tools: publisherManifest.tools,
    port: publisherManifest.port,
    resources: publisherManifest.resources,
    volumes: publisherManifest.volumes,
    stateless: publisherManifest.stateless,
    license: publisherManifest.license,
    env: publisherManifest.env,
    resourceManifestTemplate: publisherManifest.resourceManifestTemplate,
  };
}

function permissionRequirement(value: string): AppPermissionRequirement {
  if (value === 'required' || value === 'optional') return value;
  throw new TypeError(`Unsupported manifest permission requirement: ${value}`);
}

function permissionContext(value: string): AppPermissionContext {
  if (value === 'workspace' || value === 'room') return value;
  throw new TypeError(`Unsupported manifest permission context: ${value}`);
}

function permissionExecutionContext(value: string): AppPermissionExecutionContext {
  if (value === 'user' || value === 'background' || value === 'both') return value;
  throw new TypeError(`Unsupported manifest permission execution context: ${value}`);
}

function toPermissionDescriptor(
  permission: (typeof publisherManifest.permissions)[number],
): AppPermissionDescriptor {
  return {
    scope: permission.scope,
    requirement: permissionRequirement(permission.requirement),
    context: permissionContext(permission.context),
    executionContext: permissionExecutionContext(permission.executionContext),
    feature: permission.feature,
    reason: permission.reason,
    ...(permission.degradedBehavior === undefined
      ? {}
      : { degradedBehavior: permission.degradedBehavior }),
  };
}

export function buildRelayAppDescriptor(): AppDescriptor {
  return {
    id: publisherManifest.name,
    name: publisherManifest.name,
    version: publisherManifest.version,
    title: publisherManifest.title,
    description: publisherManifest.description,
    homepage: publisherManifest.homepage,
    author: publisherManifest.author,
    permissions: publisherManifest.permissions.map(toPermissionDescriptor),
    manifestIcon: publisherManifest.icon,
    relayIcon: getAppIconDataUri(),
  };
}
