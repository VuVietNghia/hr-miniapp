import { McpApp } from '@privos/app-react';
import { restCall, getFileContent, createOrUpdateFile, ensureFolderPath } from './privos-rest';
import { ICvContextBuilder } from './cv-context-builder';
import cvProcessingGuidelinesRaw from './data/cv_processing_guidelines.md?raw';
import cvMdTemplateRaw from './data/cv_md_template.md?raw';
import sangLocCvRaw from './data/sang_loc_cv.md?raw';
import cvEvaluatorSkillRaw from './data/cv-evaluator-skill.md?raw';
import jdTemplateRaw from './data/jd_template.md?raw';
import jdGeneratorSkillRaw from './data/jd-generator-skill.md?raw';
import jdBackendJavaRaw from '../../Tin_Tuyen_Dung/JD_Backend_Java.md?raw';
import jdITSystemAdminRaw from '../../Tin_Tuyen_Dung/JD_IT_System_Admin.md?raw';
import jdManualTesterRaw from '../../Tin_Tuyen_Dung/JD_Manual_Tester.md?raw';

const defaultJDTemplates = [
  { fileName: 'JD_Backend_Java.md', content: jdBackendJavaRaw },
  { fileName: 'JD_IT_System_Admin.md', content: jdITSystemAdminRaw },
  { fileName: 'JD_Manual_Tester.md', content: jdManualTesterRaw },
];

export interface CVFile {
  _id: string;
  name: string;
  size?: number;
  downloadUrl?: string;
  originalName?: string;
  status?: ProcessingStatus['status'];
  score?: number;
  category?: string;
  reason?: string;
  errorMsg?: string;
  normalizedName?: string;
  markdownContent?: string;
}

export interface ProcessingStatus {
  fileId: string;
  originalName: string;
  normalizedName?: string;
  status: 'pending' | 'uploading' | 'renaming' | 'scoring' | 'completed' | 'error';
  score?: number;
  category?: string;
  reason?: string;
  errorMsg?: string;
  markdownContent?: string;
}

