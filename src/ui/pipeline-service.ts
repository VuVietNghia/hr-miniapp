import { McpApp } from '@privos/app-react';
import { restCall, getFileContent, createOrUpdateFile, ensureFolderPath } from './privos-rest';
import { ICvContextBuilder } from './cv-context-builder';
import cvProcessingGuidelinesRaw from './data/cv_processing_guidelines.md?raw';
import cvMdTemplateRaw from './data/cv_md_template.md?raw';
import sangLocCvRaw from './data/sang_loc_cv.md?raw';

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

  try {
    // Chạy tuần tự thay vì Promise.all để tránh race condition khi tạo folder
    await checkAndUpload(guidelinePath, cvProcessingGuidelinesRaw, true);
    await checkAndUpload(templatePath, cvMdTemplateRaw, false);
    await checkAndUpload(sangLocPath, sangLocCvRaw, false);
    
    // Tự động tạo sẵn thư mục raws-cv và outputs-cv
    try {
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'raws-cv']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục raws-cv`);
      await ensureFolderPath(app, roomId, ['hr-miniapp', 'outputs-cv']);
      console.log(`[DEBUG] Đã đảm bảo tồn tại thư mục outputs-cv`);
    } catch (e) {
      console.error(`[CẢNH BÁO] Không thể tạo thư mục gốc cho CV:`, e);
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
      const processorPrompt = `
        Hãy dùng skill cv-evaluator để chấm CV sau đây: @Files:${this.roomId}/hr-miniapp/cv-lon-xon/${cv.name}

        JD đối chiếu:
        <jd_content>
        ${jdContent}
        </jd_content>

        KHI HOÀN TẤT, BẠN BẮT BUỘC PHẢI TRẢ VỀ KẾT QUẢ VỚI ĐỊNH DẠNG JSON SAU ĐÂY CHO HỆ THỐNG ĐỌC:
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

  private async askAI(content: string, fileName: string, fileId?: string, onLog?: (msg: string) => void): Promise<{ text: string }> {

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
}
