export type Tab =
  | 'home'
  | 'email'
  | 'recruitment'
  | 'pipeline'
  | 'cvScored'
  | 'chatbotJD'
  | 'lifecycle'
  | 'payroll'
  | 'botDrafting';

export type SectionId = 'hr' | 'admin';

export type NavTab = Readonly<{
  id: Tab;
  label: string;
}>;

export const PRIMARY_TABS: readonly NavTab[] = [
  { id: 'home', label: 'Company' },
  { id: 'email', label: 'Email' },
] as const;

export type TabSection = Readonly<{
  id: SectionId;
  label: string;
  tabs: readonly NavTab[];
}>;

export const TAB_SECTIONS: readonly TabSection[] = [
  {
    id: 'hr',
    label: 'HR',
    tabs: [
      { id: 'recruitment', label: 'Tuy\u1ec3n d\u1ee5ng' },
      { id: 'pipeline', label: 'CV Pipeline' },
      { id: 'cvScored', label: 'CV \u0111\u00e3 ch\u1ea5m' },
      { id: 'chatbotJD', label: 'Ch\u1ec9nh s\u1eeda JD' },
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
] as const;

export interface NavigationState {
  readonly activeTab: Tab;
  readonly visitedTabs: ReadonlySet<Tab>;
}

export function createNavigationState(): NavigationState {
  return { activeTab: 'home', visitedTabs: new Set<Tab>(['home']) };
}

export function filterNavigationSections(
  sections: readonly TabSection[],
  payrollAvailable: boolean,
): TabSection[] {
  return sections.map((section) => ({
    ...section,
    tabs: payrollAvailable
      ? [...section.tabs]
      : section.tabs.filter((tab) => tab.id !== 'payroll'),
  }));
}

export function selectNavigationTab(
  state: NavigationState,
  selectedTab: Tab,
  payrollAvailable: boolean,
): NavigationState {
  if (selectedTab === 'payroll' && !payrollAvailable) return state;
  if (state.activeTab === selectedTab && state.visitedTabs.has(selectedTab)) return state;

  const visitedTabs = new Set(state.visitedTabs);
  visitedTabs.add(selectedTab);
  return { activeTab: selectedTab, visitedTabs };
}

export function applyPayrollAvailability(
  state: NavigationState,
  payrollAvailable: boolean,
): NavigationState {
  if (payrollAvailable || !state.visitedTabs.has('payroll')) return state;

  const visitedTabs = new Set(state.visitedTabs);
  visitedTabs.delete('payroll');
  return {
    activeTab: state.activeTab === 'payroll' ? 'home' : state.activeTab,
    visitedTabs,
  };
}

export function shouldMountTab(
  state: NavigationState,
  tab: Tab,
  payrollAvailable: boolean,
): boolean {
  return state.visitedTabs.has(tab) && (tab !== 'payroll' || payrollAvailable);
}
