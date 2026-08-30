import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { createBotDraftingLogger } from '../../src/ui/bot-drafting-tab';
import { buildDraftingAIPrompt, buildGenericDraftingAIPrompt } from '../../src/ui/drafting/services/DraftingTemplateService';
import type { DraftingTemplate } from '../../src/ui/drafting/types';

const template: DraftingTemplate = {
  id: 'offer', title: 'Offer', description: 'Offer letter', icon: 'doc',
  category: 'thoathuan', categoryLabel: 'HR', track: 'modern_enterprise',
  templateText: '# {{companyName}}', defaultData: { companyName: 'Hardcoded Co' },
};

describe('drafting company contract', () => {
  it('places Room company references in template and generic prompts and forbids default-company fallback', () => {
    const context = '@Files:room-1/hr-miniapp/company/overview.md';

    const templatePrompt = buildDraftingAIPrompt(template, {}, 'full_generation', undefined, undefined, context);
    const genericPrompt = buildGenericDraftingAIPrompt('Soạn quyết định', undefined, context);

    expect(templatePrompt).toContain(context);
    expect(templatePrompt).toContain('không dùng dữ liệu công ty mặc định trong mẫu');
    expect(genericPrompt).toContain(context);
    expect(genericPrompt).toContain('[Chưa có thông tin]');
  });

  it('does not forward dynamic prompt or Room values to the default runtime logger', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createBotDraftingLogger();

    logger('secret prompt for room-private');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('contains no console forwarding in the reviewed dynamic-data UI files', () => {
    const files = [
      'src/ui/bot-drafting-tab.tsx',
      'src/ui/lifecycle/LifecycleDashboard.tsx',
      'src/ui/lifecycle/components/CreateDetailedProfileForm.tsx',
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/console\.(?:log|warn|error)\s*\(/u);
    }
  });
});
