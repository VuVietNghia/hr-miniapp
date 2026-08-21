import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('drafting preview does not render AI content through raw HTML', async () => {
  const previewSource = await readFile(
    new URL('../src/ui/drafting/components/DraftingPreview.tsx', import.meta.url),
    'utf8',
  );
  const tabSource = await readFile(
    new URL('../src/ui/bot-drafting-tab.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(previewSource, /dangerouslySetInnerHTML/u);
  assert.doesNotMatch(tabSource, /dangerouslySetInnerHTML/u);
});

test('payroll dashboard no longer polls every second', async () => {
  const dataHook = await readFile(
    new URL('../src/ui/payroll/hooks/usePayrollData.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(dataHook, /interval:\s*1000/u);
  assert.match(dataHook, /pollingInterval/u);
});

test('legacy lifecycle fallback service is removed', async () => {
  const legacyServiceUrl = new URL('../src/ui/lifecycle/services/lifecycleService.ts', import.meta.url);
  await assert.rejects(access(legacyServiceUrl));
});

test('employee creation form contains no debug log panel', async () => {
  const formSource = await readFile(
    new URL('../src/ui/lifecycle/components/CreateDetailedProfileForm.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(formSource, /debugLog|debug-log-container/u);
});
