import { config } from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../');
config({ path: path.join(projectRoot, '.env') });
config({ path: path.join(projectRoot, '.env.local') });

import { createOrUpdateFile } from './privos-rest';

async function testUploadMd() {
  try {
    const roomId = 'D8L6826kM7ZzN7JmH'; // Example test roomId
    const folderPath = `${roomId}/hr-miniapp/skills`;
    const fileName = `${folderPath}/test_guideline.md`;
    
    console.log(`[TEST] Uploading to: ${fileName}...`);
    
    // Create a mock app object to satisfy the frontend-oriented privos-rest requirements
    const mockApp: any = {
      uploadFile: async (args: any) => {
        console.log('[TEST MOCK] Intercepted uploadFile:', args);
        return { success: true };
      },
      callServerTool: async (req: any) => {
        console.log('[TEST MOCK] Intercepted callServerTool:', req);
        return { content: [{ text: '{}' }] };
      }
    };

    await createOrUpdateFile(mockApp, fileName, '# This is a test guideline\nIt should be hidden from the UI.');
    
    console.log(`[TEST] Success! File uploaded to ${folderPath}. Check the UI to verify it does not appear in the CV list.`);
  } catch (e) {
    console.error('[TEST] Error:', e);
  }
}

testUploadMd();
