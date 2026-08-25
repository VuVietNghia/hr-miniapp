import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpApp } from '@privos/app-react';
import { buildDraftingAIPrompt, buildGenericDraftingAIPrompt } from '../src/ui/drafting/services/DraftingTemplateService';
import { CompanyContextProvider } from '../src/ui/drafting/services/CompanyContextProvider';
import { BUILTIN_TEMPLATES } from '../src/ui/drafting/templates';
import type { DraftingTemplate } from '../src/ui/drafting/types';

const template: DraftingTemplate = {
  id: 'notice',
  title: 'Thông báo',
  category: 'thongtin',
  categoryLabel: 'Thông tin',
  track: 'nd30_administrative',
  icon: 'notice',
  description: 'Thông báo nội bộ',
  defaultData: { companyName: 'DỮ LIỆU MẪU KHÔNG ĐƯỢC DÙNG' },
  templateText: '{{companyName}}'
};

test('injects Room company references into both drafting prompts', () => {
  const companyContext = '@Files:room-123/hr-miniapp/company/ho-so-phap-ly.md';

  const templatePrompt = buildDraftingAIPrompt(template, {}, 'custom', 'Soạn thông báo', undefined, companyContext);
  const genericPrompt = buildGenericDraftingAIPrompt('Soạn thông báo', undefined, companyContext);

  for (const prompt of [templatePrompt, genericPrompt]) {
    assert.equal(prompt.startsWith(companyContext), true);
    assert.match(prompt, /BẮT BUỘC đọc và chỉ sử dụng thông tin công ty từ tài liệu tham chiếu/u);
    assert.match(prompt, /@Files:room-123\/hr-miniapp\/company\/ho-so-phap-ly\.md/u);
    assert.match(prompt, /không dùng dữ liệu công ty mặc định trong mẫu/u);
  }
});

function createCompanyFilesApp(fileNames: string[]): McpApp {
  return {
    async callServerTool(params: { name: string; arguments: { parentId?: string } }) {
      if (params.name === 'privos.folders.getByChannel') {
        if (!params.arguments.parentId) {
          return { content: [{ text: JSON.stringify([{ _id: 'hr-miniapp-folder', name: 'hr-miniapp' }]) }] };
        }
        if (params.arguments.parentId === 'hr-miniapp-folder') {
          return { content: [{ text: JSON.stringify([{ _id: 'company-folder', name: 'company' }]) }] };
        }
      }
      if (params.name === 'privos.files.getByChannel') {
        return { content: [{ text: JSON.stringify(fileNames.map(name => ({ _id: name, name }))) }] };
      }
      throw new Error(`Unexpected tool: ${params.name}`);
    }
  } as unknown as McpApp;
}

test('builds file references from the current Room company folder', async () => {
  const provider = new CompanyContextProvider(createCompanyFilesApp(['company-profile.md', 'legal-representative.pdf']), 'room-123');

  const context = await provider.getContext();

  assert.match(context, /@Files:room-123\/hr-miniapp\/company\/company-profile\.md/u);
  assert.match(context, /@Files:room-123\/hr-miniapp\/company\/legal-representative\.pdf/u);
});

test('rejects drafting when the Room company folder has no files', async () => {
  const provider = new CompanyContextProvider(createCompanyFilesApp([]), 'room-123');

  await assert.rejects(() => provider.getContext(), /Chưa có tài liệu trong thư mục hr-miniapp\/company/u);
});

test('generates every drafting prompt without B.Army defaults', () => {
  const companyContext = '@Files:room-123/hr-miniapp/company/company-profile.md';
  const prompts = [
    buildGenericDraftingAIPrompt('Soạn thông báo', undefined, companyContext),
    ...BUILTIN_TEMPLATES.map(template => buildDraftingAIPrompt(template, {}, 'custom', 'Soạn văn bản', undefined, companyContext))
  ];

  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /b\.army|barmy/iu);
  }
});
