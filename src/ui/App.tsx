import { useState, useEffect } from 'react';
import { PrivosAppProvider, usePrivosContext, usePrivosApp } from '@privos/app-react';
import { ThemeProvider, ThemeToggle } from './theme-provider';
import BArmyHome from './barmy-home';
import RecruitmentPanel from './recruitment-panel';
import PipelineDashboard from './pipeline-dashboard';
import LifecycleDashboard from './lifecycle/LifecycleDashboard';
import PayrollTab from './payroll/PayrollTab';
import BotDraftingTab from './bot-drafting-tab';
import { ensureTemplatesExistGlobal } from './pipeline-service';

type Tab = 'home' | 'recruitment' | 'pipeline' | 'lifecycle' | 'payroll' | 'botDrafting';
type SectionId = 'hr' | 'admin';

type TabSection = {
  id: SectionId;
  label: string;
  tabs: { id: Tab; label: string }[];
};

const TAB_SECTIONS: TabSection[] = [
  {
    id: 'hr',
    label: 'HR',
    tabs: [
      { id: 'recruitment', label: 'Tuy\u1ec3n d\u1ee5ng' },
      { id: 'pipeline', label: 'CV Pipeline' },
    ],
  },
  {
    id: 'admin',
    label: 'H\u00e0nh ch\u00ednh',
    tabs: [
      { id: 'lifecycle', label: 'H\u1ed3 s\u01a1 NS' },
      { id: 'payroll', label: 'Qu\u1ea3n l\u00fd L\u01b0\u01a1ng' },
      { id: 'botDrafting', label: 'Bot so\u1ea1n th\u1ea3o' },
    ],
  },
];

function ThemedApp() {
  const app = usePrivosApp();
  const { theme, roomId } = usePrivosContext();
  const [tab, setTab] = useState<Tab>('home');
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  useEffect(() => {
    if (app && roomId) {
      ensureTemplatesExistGlobal(app, roomId, true).catch(console.error);
    }
  }, [app, roomId]);

  const isSectionActive = (section: TabSection) => section.tabs.some((t) => t.id === tab);

  return (
    <ThemeProvider hostTheme={theme}>
      <div className="app-header">
        <nav className="app-tabs" aria-label="Dashboard navigation">
          <button
            type="button"
            className={`nav-primary-btn${tab === 'home' ? ' nav-primary-active' : ''}`}
            onClick={() => {
              setTab('home');
              setOpenSection(null);
            }}
          >
            Home
          </button>

          {TAB_SECTIONS.map((section) => {
            const isOpen = openSection === section.id;
            const isActive = isSectionActive(section);

            return (
              <div className={`app-nav-section${isOpen ? ' app-nav-section-open' : ''}`} key={section.id}>
                <button
                  type="button"
                  className={`nav-primary-btn${isOpen ? ' nav-primary-open' : ''}${isActive ? ' nav-primary-active' : ''}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenSection(isOpen ? null : section.id)}
                >
                  <span>{section.label}</span>
                  <span className="nav-primary-chevron" aria-hidden="true">{'\u203a'}</span>
                </button>

                <div className={`app-subnav${isOpen ? ' app-subnav-open' : ''}`} aria-hidden={!isOpen}>
                  {section.tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tab-btn${tab === t.id ? ' tab-active' : ''}`}
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>

      {tab === 'home' && <BArmyHome />}
      {tab === 'recruitment' && <RecruitmentPanel />}
      {tab === 'pipeline' && <PipelineDashboard />}
      {tab === 'lifecycle' && <LifecycleDashboard />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'botDrafting' && <BotDraftingTab />}
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
