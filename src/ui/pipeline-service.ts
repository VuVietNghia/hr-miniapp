import { McpApp } from '@privos/app-react';
import { restCall } from './privos-rest';
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
    const body = await restCall<any>(this.app, 'GET', `file-management.files.channel/${this.roomId}`);
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
    const res: any = await this.app.uploadFile({
      channelId: this.roomId,
      fileName: file.name,
      base64Data: dataUri,
      mimeType: file.type || 'application/octet-stream',
    });
    const fileId = res?.file?._id || res?.file?.id;
    if (!fileId) throw new Error('Upload failed: No file ID returned.');
    
    // Không cần trích xuất text nữa vì AI sẽ tự đọc
    return {
      _id: fileId,
      name: file.name,
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

  async processSingleCV(
    cv: CVFile,
    updateStatus: (status: Partial<ProcessingStatus>) => void,
    jdContent: string,
    onLog?: (msg: string) => void
  ): Promise<void> {
    updateStatus({ status: 'renaming' });
    if (onLog) onLog(`Bắt đầu xử lý CV: ${cv.name}`);
    
    try {
      const cvContext = this.contextBuilder.buildContext(this.roomId, cv.name);
      if (onLog) onLog(`Sinh Context đường dẫn file: ${cv.name}...`);
    
      // BƯỚC 1: Chuẩn hóa tên file (Sử dụng Dependency Injection Strategy)
      if (onLog) onLog(`[Bước 1] Chuẩn hóa tên file gốc...`);
      const renamePrompt = this.strategy.getRenamePrompt(cvContext);
      const aiRenameRes = await this.askAI(renamePrompt, cv.name, onLog);
      
      let cleanName = '';
      const filenameMatch = aiRenameRes.text.match(/<filename>(.*?)<\/filename>/i);
      if (filenameMatch && filenameMatch[1]) {
        cleanName = filenameMatch[1].trim();
      } else {
        // Fallback: lay tu cuoi cung hoac loc bo nhung tu thua
        cleanName = aiRenameRes.text.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      }
      
      const normalizedName = cleanName + this.getExt(cv.name);
      
      // Thực sự đổi tên file trên PrivOS database
      if (onLog) onLog(`Gọi API đổi tên file thành: ${normalizedName}...`);
      await this.renameFile(cv._id, normalizedName);
      
      updateStatus({ normalizedName, status: 'scoring' });

      // BƯỚC 2 & 3: Chuyển sang MD và Sàng lọc (Tiêm phụ thuộc JD Content)
      if (onLog) onLog(`[Bước 2] Phân tích nội dung và chấm điểm...`);
      const scoringPrompt = this.strategy.getScoringPrompt(cvContext, jdContent);
      const aiScoreRes = await this.askAI(scoringPrompt, cv.name, onLog);
      
      // Parse JSON from output
      let result: any = { markdown: '', category: 'KHÔNG XÁC ĐỊNH', score: 0, reason: '' };
      try {
        // Lấy tất cả các block ```json ... ```
        const jsonBlocks = [...aiScoreRes.text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi)];
        let parsed = false;
        
        // Thử parse từ block cuối cùng (thường là câu trả lời cuối)
        if (jsonBlocks.length > 0) {
          for (let i = jsonBlocks.length - 1; i >= 0; i--) {
            try {
              const data = JSON.parse(jsonBlocks[i][1]);
              if (data.category !== undefined || data.markdown !== undefined || data.score !== undefined) {
                result = { ...result, ...data };
                parsed = true;
                break;
              }
            } catch (e) {}
          }
        }
        
        // Nếu không có block markdown json, thử tìm object {} cuối cùng
        if (!parsed) {
          const objectBlocks = [...aiScoreRes.text.matchAll(/\{[\s\S]*?\}/g)];
          for (let i = objectBlocks.length - 1; i >= 0; i--) {
            try {
              const data = JSON.parse(objectBlocks[i][0]);
              if (data.category !== undefined || data.markdown !== undefined || data.score !== undefined) {
                result = { ...result, ...data };
                parsed = true;
                break;
              }
            } catch (e) {}
          }
        }

        if (!parsed) {
           if (onLog) onLog(`[DEBUG AI] Response không chứa JSON:\n${aiScoreRes.text.substring(0, 300)}...`);
           throw new Error("No JSON found in response");
        }
        
      } catch (e) {
        console.warn('Failed to parse AI JSON', e);
        result.reason = 'AI response could not be parsed. Error: ' + String(e);
      }
      
      let finalReason = result.reason || 'Processed successfully';
      
      // Chặn và cảnh báo nếu AI không đọc từ thẻ rawText
      if (result.verification && String(result.verification.text_analyzed).toLowerCase().includes('no')) {
         finalReason = '⚠️ AI TỪ CHỐI ĐỌC DỮ LIỆU TEXT!\n' + finalReason;
         result.category = 'LỖI ĐỌC NHẦM TEXT';
         result.score = 0;
      }

      if (result.extracted_evidence && Array.isArray(result.extracted_evidence)) {
        finalReason += '\n\n[BẰNG CHỨNG TỪ CV]\n- ' + result.extracted_evidence.join('\n- ');
      }

      // Xóa file CV gốc sau khi lấy dữ liệu xong
      await this.deleteFile(cv._id);

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

  private async askAI(content: string, fileName: string, onLog?: (msg: string) => void): Promise<{text: string}> {
    
    const finalPrompt = `<system_directives>
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

    if (onLog) onLog(`>> Đang gửi prompt cho AI xử lý file...`);
    const sent = await restCall<any>(this.app, 'POST', 'ai-messages.send', {
      body: {
        entityType: 'room-chat',
        entityId: this.roomId,
        roomId: this.roomId,
        flowChatId: this.roomId,
        content: finalPrompt
        // fileIds: [fileId] // Xóa fileIds để AI không dùng tool đọc file nữa
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
    for (let i = 0; i < 60; i++) {
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
