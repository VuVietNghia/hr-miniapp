import { useState } from 'react';
import { PrivosAppProvider, usePrivosContext } from '@privos/app-react';
import { ThemeProvider, ThemeToggle } from './theme-provider';
import HRManagementDashboard from './contact-collector-form';
import FileUploadPanel from './file-upload-panel';
import AiChatPanel from './ai-chat-panel';
import AiHistoryPanel from './ai-history-panel';
import SkillsPanel from './skills-panel';
import SandboxConnectPanel from './sandbox-connect-panel';

import PipelineDashboard from './pipeline-dashboard';
import TestAi from './test-ai';

type Tab = 'records' | 'pipeline' | 'files' | 'chat' | 'history' | 'skills' | 'sandbox' | 'testAi';

const TABS: { id: Tab; label: string }[] = [
  { id: 'records', label: 'Records' },
  { id: 'pipeline', label: 'CV Pipeline' },
  { id: 'files', label: 'Files' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'history', label: 'AI History' },
  { id: 'skills', label: 'Skills' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'testAi', label: 'Test AI' },
];

function ThemedApp() {
  const { theme } = usePrivosContext();
  const [tab, setTab] = useState<Tab>('records');

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

      {tab === 'records' && <HRManagementDashboard />}
      {tab === 'pipeline' && <PipelineDashboard />}
      {tab === 'files' && <FileUploadPanel />}
      {tab === 'chat' && <AiChatPanel />}
      {tab === 'history' && <AiHistoryPanel />}
      {tab === 'skills' && <SkillsPanel />}
      {tab === 'sandbox' && <SandboxConnectPanel />}
      {tab === 'testAi' && <TestAi />}
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
