import { useState, useEffect, useMemo } from 'react';
import { PrivosAppProvider, usePrivosContext, usePrivosApp } from '@privos_ai/app-react';
import { ThemeProvider, ThemeToggle } from './theme-provider';
import CompanyHome from './company-home';
import RecruitmentPanel from './recruitment-panel';
import PipelineDashboard from './pipeline-dashboard';
import LifecycleDashboard from './lifecycle/LifecycleDashboard';
import PayrollTab from './payroll/PayrollTab';
import BotDraftingTab from './bot-drafting-tab';
import CVScoredTab from './cv-scored/CVScoredTab';
import JDChatbotTab from './jd-chatbot-functional';
import EmailTab from './email-history/EmailTab';
import { createInterviewEmailTemplateRepository } from './email-templates/interview-email-template-default';
import { createRoomClients } from './platform/create-room-clients';
import { ensureTemplatesExistGlobal } from './pipeline-service';
import { usePayrollAccessPolling } from './payroll/access/usePayrollAccessPolling';
import {
  canAccessPayroll,
  resolveSandboxFeaturePolicy,
  resolveFeatureCapabilities,
} from './access/feature-capabilities';
import {
  PRIMARY_TABS,
  TAB_SECTIONS,
  applyPayrollAvailability,
  createNavigationState,
  filterNavigationSections,
  selectNavigationTab,
  shouldMountTab,
  type NavigationState,
  type SectionId,
  type Tab,
  type TabSection,
} from './navigation';

