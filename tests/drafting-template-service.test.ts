import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderDraftingTemplate,
  resolveDraftingRouterTemplate,
} from '../src/ui/drafting/services/DraftingTemplateService';
import type { DraftingTemplate } from '../src/ui/drafting/types';

const template: DraftingTemplate = {
  id: 'notice',
  title: 'Notice',
  category: 'thongtin',
  categoryLabel: 'Information',
  track: 'modern_enterprise',
  icon: 'file',
  description: 'Internal notice',
  defaultData: { companyName: 'Example Company' },
  templateText: '{{companyName}} - {{subject}} - {{missingField}}',
};

test('renders known values and converts unresolved placeholders to explicit markers', () => {
  const result = renderDraftingTemplate(template, { subject: 'Payroll policy' });

  assert.equal(result, 'Example Company - Payroll policy - [missingField]');
  assert.doesNotMatch(result, /\{\{[^}]+\}\}/u);
});

test('accepts only a router template ID from the supplied catalog', () => {
  assert.equal(
    resolveDraftingRouterTemplate('<router_result>notice</router_result>', [template])?.id,
    'notice',
  );
  assert.equal(
    resolveDraftingRouterTemplate('<router_result>unknown-template</router_result>', [template]),
    undefined,
  );
  assert.equal(resolveDraftingRouterTemplate('notice', [template]), undefined);
});

test('renders placeholder keys containing regular expression characters safely', () => {
  assert.equal(
    renderDraftingTemplate('{{employee.name}}', { 'employee.name': 'Nguyen An' }),
    'Nguyen An',
  );
});