export async function ensureTemplatesExistGlobal(app: McpApp, roomId: string, forceReset = false): Promise<void> {
  const baseFolder = `${roomId}/hr-miniapp/skills`;
  const guidelinePath = `${baseFolder}/cv_processing_guidelines.md`;
  const templatePath = `${baseFolder}/cv_md_template.md`;
  const sangLocPath = `${baseFolder}/sang_loc_cv.md`;
  const evaluatorSkillPath = `${baseFolder}/cv-evaluator-skill.md`;
  const jdTemplatePath = `${baseFolder}/jd_template.md`;
  const jdGeneratorSkillPath = `${baseFolder}/jd-generator.md`;

  const checkAndUpload = async (path: string, rawContent: string, isGuideline: boolean) => {
    if (!forceReset) {
      try {
        const existing = await getFileContent(app, path);
        if (existing && existing.trim().length > 10) return; // File exists and has valid content
        console.warn(`[CẢNH BÁO] File ${path} bị lỗi hoặc trống. Tự động khôi phục...`);
      } catch (err) {
        console.warn(`[CẢNH BÁO] Thiếu file ${path}. Tự động khôi phục...`);
      }
    }

    // Replace hardcoded room ID in guidelines with current room ID
    let finalContent = rawContent;
    if (isGuideline) {
      finalContent = finalContent.replace(/\[ROOM_ID\]/g, roomId);
      // Ensure the guideline points to the new template path
      finalContent = finalContent.replace(/hr-miniapp\/cv_md_template\.md/g, 'hr-miniapp/skills/cv_md_template.md');
    }

    // LOG CHO DEBUG
    console.log(`[DEBUG] Đang upload file: ${path}`);

    try {
      await createOrUpdateFile(app, path, finalContent);
      console.log(`[DEBUG] Upload thành công: ${path}`);
    } catch (err: any) {
      console.error(`[DEBUG] Lỗi khi upload ${path}:`, err);
      alert(`Lỗi upload file hướng dẫn: ${err.message}`);
    }
  };


  const checkAndUploadDefaultJD = async (fileName: string, rawContent: string) => {
    const path = `${roomId}/hr-miniapp/jds/${fileName}`;
    if (!forceReset) {
      try {
        const existing = await getFileContent(app, path);
        if (existing && existing.trim().length > 10) return;
      } catch (err) {
        console.warn(`[CẢNH BÁO] Thiếu JD mẫu ${path}. Tự động tạo mới...`);
      }
    }

    console.log(`[DEBUG] Đang upload JD mẫu: ${path}`);
    try {
      await createOrUpdateFile(app, path, rawContent);
      console.log(`[DEBUG] Upload JD mẫu thành công: ${path}`);
    } catch (err: any) {
      console.error(`[DEBUG] Lỗi khi upload JD mẫu ${path}:`, err);
      alert(`Lỗi upload JD mẫu: ${err.message}`);
    }
  };
  try {
    // Chạy tuần tự thay vì Promise.all để tránh race condition khi tạo folder
    await checkAndUpload(guidelinePath, cvProcessingGuidelinesRaw, true);
    await checkAndUpload(templatePath, cvMdTemplateRaw, false);
    await checkAndUpload(sangLocPath, sangLocCvRaw, false);
    await checkAndUpload(evaluatorSkillPath, cvEvaluatorSkillRaw, true);
    await checkAndUpload(jdTemplatePath, jdTemplateRaw, false);
    await checkAndUpload(jdGeneratorSkillPath, jdGeneratorSkillRaw, true);

    // Tự động tạo sẵn thư mục raws-cv, outputs-cv, skills, jds
    try {
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'raws-cv']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục raws-cv`);
      
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'outputs-cv']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục outputs-cv`);
      
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'skills']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục skills`);
      
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'jds']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục jds`);
    } catch (e) {
      console.error(`[CẢNH BÁO] Không thể tạo thư mục gốc cho ứng dụng:`, e);
    }

    for (const jd of defaultJDTemplates) {
      await checkAndUploadDefaultJD(jd.fileName, jd.content);
    }

    console.log(`[DEBUG] Hoàn tất ensureTemplatesExist`);
    if (forceReset) alert('Đã khôi phục/tạo mới file hướng dẫn thành công!');
  } catch (err: any) {
    alert(`Lỗi tổng khi ensureTemplatesExist: ${err.message}`);
  }
}

export class PipelineService {
  private app: McpApp;
  private roomId: string;
  private contextBuilder: ICvContextBuilder;
  
  // Cache the folder ID to avoid repeated tool calls
  private cachedSkillsFolderId: string | null | undefined = undefined;
  private cachedJdsFolderId: string | null | undefined = undefined;

  constructor(app: McpApp, roomId: string, contextBuilder: ICvContextBuilder) {
    this.app = app;
    this.roomId = roomId;
    this.contextBuilder = contextBuilder;
  }

  async ensureTemplatesExist(forceReset = false): Promise<void> {
    return ensureTemplatesExistGlobal(this.app, this.roomId, forceReset);
  }

  async fetchAvailableFiles(): Promise<CVFile[]> {
    const body = await restCall<any>(this.app, 'GET', `file-management.files.channel/${this.roomId}`, {
      query: { count: 50 },
      timeoutMs: 15000
    });
    const list = body?.files ?? body?.data ?? (Array.isArray(body) ? body : []);

    // Hide guideline files completely from the UI
    return list
      .filter((f: any) => !(f.name || '').includes('/skills/'))
      .map((f: any) => ({
        _id: f._id,
        name: f.name,
        size: f.size ?? f.file_size,
        downloadUrl: f.downloadUrl,
      }));
  }

