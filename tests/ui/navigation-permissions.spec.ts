import { describe, expect, it } from 'vitest';

import {
  PRIMARY_TABS,
  TAB_SECTIONS,
  applyPayrollAvailability,
  createNavigationState,
  filterNavigationSections,
  selectNavigationTab,
  shouldMountTab,
} from '../../src/ui/navigation';

describe('permission-aware navigation', () => {
  it('preserves the canonical labels and order when payroll is available', () => {
    const sections = filterNavigationSections(TAB_SECTIONS, true);
    expect([...PRIMARY_TABS, ...sections.flatMap((section) => section.tabs)]).toEqual([
      { id: 'home', label: 'Company' },
      { id: 'email', label: 'Email' },
      { id: 'recruitment', label: 'Tuyển dụng' },
      { id: 'pipeline', label: 'CV Pipeline' },
      { id: 'cvScored', label: 'CV đã chấm' },
      { id: 'chatbotJD', label: 'Chỉnh sửa JD' },
      { id: 'lifecycle', label: 'Hồ sơ NS' },
      { id: 'payroll', label: 'Quản lý Lương' },
      { id: 'botDrafting', label: 'Bot soạn thảo' },
    ]);
  });

  it('hides only payroll while the DB/owner gate is pending or denied', () => {
    const sections = filterNavigationSections(TAB_SECTIONS, false);
    expect(sections.flatMap((section) => section.tabs).map((tab) => tab.id)).toEqual([
      'recruitment',
      'pipeline',
      'cvScored',
      'chatbotJD',
      'lifecycle',
      'botDrafting',
    ]);
  });

  it('mounts tabs lazily and preserves previously visited non-payroll tabs', () => {
    const initial = createNavigationState();
    expect([...initial.visitedTabs]).toEqual(['home']);
    expect(shouldMountTab(initial, 'email', true)).toBe(false);

    const afterEmail = selectNavigationTab(initial, 'email', true);
    const afterPipeline = selectNavigationTab(afterEmail, 'pipeline', true);

    expect(afterPipeline.activeTab).toBe('pipeline');
    expect([...afterPipeline.visitedTabs]).toEqual(['home', 'email', 'pipeline']);
    expect(shouldMountTab(afterPipeline, 'email', true)).toBe(true);
  });

  it('rejects payroll selection until both independent gates are true', () => {
    const initial = createNavigationState();
    const denied = selectNavigationTab(initial, 'payroll', false);
    const allowed = selectNavigationTab(initial, 'payroll', true);

    expect(denied).toBe(initial);
    expect(allowed.activeTab).toBe('payroll');
    expect(allowed.visitedTabs.has('payroll')).toBe(true);
  });

  it('returns Home, removes and unmounts payroll immediately after revocation', () => {
    const withEmail = selectNavigationTab(createNavigationState(), 'email', true);
    const withPayroll = selectNavigationTab(withEmail, 'payroll', true);
    const revoked = applyPayrollAvailability(withPayroll, false);

    expect(revoked.activeTab).toBe('home');
    expect([...revoked.visitedTabs]).toEqual(['home', 'email']);
    expect(shouldMountTab(revoked, 'payroll', false)).toBe(false);
  });

  it('does not enter the payroll service boundary after revocation', () => {
    const mounted = selectNavigationTab(createNavigationState(), 'payroll', true);
    const revoked = applyPayrollAvailability(mounted, false);
    let payrollServiceCalls = 0;

    if (shouldMountTab(revoked, 'payroll', false)) payrollServiceCalls += 1;

    expect(payrollServiceCalls).toBe(0);
  });
});
