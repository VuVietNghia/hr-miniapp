import { describe, expect, it } from 'vitest';
import { PRIMARY_TABS, TAB_SECTIONS } from '../../src/ui/navigation';

describe('HR navigation contract', () => {
  it('preserves all business tabs in their current order', () => {
    const tabs = [
      ...PRIMARY_TABS,
      ...TAB_SECTIONS.flatMap((section) => section.tabs),
    ];

    expect(tabs).toEqual([
      { id: 'home', label: 'Company' },
      { id: 'email', label: 'Email' },
      { id: 'recruitment', label: 'Tuy\u1ec3n d\u1ee5ng' },
      { id: 'pipeline', label: 'CV Pipeline' },
      { id: 'cvScored', label: 'CV \u0111\u00e3 ch\u1ea5m' },
      { id: 'chatbotJD', label: 'Ch\u1ec9nh s\u1eeda JD' },
      { id: 'lifecycle', label: 'H\u1ed3 s\u01a1 NS' },
      { id: 'payroll', label: 'Qu\u1ea3n l\u00fd L\u01b0\u01a1ng' },
      { id: 'botDrafting', label: 'Bot so\u1ea1n th\u1ea3o' },
    ]);
  });
});