function ThemedApp() {
  const app = usePrivosApp();
  const { theme, roomId, effectiveScopes } = usePrivosContext();
  const [navigation, setNavigation] = useState<NavigationState>(createNavigationState);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const featureCapabilities = useMemo(
    () => resolveFeatureCapabilities(effectiveScopes),
    [effectiveScopes],
  );
  const sandboxPolicy = useMemo(
    () => resolveSandboxFeaturePolicy(effectiveScopes),
    [effectiveScopes],
  );
  const generalDraftingCapabilities = useMemo(() => ({
    ...featureCapabilities,
    draftingAvailable: sandboxPolicy.botKeyActionsAvailable
      && sandboxPolicy.wakeActionsAvailable
      && sandboxPolicy.generationActionsAvailable,
  }), [featureCapabilities, sandboxPolicy]);
  const roomClients = useMemo(() => app ? createRoomClients(app) : null, [app]);
  const templatePlatformReadable = Boolean(
    roomClients?.files.capabilities.folderScopedRead
    && roomClients.folders.capabilities.findByPath,
  );
  const templatePlatformWritable = Boolean(
    roomClients?.files.capabilities.folderScopedWrite
    && roomClients.folders.capabilities.ensurePath,
  );
  const hasVerifiedPayrollOwner = usePayrollAccessPolling(app);
  const payrollAvailable = canAccessPayroll(featureCapabilities, hasVerifiedPayrollOwner);
  const payrollAccessRoles = payrollAvailable ? ['owner'] : [];
  const visibleTabSections = filterNavigationSections(TAB_SECTIONS, payrollAvailable);
  const tab = navigation.activeTab;
  const visitedTabs = navigation.visitedTabs;

  useEffect(() => {
    if (app && roomId && featureCapabilities.filesWritable && featureCapabilities.listsWritable && templatePlatformWritable) {
      ensureTemplatesExistGlobal(app, roomId, true).catch(console.error);
    }
  }, [app, roomId, featureCapabilities.filesWritable, featureCapabilities.listsWritable, templatePlatformWritable]);

  useEffect(() => {
    if (!app || !roomId || !featureCapabilities.filesReadable || !featureCapabilities.filesWritable
      || !templatePlatformReadable || !templatePlatformWritable) return;
    const repository = createInterviewEmailTemplateRepository(app, roomId);
    repository.ensureInitialized().catch(error => {
      console.error('[InterviewEmailTemplates] Initialization failed', error);
    });
  }, [app, roomId, featureCapabilities.filesReadable, featureCapabilities.filesWritable, templatePlatformReadable, templatePlatformWritable]);

  useEffect(() => {
    if (tab === 'lifecycle') {
      console.log('[App] Lifecycle tab is active');
    }
  }, [tab]);

  useEffect(() => {
    setNavigation((previous) => applyPayrollAvailability(previous, payrollAvailable));
  }, [payrollAvailable]);

  const handleSelectTab = (selectedTab: Tab) => {
    setNavigation((previous) => selectNavigationTab(previous, selectedTab, payrollAvailable));
  };

  const isSectionActive = (section: TabSection) => section.tabs.some((t) => t.id === tab);

  return (
    <ThemeProvider hostTheme={theme}>
      <div className="app-header">
        <nav className="app-tabs" aria-label="Dashboard navigation" onMouseLeave={() => setOpenSection(null)}>
          <button
            type="button"
            className={`nav-primary-btn${tab === PRIMARY_TABS[0].id ? ' nav-primary-active' : ''}`}
            onClick={() => {
              handleSelectTab(PRIMARY_TABS[0].id);
              setOpenSection(null);
            }}
          >
            {PRIMARY_TABS[0].label}
          </button>

          <button
            type="button"
            className={`nav-primary-btn${tab === PRIMARY_TABS[1].id ? ' nav-primary-active' : ''}`}
            onClick={() => {
              handleSelectTab(PRIMARY_TABS[1].id);
              setOpenSection(null);
            }}
          >
            {PRIMARY_TABS[1].label}
          </button>

          {visibleTabSections.map((section) => {
            if (section.tabs.length === 0) return null;

            const isOpen = openSection === section.id;
            const isActive = isSectionActive(section);

            return (
              <div
                className={`app-nav-section${isOpen ? ' app-nav-section-open' : ''}`}
                key={section.id}
              >
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
                      onClick={() => {
                        handleSelectTab(t.id);
                        setOpenSection(null);
                      }}
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
      <div className={tab === 'home' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'home'}>
        {sandboxPolicy.degradedReasons.map(reason => (
          <div key={reason} className="hr-status-banner hr-status-error">{reason}</div>
        ))}
        <CompanyHome capabilities={generalDraftingCapabilities} />
      </div>
      {visitedTabs.has('email') && (
        <div className={tab === 'email' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'email'}>
          <EmailTab active={tab === 'email'} capabilities={featureCapabilities} />
        </div>
      )}
      {visitedTabs.has('recruitment') && (
        <div className={tab === 'recruitment' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'recruitment'}>
          <RecruitmentPanel capabilities={featureCapabilities} />
        </div>
      )}

      {visitedTabs.has('pipeline') && (
        <div className={tab === 'pipeline' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'pipeline'}>
          <PipelineDashboard capabilities={featureCapabilities} sandboxPolicy={sandboxPolicy} />
        </div>
      )}

      {visitedTabs.has('cvScored') && (
        <div className={tab === 'cvScored' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'cvScored'}>
          <CVScoredTab capabilities={featureCapabilities} />
        </div>
      )}

      {visitedTabs.has('chatbotJD') && (
        <div className={tab === 'chatbotJD' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'chatbotJD'}>
          <JDChatbotTab capabilities={generalDraftingCapabilities} />
        </div>
      )}



      {visitedTabs.has('lifecycle') && (
        <div className={tab === 'lifecycle' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'lifecycle'}>
          <LifecycleDashboard capabilities={featureCapabilities} />
        </div>
      )}

      {shouldMountTab(navigation, 'payroll', payrollAvailable) && (
        <div className={tab === 'payroll' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'payroll'}>
          <PayrollTab key={roomId} roomId={roomId} userRoles={payrollAccessRoles} capabilities={featureCapabilities} />
        </div>
      )}

      {visitedTabs.has('botDrafting') && (
        <div className={tab === 'botDrafting' ? 'app-tab-panel active' : 'app-tab-panel'} aria-hidden={tab !== 'botDrafting'}>
          <BotDraftingTab capabilities={featureCapabilities} sandboxPolicy={sandboxPolicy} />
        </div>
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