  async fetchAvailableJDs(onLog?: (msg: string) => void): Promise<CVFile[]> {
    try {
      // Resolve the exact nested folder: hr-miniapp/jds.
      // Do not search globally by folder name because another root-level "jds" folder may exist.
      if (this.cachedJdsFolderId === undefined) {
        if (onLog) onLog(`[DEBUG] Đang tra cứu đúng thư mục hr-miniapp/jds...`);
        this.cachedJdsFolderId = await ensureFolderPath(this.app, this.roomId, ['hr-miniapp', 'jds']) || null;
        if (onLog) onLog(`[DEBUG] ID thư mục hr-miniapp/jds: ${this.cachedJdsFolderId}`);
      }

      if (!this.cachedJdsFolderId) {
        if (onLog) onLog(`[CẢNH BÁO] Không tìm thấy thư mục hr-miniapp/jds trong phòng.`);
        console.warn('Không tìm thấy thư mục hr-miniapp/jds.');
        return [];
      }

      if (onLog) onLog(`[DEBUG] Đang fetch files từ thư mục hr-miniapp/jds...`);
      const filesResponse: any = await this.app.callServerTool({
        name: 'privos.files.getByChannel',
        arguments: { channelId: this.roomId, folderId: this.cachedJdsFolderId }
      });

      let files: any[] = [];
      const filesText = filesResponse?.content?.[0]?.text;
      if (filesText) {
        const parsed = JSON.parse(filesText);
        files = Array.isArray(parsed) ? parsed : (parsed?.files || []);
      } else {
        files = filesResponse?.files ?? filesResponse?.body?.files ?? filesResponse?.data ?? [];
      }

      if (onLog) onLog(`[DEBUG] Tìm thấy ${files.length} files trong thư mục hr-miniapp/jds.`);

      return files
        .filter((f: any) => f.name?.endsWith('.md'))
        .map((f: any) => ({
          _id: f._id,
          name: f.name,
          size: f.size ?? f.file_size,
          downloadUrl: f.downloadUrl,
        }));

    } catch (err) {
      console.error('Lỗi khi tải danh sách JD:', err);
      if (onLog) onLog(`[LỖI] Lỗi khi tải danh sách JD: ${err}`);
      return [];
    }
  }

  async sendMessageToRoom(text: string): Promise<any> {
    return await this.app.callServerTool({
      name: 'privos.messages.send',
      arguments: {
        roomId: this.roomId,
        text: text
      }
    });
  }

