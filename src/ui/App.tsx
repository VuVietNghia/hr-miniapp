import { useState, useEffect } from 'react';
import { PrivosAppProvider, usePrivosContext, usePrivosApp } from '@privos/app-react';
import { ThemeProvider, ThemeToggle } from './theme-provider';

import PipelineDashboard from './pipeline-dashboard';
import { ensureTemplatesExistGlobal } from './pipeline-service';
import { MockPipelineService } from './mock-pipeline-service';

type Tab = 'pipeline' | 'mockPipeline';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'CV Pipeline' },
  { id: 'mockPipeline', label: 'Mock Pipeline' },
];

function ThemedApp() {
  const app = usePrivosApp();
  const { theme, roomId } = usePrivosContext();
  const [tab, setTab] = useState<Tab>('pipeline');

  useEffect(() => {
    if (app && roomId) {
      ensureTemplatesExistGlobal(app, roomId, true).catch(console.error);
    }
  }, [app, roomId]);

  return (
    <ThemeProvider hostTheme={theme}>
      <div className="app-header">
        <nav className="app-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-btn${tab === t.id ? ' tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <ThemeToggle />
      </div>

      {tab === 'pipeline' && <PipelineDashboard />}
      {tab === 'mockPipeline' && (
        <PipelineDashboard 
          serviceFactory={() => new MockPipelineService()} 
        />
      )}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <PrivosAppProvider>
      <ThemedApp />
    </PrivosAppProvider>
  );
}
