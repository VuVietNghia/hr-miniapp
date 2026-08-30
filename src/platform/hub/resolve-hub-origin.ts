import {
  getWorkloadIdentityClient,
  loadStandaloneIdentity,
  resolveRuntimeMode,
  type RuntimeMode,
} from '@privos_ai/app-server';

export interface HubOriginResolutionDependencies {
  resolveMode: () => RuntimeMode;
  resolveManagedHubOrigin: () => Promise<string | undefined>;
  resolveStandaloneHubOrigin: () => string | undefined;
  developmentEnv: Readonly<{ PRIVOS_URL?: string }>;
}

function defaultDependencies(): HubOriginResolutionDependencies {
  return {
    resolveMode: () => resolveRuntimeMode().mode,
    resolveManagedHubOrigin: async () => (
      await getWorkloadIdentityClient().brokerContext()
    ).hubOrigin,
    resolveStandaloneHubOrigin: () => loadStandaloneIdentity().relay.privosUrl,
    developmentEnv: process.env,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export async function resolveHubOrigin(
  dependencies: HubOriginResolutionDependencies = defaultDependencies(),
): Promise<string | undefined> {
  let mode: RuntimeMode;
  try {
    mode = dependencies.resolveMode();
  } catch {
    return undefined;
  }

  try {
    if (mode === 'managed') {
      return nonEmpty(await dependencies.resolveManagedHubOrigin());
    }
    if (mode === 'standalone-production') {
      return nonEmpty(dependencies.resolveStandaloneHubOrigin());
    }
    const developmentUrl = nonEmpty(dependencies.developmentEnv.PRIVOS_URL);
    return developmentUrl && /^https?:\/\//.test(developmentUrl)
      ? developmentUrl.replace(/\/+$/, '')
      : undefined;
  } catch {
    return undefined;
  }
}
