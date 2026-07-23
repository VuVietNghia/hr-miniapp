import { useState, useEffect } from 'react';
import { PrivosAppProvider, usePrivosContext, usePrivosApp } from '@privos/app-react';
import { ThemeProvider, ThemeToggle } from './theme-provider';
import BArmyHome from './barmy-home';
import RecruitmentPanel from './recruitment-panel';

import PipelineDashboard from './pipeline-dashboard';
import TrainingDashboard from './training-dashboard';
import LifecycleDashboard from './lifecycle-dashboard';
import { ensureTemplatesExistGlobal } from './pipeline-service';
import { MockPipelineService } from './mock-pipeline-service';

type Tab = 'home' | 'recruitment' | 'pipeline' | 'mockPipeline' | 'training' | 'lifecycle';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'recruitment', label: 'Tuyển dụng' },
  { id: 'pipeline', label: 'CV Pipeline' },
  { id: 'training', label: 'Đào tạo' },
  { id: 'lifecycle', label: 'Hồ sơ NS' },
  { id: 'mockPipeline', label: 'Mock Pipeline' },
];

function ThemedApp() {
  const app = usePrivosApp();
  const { theme, roomId } = usePrivosContext();
  const [tab, setTab] = useState<Tab>('home');

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

      {tab === 'home' && <BArmyHome />}
      {tab === 'recruitment' && <RecruitmentPanel />}
      {tab === 'pipeline' && <PipelineDashboard />}
      {tab === 'training' && <TrainingDashboard />}
      {tab === 'lifecycle' && <LifecycleDashboard />}
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
