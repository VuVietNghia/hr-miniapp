import {
  getWorkloadIdentityClient,
  loadStandaloneIdentity,
  resolveRuntimeMode,
  type RuntimeMode,
} from '@privos_ai/app-server';

export interface McpAppIdResolutionDependencies {
  resolveMode: () => RuntimeMode;
  resolveManagedMcpAppId: () => Promise<string | undefined>;
  resolveStandaloneMcpAppId: () => string | undefined;
  developmentEnv: Readonly<{ MCP_APP_ID?: string }>;
}

function defaultDependencies(): McpAppIdResolutionDependencies {
  return {
    resolveMode: () => resolveRuntimeMode().mode,
    resolveManagedMcpAppId: async () => (
      await getWorkloadIdentityClient().brokerContext()
    ).binding.mcpAppId,
    resolveStandaloneMcpAppId: () => loadStandaloneIdentity().identity.mcpAppId,
    developmentEnv: process.env,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export async function resolveOwnMcpAppId(
  dependencies: McpAppIdResolutionDependencies = defaultDependencies(),
): Promise<string | undefined> {
  let mode: RuntimeMode;
  try {
    mode = dependencies.resolveMode();
  } catch {
    return undefined;
  }

  try {
    if (mode === 'managed') {
      return nonEmpty(await dependencies.resolveManagedMcpAppId());
    }
    if (mode === 'standalone-production') {
      return nonEmpty(dependencies.resolveStandaloneMcpAppId());
    }
    return nonEmpty(dependencies.developmentEnv.MCP_APP_ID);
  } catch {
    return undefined;
  }
}
