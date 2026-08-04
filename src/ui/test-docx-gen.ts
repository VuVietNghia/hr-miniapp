import { DocxExportService } from './docx-export-service';
import { DRAFTING_TEMPLATES, renderDraftingTemplate } from './drafting-templates';
import { Packer } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

async function testDocx() {
  console.log('Testing DOCX generation for all templates...');
  
  for (const tpl of DRAFTING_TEMPLATES) {
    const renderedText = renderDraftingTemplate(tpl.templateText, tpl.defaultData);
    const doc = DocxExportService.createDocumentFromMarkdown(tpl.title, renderedText);
    const buffer = await Packer.toBuffer(doc);
    
    const outDir = path.resolve(__dirname, '../../test-outputs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outPath = path.join(outDir, `${tpl.id}.docx`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Generated: ${outPath} (${buffer.length} bytes)`);
  }
  console.log('All DOCX templates generated successfully!');
}

testDocx().catch(console.error);
