import { McpApp } from '@privos/app-react';
import { restCall, getFileContent, createOrUpdateFile } from './privos-rest';
import { IScreeningStrategy } from './screening-strategy';
import { ICvContextBuilder } from './cv-context-builder';

export interface CVFile {
  _id: string;
  name: string;
  size?: number;
  downloadUrl?: string;
  rawText?: string;
}

export interface ProcessingStatus {
  fileId: string;
  originalName: string;
  normalizedName?: string;
  status: 'pending' | 'renaming' | 'scoring' | 'completed' | 'error';
  score?: number;
  category?: string;
  reason?: string;
  errorMsg?: string;
}

export class PipelineService {
  private app: McpApp;
  private roomId: string;
  private strategy: IScreeningStrategy;
  private contextBuilder: ICvContextBuilder;

  constructor(app: McpApp, roomId: string, strategy: IScreeningStrategy, contextBuilder: ICvContextBuilder) {
    this.app = app;
    this.roomId = roomId;
    this.strategy = strategy;
    this.contextBuilder = contextBuilder;
  }

  async fetchAvailableFiles(): Promise<CVFile[]> {
    const body = await restCall<any>(this.app, 'GET', `file-management.files.channel/${this.roomId}`, {
      query: { count: 50 },
      timeoutMs: 15000 // Thêm timeout 15s để tránh treo app khi file list quá lớn hoặc rớt mạng
    });
    const list = body?.files ?? body?.data ?? (Array.isArray(body) ? body : []);
    return list.map((f: any) => ({
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
      // BƯỚC 1-5: Gọi trực tiếp Skill @hr-cv-processor của PrivOS AI
      if (onLog) onLog(`[Bước 1-5] Gửi Prompt tự động xử lý CV (Nhúng logic HR CV Processor)...`);
      const processorPrompt = `
        # YÊU CẦU XỬ LÝ CV
        Thực hiện ĐÚNG 5 bước theo Hướng dẫn: @Files:6a2fd032670a67e0f437dc08/cv_processing_guidelines.md

        1. Copy CV gốc vào \`RoomFiles/hr-miniapp/raws-cv/\`
        2. Đọc file text auto-parse tương ứng.
        3. Chấm điểm theo JD: ${jdName}
        4. Lưu kết quả (MD) vào \`RoomFiles/hr-miniapp/outputs-cv/\` (chống trùng lặp).
        5. Append kết quả vào CSV (BẮT BUỘC CHỈ CÓ ĐÚNG 4 CỘT: Vị trí, Tổng điểm, Kết quả, Đường dẫn MD): \`RoomFiles/hr-miniapp/outputs-cv/[YYYY-MM-DD]_KetQua_${jdName.replace(/\.[^/.]+$/, "")}.csv\`

        [TIÊU CHUẨN JD]
        ${jdContent}

        KHI HOÀN TẤT, TRẢ VỀ: <saved_file>Tên-File-Da-Luu.md</saved_file>
        File CV cần xử lý: @Files:${this.roomId}/hr-miniapp/cv-lon-xon/${cv.name}
        `;

      const aiProcessRes = await this.askAI(processorPrompt, cv.name, cv._id, onLog);

      // Parse <saved_file>
      let newMdName = '';
      const fileMatch = aiProcessRes.text.match(/<saved_file>\s*([\s\S]*?)\s*<\/saved_file>/i);
      if (fileMatch && fileMatch[1]) {
        newMdName = fileMatch[1].trim();
      } else {
        // Fallback: Thử tìm một tên file MD chuẩn trong response
        const fallbackMatch = aiProcessRes.text.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}_CV_[a-zA-Z0-9_]+\.md)/i);
        if (fallbackMatch && fallbackMatch[1]) {
          newMdName = fallbackMatch[1].trim();
        } else {
          throw new Error("AI không trả về tên file <saved_file>. Response: " + aiProcessRes.text.substring(0, 100));
        }
      }

      if (onLog) onLog(`[Giữ nguyên File Gốc] AI đã tạo file MD: ${newMdName}`);
      updateStatus({ normalizedName: newMdName, status: 'scoring' });

      // Lấy nội dung file MD chuẩn từ outputs-cv để chấm điểm
      if (onLog) onLog(`[Đọc File] Đang tải ${newMdName} từ outputs-cv để trích xuất JSON lên giao diện...`);

      let finalMarkdown = '';
      const processPaths = [
        `${this.roomId}/hr-miniapp/outputs-cv/${newMdName}`,
        `hr-miniapp/outputs-cv/${newMdName}`
      ];

      for (const path of processPaths) {
        finalMarkdown = await getFileContent(this.app, path);
        if (finalMarkdown && finalMarkdown.trim().length > 0) break;
      }

      if (!finalMarkdown || finalMarkdown.trim().length === 0) {
        if (onLog) onLog(`[CẢNH BÁO] Không đọc được nội dung từ outputs-cv. Dùng tạm nội dung AI sinh ra...`);
        finalMarkdown = aiProcessRes.text;
      }
      // TODO: Thêm hàm xóa file ẩn nếu cần, hiện tại API createOrUpdateFile đã ghi file mới.

      // BƯỚC 5: Đánh giá & Chấm điểm
      if (onLog) onLog(`[Bước 5] Chấm điểm...`);
      const cvContext = `<cv_data>\n${finalMarkdown}\n</cv_data>`;
      const scoringPrompt = this.strategy.getScoringPrompt(cvContext, jdContent);
      const aiScoreRes = await this.askAI(scoringPrompt, cv.name, undefined, onLog);

      let result: any = { category: 'KHÔNG XÁC ĐỊNH', score: 0, reason: '' };
      const parsedScore = this.parseAIResponse(aiScoreRes.text);
      if (parsedScore) {
        result = { ...result, ...parsedScore };
      } else {
        result.reason = 'AI response could not be parsed as JSON.';
        if (onLog) onLog(`[DEBUG] RAW AI SCORE RESPONSE:\n${aiScoreRes.text.substring(0, 500)}...`);
      }

      let finalReason = result.reason || 'Processed successfully';

      if (result.extracted_evidence && Array.isArray(result.extracted_evidence)) {
        finalReason += '\n\n[BẰNG CHỨNG TỪ CV]\n- ' + result.extracted_evidence.join('\n- ');
      }

      updateStatus({
        status: 'completed',
        score: result.score || 0,
        category: result.category || 'KHÔNG XÁC ĐỊNH',
        reason: finalReason
      });

    } catch (err: any) {
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
      const res = await restCall<any>(this.app, 'GET', 'ai-messages.list', {
        query: { sessionId, count: 20 }
      });
      const list = Array.isArray(res.messages) ? res.messages : [];
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

  private readAsDataUri(file: File): Promise<string> {
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
