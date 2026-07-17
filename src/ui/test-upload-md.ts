import { config } from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../');
config({ path: path.join(projectRoot, '.env') });
config({ path: path.join(projectRoot, '.env.local') });

import { app } from '../server'; 
import { createOrUpdateFile } from './privos-rest';

async function testUploadMd() {
  try {
    const roomId = 'D8L6826kM7ZzN7JmH'; // Example test roomId
    const folderPath = `${roomId}/hr-miniapp/skills`;
    const fileName = `${folderPath}/test_guideline.md`;
    
    console.log(`[TEST] Uploading to: ${fileName}...`);
    
    await createOrUpdateFile(app, fileName, '# This is a test guideline\nIt should be hidden from the UI.');
    
    console.log(`[TEST] Success! File uploaded to ${folderPath}. Check the UI to verify it does not appear in the CV list.`);
  } catch (e) {
    console.error('[TEST] Error:', e);
  }
}

testUploadMd();
