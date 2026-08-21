import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseDraftingMarkdown,
  parseInlineMarkdown,
} from '../src/ui/drafting/services/DraftingMarkdownParser';

test('keeps raw HTML as text instead of producing executable markup', () => {
  const segments = parseInlineMarkdown('<img src=x onerror=alert(1)> **Approved**');

  assert.deepEqual(segments, [
    { kind: 'text', text: '<img src=x onerror=alert(1)> ' },
    { kind: 'strong', text: 'Approved' },
  ]);
});

test('allows only the explicit line-break token used by built-in templates', () => {
  const segments = parseInlineMarkdown('Agency<br>Code<img src=x>');

  assert.deepEqual(segments, [
    { kind: 'text', text: 'Agency' },
    { kind: 'line-break', text: '' },
    { kind: 'text', text: 'Code<img src=x>' },
  ]);
});

test('parses headings, legal bases and table cells into typed blocks', () => {
  const blocks = parseDraftingMarkdown([
    '# Decision',
    '- Căn cứ quy định;',
    '| Agency | Country |',
    '| --- | --- |',
  ].join('\n'));

  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[1].kind, 'legal-basis');
  assert.equal(blocks[2].kind, 'table');
});