  async waitForBotReply(sinceTs: string, onLog?: (msg: string) => void): Promise<boolean> {
    const startTimeMs = Date.now();
    // Timeout polling AI tính động theo p95 (ước tính 30s)
    const MAX_TIMEOUT = 30000;
    const POLL_INTERVAL = 3000;
    const sinceTimeMs = new Date(sinceTs).getTime();
    
    let retries = 1; // single-retry theo chuẩn rule
    let currentStartTime = startTimeMs;

    while (retries >= 0) {
      while (Date.now() - currentStartTime < MAX_TIMEOUT) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        try {
          const msgsResponse: any = await this.app.callServerTool({
            name: 'privos.messages.getRecent',
            arguments: { roomId: this.roomId, limit: 10 }
          });
          
          let messages: any[] = [];
          const text = msgsResponse?.content?.[0]?.text;
          if (text) {
             const parsed = JSON.parse(text);
             messages = Array.isArray(parsed) ? parsed : [];
          }
          
          // Kiểm tra xem có bot trả lời không (tên có 'bot' hoặc 'privos')
          const botMsg = messages.find(m => {
            const msgTime = new Date(m.ts).getTime();
            const isBot = m.u?.username?.toLowerCase().includes('bot') || m.u?.username?.toLowerCase().includes('privos');
            return isBot && msgTime > sinceTimeMs;
          });
          
          if (botMsg) {
            return true; // Có phản hồi
          }
        } catch (err) {
          console.warn('Lỗi khi poll tin nhắn:', err);
        }
      }
      
      retries--;
      if (retries >= 0) {
        if (onLog) onLog(`[CẢNH BÁO] AI chưa phản hồi sau 30s. Đang thử chờ thêm lần cuối...`);
        currentStartTime = Date.now(); // Reset bộ đếm cho lần retry
      }
    }
    return false;
  }

  async uploadJD(file: File): Promise<any> {
    const dataUri = await this.readAsDataUri(file);

    if (this.cachedJdsFolderId === undefined) {
      await this.fetchAvailableJDs();
    }

    if (!this.cachedJdsFolderId) {
      throw new Error("Không tìm thấy thư mục 'jds' trong room. Hãy chắc chắn app đã tạo thư mục này.");
    }

    const existingJDs = await this.fetchAvailableJDs();
    const existingNames = new Set(existingJDs.map(f => f.name));

    let finalName = file.name;
    let counter = 1;
    const dotIndex = finalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? finalName.substring(0, dotIndex) : finalName;
    const extension = dotIndex !== -1 ? finalName.substring(dotIndex) : '';

    while (existingNames.has(finalName)) {
      finalName = `${baseName}(${counter})${extension}`;
      counter++;
    }

    const uploadPromise = this.app.uploadFile({
      channelId: this.roomId,
      fileName: finalName,
      folderId: this.cachedJdsFolderId,
      base64Data: dataUri,
      mimeType: file.type || 'text/markdown',
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Upload JD timeout sau 20s')), 20000)
    );

    const res: any = await Promise.race([uploadPromise, timeoutPromise]);
    
    return {
      _id: res?.file?._id || res?.file?.id || res?._id || res?.id,
      name: finalName
    };
  }

  async uploadCV(file: File): Promise<CVFile> {
    const dataUri = await this.readAsDataUri(file);

    // Tiền kiểm tra danh sách file hiện có để tránh lỗi DUPLICATE_FILE
    const existingFiles = await this.fetchAvailableFiles();
    const existingNames = new Set(existingFiles.map(f => f.name));

    let finalName = file.name;
    let counter = 1;

    const dotIndex = finalName.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? finalName.substring(0, dotIndex) : finalName;
    const extension = dotIndex !== -1 ? finalName.substring(dotIndex) : '';

    while (existingNames.has(finalName)) {
      finalName = `${baseName}(${counter})${extension}`;
      counter++;
    }

    const uploadPromise = this.app.uploadFile({
      channelId: this.roomId,
      fileName: finalName,
      base64Data: dataUri,
      mimeType: file.type || 'application/octet-stream',
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Upload timeout sau 20s (Có thể do file quá lớn gây nghẽn kết nối websocket)')), 20000)
    );

    const res: any = await Promise.race([uploadPromise, timeoutPromise]);

    const fileId = res?.file?._id || res?.file?.id;
    if (!fileId) throw new Error('Upload failed: No file ID returned.');

    // Không cần trích xuất text nữa vì AI sẽ tự đọc
    return {
      _id: fileId,
      name: finalName,
      size: file.size,
    };
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await restCall(this.app, 'POST', 'mcp.callTool', {
        body: {
          name: 'privos.files.delete',
          arguments: { fileId }
        }
      });
      return true;
    } catch (err) {
      console.error('Failed to delete file', err);
      return false;
    }
  }

  async renameFile(fileId: string, newName: string): Promise<boolean> {
    try {
      await restCall(this.app, 'POST', 'mcp.callTool', {
        body: {
          name: 'privos.files.update',
          arguments: { fileId, name: newName }
        }
      });
      return true;
    } catch (err) {
      console.error('Failed to rename file', err);
      return false;
    }
  }

  async processCV(
    cv: CVFile,
    updateStatus: (status: Partial<ProcessingStatus>) => void,
    jdContent: string,
    jdName: string,
    onLog?: (msg: string) => void
  ): Promise<void> {
    updateStatus({ status: 'renaming' });
    if (onLog) onLog(`Bắt đầu xử lý CV: ${cv.name}`);

    try {
      if (onLog) onLog(`[Bước 1-5] Gửi Prompt xử lý & chấm điểm CV (Nhúng logic HR CV Processor)...`);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentDate = new Date().toISOString().split('T')[0];
      const jdNameClean = jdName.replace(/[^a-zA-Z0-9]/g, '');
      const processorPrompt = `
        Hãy dùng skill cv-evaluator để chấm CV sau đây: @Files:${this.roomId}/${cv.name}

        THÔNG TIN HỆ THỐNG HIỆN TẠI:
        - Tháng hiện tại: ${currentMonth}
        - Ngày hiện tại: ${currentDate}
        - Tên báo cáo CSV cũ (đã bỏ, không dùng nữa).
        
        NHIỆM VỤ CỐT LÕI (BẮT BUỘC BẰNG MỌI GIÁ):
        1. Đổi tên chuẩn và COPY file gốc vào thư mục hr-miniapp/raws-cv/${currentMonth}/.
        2. Chấm điểm dựa trên JD bên dưới.
        3. Sinh và lưu file kết quả Markdown vào đúng thư mục trong outputs-cv.
        
        JD đối chiếu:
        <jd_content>
        ${jdContent}
        </jd_content>

        KHI HOÀN TẤT, BẠN BẮT BUỘC PHẢI TRẢ VỀ KẾT QUẢ VỚI ĐỊNH DẠNG JSON SAU ĐÂY CHO HỆ THỐNG UI CẬP NHẬT:
        \`\`\`json
        {
          "saved_file": "Tên-File-Da-Luu.md",
          "score": 10,
          "category": "ĐẠT" | "CÂN NHẮC" | "KHÔNG ĐẠT" | "KHÔNG TUYỂN VỊ TRÍ NÀY",
          "reason": "[lý do ngắn gọn]",
          "extracted_evidence": ["[trích dẫn 1]", "[trích dẫn 2]"]
        }
        \`\`\`
      `;

      const aiProcessRes = await this.askAI(processorPrompt, cv.name, cv._id, onLog);

      // Parse JSON from the response
      if (onLog) onLog(`[Đọc Kết Quả] Đang parse JSON để cập nhật UI...`);

      let result: any = { category: 'KHÔNG XÁC ĐỊNH', score: 0, reason: '' };
      const parsedScore = this.parseAIResponse(aiProcessRes.text);
      if (parsedScore) {
        result = { ...result, ...parsedScore };
      } else {
        result.reason = 'AI response could not be parsed as JSON.';
        if (onLog) onLog(`[DEBUG] RAW AI SCORE RESPONSE:\n${aiProcessRes.text.substring(0, 500)}...`);
      }

      // Parse <saved_file> or saved_file from JSON
      let newMdName = '';
      if (result.saved_file) {
        newMdName = result.saved_file;
      } else {
        const fileMatch = aiProcessRes.text.match(/<saved_file>\s*([\s\S]*?)\s*<\/saved_file>/i);
        if (fileMatch && fileMatch[1]) {
          newMdName = fileMatch[1].trim();
        } else {
          const fallbackMatch = aiProcessRes.text.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}_CV_[a-zA-Z0-9_]+\.md)/i);
          if (fallbackMatch && fallbackMatch[1]) {
            newMdName = fallbackMatch[1].trim();
          } else {
            throw new Error("AI không trả về tên file saved_file. Response: " + aiProcessRes.text.substring(0, 100));
          }
        }
      }

      if (onLog) onLog(`[Giữ nguyên File Gốc] AI đã tạo file MD: ${newMdName}`);

      // Lấy nội dung markdown trực tiếp từ AI response (In-memory approach)
      let extractedMarkdown = '';
      const mdMatch = aiProcessRes.text.match(/<markdown_content>\s*([\s\S]*?)\s*<\/markdown_content>/i);
      if (mdMatch && mdMatch[1]) {
        extractedMarkdown = mdMatch[1].trim();
        if (onLog) onLog(`[Email Debug] Đã trích xuất thành công nội dung Markdown trực tiếp từ AI response (${extractedMarkdown.length} ký tự).`);
      } else {
        if (onLog) onLog(`[Email Debug] ⚠ AI không trả về tag <markdown_content>! Sẽ phải fallback đọc từ đĩa.`);
      }

      updateStatus({
        normalizedName: newMdName,
        markdownContent: extractedMarkdown,
        status: 'scoring'
      }); // Vẫn giữ status scoring để UI hiện mượt

      let finalReason = result.reason || 'Processed successfully';

      if (result.extracted_evidence && Array.isArray(result.extracted_evidence)) {
        finalReason += '\n\n[BẰNG CHỨNG TỪ CV]\n- ' + result.extracted_evidence.join('\n- ');
      }

      updateStatus({
        status: 'completed',
        score: result.score || 0,
        category: result.category || 'KHÔNG XÁC ĐỊNH',
        reason: finalReason,
        markdownContent: extractedMarkdown
      });

    } catch (err: any) {
      if (onLog) onLog(`[LỖI] ${err.message}`);
      updateStatus({ status: 'error', errorMsg: err.message });
    }
  }

  private parseMarkdownResponse(text: string): { metadata: any, markdown: string } {
    let metadata: any = null;
    let markdown = '';

    try {
      const metaMatch = text.match(/<metadata>\s*(\{[\s\S]*?\})\s*<\/metadata>/i);
      if (metaMatch && metaMatch[1]) {
        metadata = JSON.parse(metaMatch[1]);
      }
    } catch (e) {
      console.warn('Failed to parse metadata block', e);
    }

    const mdMatch = text.match(/<markdown>\s*([\s\S]*?)\s*<\/markdown>/i);
    if (mdMatch && mdMatch[1]) {
      markdown = mdMatch[1].trim();
    } else {
      // Fallback: lay toan bo text neu khong co the markdown
      markdown = text.replace(/<metadata>[\s\S]*?<\/metadata>/i, '').trim();
    }

    return { metadata, markdown };
  }

  private parseAIResponse(text: string): any {
    try {
      const jsonBlocks = [...text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi)];
      if (jsonBlocks.length > 0) {
        for (let i = jsonBlocks.length - 1; i >= 0; i--) {
          try {
            return JSON.parse(jsonBlocks[i][1]);
          } catch (e) { }
        }
      }
      const objectBlocks = [...text.matchAll(/\{[\s\S]*?\}/g)];
      for (let i = objectBlocks.length - 1; i >= 0; i--) {
        try {
          return JSON.parse(objectBlocks[i][0]);
        } catch (e) { }
      }
    } catch (e) { }
    return null;
  }

  async askAI(content: string, fileName?: string, fileId?: string, onLog?: (msg: string) => void): Promise<{ text: string }> {

    let finalPrompt = content;

    // Nếu prompt không bắt đầu bằng tag Skill, bọc vào system_directives cũ
    if (!content.trim().startsWith('@')) {
      finalPrompt = `<system_directives>
  <role>
    You are an AI ASSISTANT acting as a DETERMINISTIC DATA EXTRACTOR. You have zero creativity. Your sole purpose is to parse explicitly provided text or read files using your tools as requested.
  </role>
  <zero_trust_rules>
    <rule>HALLUCINATION IS A CRITICAL FAILURE. If information is missing, you MUST output "NULL" or "Không xác định". Do not guess. Do not infer.</rule>
  </zero_trust_rules>
</system_directives>

<task_payload>
${content}
</task_payload>`;
    }

    if (onLog) onLog(`>> Đang gửi prompt cho AI xử lý file...`);
    const sent = await restCall<any>(this.app, 'POST', 'ai-messages.send', {
      body: {
        entityType: 'room-chat',
        entityId: this.roomId,
        roomId: this.roomId,
        flowChatId: this.roomId,
        content: finalPrompt,
        ...(fileId ? { fileIds: [fileId] } : {})
      },
      timeoutMs: 60000,
    });

    const sessionId = sent.sessionId;
    const aiMessageId = sent.aiMessage?._id;

    if (aiMessageId) {
      if (onLog) onLog(`>> Đã khởi tạo Session: ${sessionId}, Yêu cầu AI phản hồi...`);
      await restCall(this.app, 'POST', 'ai-messages.startGeneration', { body: { messageId: aiMessageId } });
    }

    // Tăng số lần lặp và thời gian chờ để đảm bảo AI có đủ thời gian đọc và xuất MD
    for (let i = 0; i < 150; i++) {
      await new Promise(r => setTimeout(r, 2000));

      let res;
      try {
        res = await restCall<any>(this.app, 'GET', 'ai-messages.list', {
          query: { sessionId, count: 20 }
        });
      } catch (err: any) {
        if (onLog) onLog(`>> Lỗi mạng tạm thời, đang thử lại... (Chi tiết: ${err.message || err})`);
        continue; // Bỏ qua lần lặp này và thử lại ở lần sau
      }

      const list = Array.isArray(res?.messages) ? res.messages : [];
      const aiMsg = [...list].reverse().find((m: any) => m.type === 'ai');

      if (aiMsg) {
        if (onLog) onLog(`>> Đang chờ (status = ${aiMsg.status})...`);
        if (['completed', 'failed', 'cancelled'].includes(aiMsg.status || '')) {
          if (onLog) onLog(`>> AI phản hồi hoàn tất!`);
          return { text: aiMsg.content || '' };
        }
      }
    }

    throw new Error('AI polling timeout');
  }

  async getMarkdownContent(normalizedName: string): Promise<string> {
    const baseName = normalizedName.split('/').pop()?.split('\\').pop() || normalizedName;

    // Tạo thêm một bản sanitize để đề phòng AI tự đổi tên file khi lưu
    const sanitizedBaseName = baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Đ/g, "D").replace(/đ/g, "d")
      .replace(/\s+/g, '_');

    console.log(`[Email Debug] Bắt đầu tìm file MD cho: ${normalizedName} (BaseName: ${baseName}, Sanitize: ${sanitizedBaseName})`);

    const fileMonthMatch = baseName.match(/^(\d{4}-\d{2})/);
    const fileMonth = fileMonthMatch ? fileMonthMatch[1] : new Date().toISOString().slice(0, 7);

    const processPaths = [
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/03-deep_reviewed/${baseName}`,
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/02-passed_screening/${baseName}`,
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/01-failed/${baseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/03-deep_reviewed/${baseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/02-passed_screening/${baseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/01-failed/${baseName}`,

      // Fallback: AI có thể đã tự đổi tên file
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/03-deep_reviewed/${sanitizedBaseName}`,
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/02-passed_screening/${sanitizedBaseName}`,
      `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/01-failed/${sanitizedBaseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/03-deep_reviewed/${sanitizedBaseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/02-passed_screening/${sanitizedBaseName}`,
      `hr-miniapp/outputs-cv/${fileMonth}/01-failed/${sanitizedBaseName}`,
    ];
    for (const path of processPaths) {
      console.log(`[Email Debug] Đang thử lấy nội dung từ đường dẫn: ${path}`);
      const content = await getFileContent(this.app, path);
      if (content && content.trim().length > 0) {
        console.log(`[Email Debug] ĐÃ TÌM THẤY file tại: ${path} (Độ dài: ${content.length} ký tự)`);
        return content;
      }
    }
    console.warn(`[Email Debug] ⚠ KHÔNG TÌM THẤY file MD nào cho: ${normalizedName}.`);

    // Thử list các file trong thư mục để xem AI đã thực sự tạo ra những file gì
    try {
      const listPass: any = await this.app.rest({ method: 'GET', path: 'api/files/list', query: { path: `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/02-passed_screening` } });
      const listFail: any = await this.app.rest({ method: 'GET', path: 'api/files/list', query: { path: `${this.roomId}/hr-miniapp/outputs-cv/${fileMonth}/01-failed` } });
      console.log(`[Email Debug] DANH SÁCH CÁC FILE ĐANG CÓ TRONG 02-passed_screening/:`, listPass?.body?.files || listPass?.files);
      console.log(`[Email Debug] DANH SÁCH CÁC FILE ĐANG CÓ TRONG 01-failed/:`, listFail?.body?.files || listFail?.files);
    } catch (e: any) {
      console.error(`[Email Debug] Không thể lấy danh sách file:`, e.message);
    }

    return '';
  }

  private async readAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private getExt(filename: string): string {
    const i = filename.lastIndexOf('.');
    return i >= 0 ? filename.slice(i) : '';
  }

  /**
   * Tạo một List Kanban và lưu toàn bộ kết quả CV vào các stage phù hợp sau khi chấm điểm xong đợt.
   * Được gọi từ UI sau khi toàn bộ CV đã được chấm xong.
   */
  async createKanbanBatchViaAI(
    results: Array<{ originalName: string; normalizedName?: string; score?: number; category?: string; reason?: string }>,
    jdName: string,
    onLog?: (msg: string) => void
  ): Promise<void> {
    if (results.length === 0) return;

    const currentDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    const listName = `${currentDateStr}_SCREENING`;
    const fieldDefinitions = [
      { _id: 'tong_diem', name: 'Tổng điểm', type: 'NUMBER' },
      { _id: 'phan_loai', name: 'Phân loại', type: 'TEXT' },
      { _id: 'ly_do', name: 'Lý do', type: 'TEXTAREA' },
    ];
    const stages = [
      { name: '01_Dau_Vao', color: '#6b7280' },
      { name: '02_Loai_CV', color: '#ef4444' },
      { name: '03_Tiem_Nang', color: '#22c55e' },
      { name: '04_Phone_Screening', color: '#3b82f6' },
      { name: '05_Moi_Phong_Van', color: '#8b5cf6' },
      { name: '06_Cho_Ket_Qua', color: '#f59e0b' },
      { name: '07_Gui_Offer', color: '#10b981' },
      { name: '08_Dau_Nhan_Viec', color: '#059669' },
      { name: '09_Loai_Sau_PV', color: '#dc2626' },
    ];

    const parseToolResponse = (res: any) => {
      const text = res?.content?.[0]?.text;
      if (typeof text === 'string') {
        try { return JSON.parse(text); }
        catch { return res; }
      }
      return res;
    };

    const normalizeCategory = (category?: string) =>
      (category || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Đ/g, 'D')
        .trim();

    const getTargetStageName = (category?: string) => {
      const normalized = normalizeCategory(category);
      if (normalized.includes('KHONG DAT') || normalized.includes('KHONG TUYEN')) return '02_Loai_CV';
      if (normalized === 'DAT' || normalized.includes('CAN NHAC')) return '03_Tiem_Nang';
      return '01_Dau_Vao';
    };

    if (onLog) onLog(`[Kanban] Đang tạo List Kanban "${listName}" với ${results.length} CV...`);
    try {
      const createRes = parseToolResponse(await this.app.callServerTool({
        name: 'privos.lists.create',
        arguments: {
          roomId: this.roomId,
          name: listName,
          description: `Kết quả chấm CV theo JD: ${jdName || 'Không xác định'}`,
          fieldDefinitions,
          stages,
        }
      }));

      const listId = createRes?.list?._id || createRes?.listId || createRes?._id;
      const createdStages = createRes?.stages || createRes?.list?.stages || [];
      if (!listId) throw new Error('Không lấy được listId sau khi tạo Kanban.');
      if (!Array.isArray(createdStages) || createdStages.length === 0) {
        throw new Error('Không lấy được danh sách stage sau khi tạo Kanban.');
      }

      const stageIdByName = Object.fromEntries(createdStages.map((stage: any) => [stage.name, stage._id]));
      const items = results.map((r) => {
        const stageName = getTargetStageName(r.category);
        const stageId = stageIdByName[stageName] || stageIdByName['01_Dau_Vao'];
        if (!stageId) throw new Error(`Không tìm thấy stageId cho stage ${stageName}.`);
        return {
          title: r.normalizedName || r.originalName,
          description: r.reason || '',
          stageId,
          customFields: [
            { fieldId: 'tong_diem', value: r.score ?? 0 },
            { fieldId: 'phan_loai', value: r.category || 'KHÔNG XÁC ĐỊNH' },
            { fieldId: 'ly_do', value: r.reason || '' },
          ],
        };
      });

      const batchRes = parseToolResponse(await this.app.callServerTool({
        name: 'privos.lists.batchCreateItems',
        arguments: { listId, items }
      }));

      const createdCount = batchRes?.created ?? batchRes?.items?.length ?? items.length;
      if (onLog) onLog(`[Kanban] ✅ Đã tạo List "${listName}" và lưu ${createdCount} thẻ ứng viên vào đúng stage.`);
    } catch (err: any) {
      if (onLog) onLog(`[Kanban] Lỗi khi tạo Kanban: ${err.message}`);
      throw err;
    }
  }
}
