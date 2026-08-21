import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentDiffService } from '../src/ui/drafting/services/DocumentDiffService';

test('produces added and removed markers for a modified sentence', () => {
  const diff = new DocumentDiffService().generateDiffMarkdown(
    'Mức lương là 10 triệu.',
    'Mức lương là 12 triệu.',
  );

  assert.match(diff, /<del[^>]*>10<\/del>/u);
  assert.match(diff, /<ins[^>]*>12<\/ins>/u);
});

test('uses a bounded fallback for large documents', () => {
  const original = Array.from({ length: 800 }, (_, index) => `Old line ${index}`).join('\n');
  const modified = Array.from({ length: 800 }, (_, index) => `New line ${index}`).join('\n');
  const service = new DocumentDiffService();

  const diff = service.generateDiffMarkdown(original, modified);

  assert.equal(diff.match(/diff-removed/gu)?.length, 1);
  assert.equal(diff.match(/diff-added/gu)?.length, 1);
});
