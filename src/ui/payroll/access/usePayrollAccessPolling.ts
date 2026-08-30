import { useCallback, useEffect, useState } from 'react';
import type { McpApp } from '@privos_ai/app-react';
import { usePolling } from '../../hooks/usePolling';
import { isPayrollOwnerFromContextResult } from './payroll-access-context';

type PayrollAccessApp = Pick<McpApp, 'callServerTool'>;

export async function refreshPayrollAccess(app: PayrollAccessApp): Promise<boolean> {
  try {
    const result = await app.callServerTool({
      name: 'mcpapp.context.get',
      arguments: {},
    });
    return isPayrollOwnerFromContextResult(result);
  } catch {
    return false;
  }
}

export function usePayrollAccessPolling(
  app: PayrollAccessApp | null,
): boolean {
  const [access, setAccess] = useState<Readonly<{
    app: PayrollAccessApp | null;
    allowed: boolean;
  }>>({ app: null, allowed: false });

  useEffect(() => {
    setAccess({ app, allowed: false });
    if (!app) return;

    let current = true;
    void refreshPayrollAccess(app).then((allowed) => {
      if (current) setAccess({ app, allowed });
    });
    return () => { current = false; };
  }, [app]);

  const refreshAccess = useCallback(async () => {
    if (!app) {
      setAccess({ app: null, allowed: false });
      return;
    }

    const allowed = await refreshPayrollAccess(app);
    setAccess((current) => current.app === app ? { app, allowed } : current);
  }, [app]);

  usePolling(refreshAccess, {
    enabled: app !== null,
    interval: 1000,
    immediate: false,
    pauseOnTabHidden: false,
  });

  return access.app === app && access.allowed;
}
