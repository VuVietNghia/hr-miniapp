import { McpApp } from '@privos/app-react';
import { restCall, getFileContent, createOrUpdateFile, ensureFolderPath } from './privos-rest';
import { ICvContextBuilder } from './cv-context-builder';
import cvProcessingGuidelinesRaw from './data/cv_processing_guidelines.md?raw';
import cvMdTemplateRaw from './data/cv_md_template.md?raw';
import sangLocCvRaw from './data/sang_loc_cv.md?raw';
import cvEvaluatorSkillRaw from './data/cv-evaluator-skill.md?raw';
import jdTemplateRaw from './data/jd_template.md?raw';

// ─── Cấu hình 3 List cố định ──────────────────────────────────────────────────
export const DEFAULT_CV_LISTS = [
  {
    name: 'CV_DEV',
    sentinelTitle: 'cv dev',
    description: 'IT/Lập trình/Phát triển phần mềm/Backend/Frontend/DevOps/Data',
  },
  {
    name: 'CV_HR',
    sentinelTitle: 'cv hr',
    description: 'Nhân sự/HR/Tuyển dụng/Đào tạo/C&B',
  },
  {
    name: 'CV_Marketing',
    sentinelTitle: 'cv marketing',
    description: 'Marketing/Truyền thông/Quảng cáo/Branding/SEO/Content',
  },
] as const;

const DEFAULT_STAGES = [
  { name: '01_Dau_Vao',        color: '#6b7280' },
  { name: '02_Loai_CV',        color: '#ef4444' },
  { name: '03_Tiem_Nang',      color: '#22c55e' },
  { name: '04_Phone_Screening',color: '#3b82f6' },
  { name: '05_Moi_Phong_Van',  color: '#f59e0b' },
  { name: '06_Cho_Ket_Qua',    color: '#8b5cf6' },
  { name: '07_Gui_Offer',      color: '#06b6d4' },
  { name: '08_Dau_Nhan_Viec',  color: '#10b981' },
  { name: '09_Loai_Sau_PV',    color: '#6b7280' },
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
    await checkAndUpload(evaluatorSkillPath, cvEvaluatorSkillRaw, true);
    await checkAndUpload(jdTemplatePath, jdTemplateRaw, false);

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

  /**
   * Đảm bảo 3 list cố định CV_DEV / CV_HR / CV_Marketing tồn tại trong room.
   * App chạy với quyền user nên có thể gọi privos.lists.getAll/create bình thường.
   * Bot AI không có quyền getAll → app lưu listId+stageMap vào file JSON để AI đọc trực tiếp.
   */
  async ensureDefaultLists(onLog?: (msg: string) => void): Promise<void> {
    try {
      if (onLog) onLog('[Lists] Đang kiểm tra 3 list cố định...');

      // 1. Lấy danh sách list hiện có (app chạy với quyền user, có thể getAll)
      const getAllRes: any = await this.app.callServerTool({
        name: 'privos.lists.getAll',
        arguments: { roomId: this.roomId },
      });
      let existingLists: any[] = [];
      const getAllText = getAllRes?.content?.[0]?.text;
      if (getAllText) {
        const parsed = JSON.parse(getAllText);
        existingLists = Array.isArray(parsed) ? parsed : (parsed?.lists ?? []);
      }
      const existingMap = new Map(existingLists.map((l: any) => [String(l.name), l]));

      // Config sẽ được lưu ra file để AI đọc
      const listConfig: Record<string, { listId: string; stageMap: Record<string, string> }> = {};

      // 2. Xử lý từng list
      for (const listDef of DEFAULT_CV_LISTS) {
        const existing = existingMap.get(listDef.name);

        if (existing) {
          if (onLog) onLog(`[Lists] ✓ List "${listDef.name}" đã tồn tại (ID: ${existing._id}).`);

          // Đọc description của list đã có để lấy STAGE_MAP
          let stageMap: Record<string, string> = {};
          try {
            const getRes: any = await this.app.callServerTool({
              name: 'privos.lists.get',
              arguments: { listId: existing._id },
            });
            const getText = getRes?.content?.[0]?.text;
            if (getText) {
              const listData = JSON.parse(getText);
              const desc: string = listData?.description ?? '';
              const mapMatch = desc.match(/STAGE_MAP:(\{[^}]+(?:\}[^}]*)*\})/);
              if (mapMatch) {
                try { stageMap = JSON.parse(mapMatch[1]); } catch { /* ignore */ }
              }
            }
          } catch (e) {
            console.warn(`[Lists] Không đọc được description của ${listDef.name}:`, e);
          }

          // Nếu STAGE_MAP bị rỗng (list cũ chưa có), tạo lại từ các stages mặc định
          if (Object.keys(stageMap).length === 0) {
            if (onLog) onLog(`[Lists] ⚠ List "${listDef.name}" chưa có STAGE_MAP. Đang ghi lại...`);
            // Lấy stages bằng cách đầu tiên lấy 1 item trong list rồi đối chiếu
            // Hoặc tạo lại stages mặc định theo thứ tự đã biết
            const rebuildRes: any = await this.app.callServerTool({
              name: 'privos.lists.getItems',
              arguments: { listId: existing._id, count: 100 },
            });
            const rebuildText = rebuildRes?.content?.[0]?.text;
            if (rebuildText) {
              const rebuildData = JSON.parse(rebuildText);
              const items: any[] = rebuildData?.items ?? [];
              // Thu thập unique stageIds từ items
              const seenStageIds = [...new Set(items.map((it: any) => it.stageId).filter(Boolean))];
              // Ánh xạ thủ công: không biết tên → chỉ lấy first stage (01_Dau_Vao)
              if (seenStageIds.length > 0) {
                stageMap['01_Dau_Vao'] = seenStageIds[0];
              }
            }
          }

          listConfig[listDef.name] = { listId: existing._id, stageMap };
          continue;
        }

        // List chưa có → tạo mới
        if (onLog) onLog(`[Lists] Đang tạo list "${listDef.name}"...`);

        const createRes: any = await this.app.callServerTool({
          name: 'privos.lists.create',
          arguments: {
            roomId: this.roomId,
            name: listDef.name,
            description: listDef.description,
            stages: DEFAULT_STAGES,
          },
        });
        const createText = createRes?.content?.[0]?.text;
        if (!createText) {
          if (onLog) onLog(`[Lists] ⚠ Không đọc được response khi tạo "${listDef.name}".`);
          continue;
        }
        const created = JSON.parse(createText);
        const listId: string = created?.list?._id;
        const stages: any[] = created?.stages ?? [];

        if (!listId || stages.length === 0) {
          if (onLog) onLog(`[Lists] ⚠ Tạo "${listDef.name}" thành công nhưng thiếu listId/stages.`);
          continue;
        }

        // Xây dựng STAGE_MAP từ stages response
        const stageMap: Record<string, string> = {};
        for (const s of stages) {
          stageMap[s.name] = s._id;
        }

        // Ghi STAGE_MAP vào description của list
        const descriptionWithMap = `${listDef.description}\nSTAGE_MAP:${JSON.stringify(stageMap)}`;
        await this.app.callServerTool({
          name: 'privos.lists.updateList',
          arguments: { listId, description: descriptionWithMap },
        });

        // Tạo sentinel item ở stage 01_Dau_Vao để AI nhận dạng
        const firstStageId = stageMap['01_Dau_Vao'] ?? stages[0]?._id;
        if (firstStageId) {
          await this.app.callServerTool({
            name: 'privos.lists.createItem',
            arguments: {
              listId,
              title: listDef.sentinelTitle,
              stageId: firstStageId,
              description: `[SENTINEL] Đây là item nhận dạng list ${listDef.name}. Không xóa.`,
            },
          });
        }

        listConfig[listDef.name] = { listId, stageMap };
        if (onLog) onLog(`[Lists] ✓ Đã tạo list "${listDef.name}" với ${stages.length} stages.`);
      }

      // 3. Lưu config (listId + stageMap) ra file JSON để AI đọc trực tiếp
      //    Bot không có quyền getAll → AI sẽ đọc file này thay vì gọi API
      if (Object.keys(listConfig).length > 0) {
        const configPath = `${this.roomId}/hr-miniapp/skills/cv_list_config.json`;
        const configContent = JSON.stringify(listConfig, null, 2);
        await createOrUpdateFile(this.app, configPath, configContent);
        if (onLog) onLog(`[Lists] ✓ Đã lưu config list IDs vào: hr-miniapp/skills/cv_list_config.json`);
      }

      if (onLog) onLog('[Lists] Hoàn tất kiểm tra 3 list cố định.');
    } catch (err: any) {
      console.error('[Lists] Lỗi khi ensureDefaultLists:', err);
      if (onLog) onLog(`[Lists] ⚠ Lỗi: ${err.message}`);
    }
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
      // 1. Resolve and cache jds folderId
      if (this.cachedJdsFolderId === undefined) {
        if (onLog) onLog(`[DEBUG] Đang tra cứu ID của thư mục jds...`);
        const foldersResponse: any = await this.app.callServerTool({
          name: 'privos.folders.search',
          arguments: { channelId: this.roomId, query: 'jds' }
        });

        let list: any[] = [];
        const text = foldersResponse?.content?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          list = Array.isArray(parsed) ? parsed : (parsed?.folders || []);
        }

        const jdsFolder = list.find((f: any) => f.name?.toLowerCase() === 'jds');
        this.cachedJdsFolderId = jdsFolder?._id || null;
        if (onLog) onLog(`[DEBUG] Đã tìm thấy ID thư mục jds: ${this.cachedJdsFolderId}`);
      }

      if (!this.cachedJdsFolderId) {
        if (onLog) onLog(`[CẢNH BÁO] Không tìm thấy thư mục jds trong phòng. Vui lòng tạo thư mục hr-miniapp/jds.`);
        console.warn('Không tìm thấy thư mục jds.');
        return [];
      }

      // 2. Fetch files directly from jds folder
      if (onLog) onLog(`[DEBUG] Đang fetch files từ thư mục jds...`);
      const filesResponse: any = await this.app.callServerTool({
        name: 'privos.files.getByChannel',
        arguments: { channelId: this.roomId, folderId: this.cachedJdsFolderId }
      });

      let files: any[] = [];
      const filesText = filesResponse?.content?.[0]?.text;
      if (filesText) {
        const parsed = JSON.parse(filesText);
        files = Array.isArray(parsed) ? parsed : (parsed?.files || []);
      }
      
      if (onLog) onLog(`[DEBUG] Tìm thấy ${files.length} files trong thư mục jds.`);

      // 3. Map kết quả cho UI
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
        Hãy dùng skill cv-evaluator để chấm CV sau đây: @Files:${this.roomId}/hr-miniapp/cv-lon-xon/${cv.name}

        THÔNG TIN HỆ THỐNG HIỆN TẠI:
        - Tháng hiện tại: ${currentMonth}
        - Ngày hiện tại: ${currentDate}
        - Tên báo cáo CSV cũ (đã bỏ, không dùng nữa).
        
        NHIỆM VỤ CỐT LÕI (BẮT BUỘC BẰNG MỌI GIÁ):
        1. Đổi tên chuẩn và COPY file gốc vào thư mục hr-miniapp/raws-cv/${currentMonth}/.
        2. Chấm điểm dựa trên JD bên dưới.
        3. Sinh và lưu file kết quả Markdown vào đúng thư mục trong outputs-cv.
        4. BẮT BUỘC phải TẠO THẺ ỨNG VIÊN TRÊN BẢNG KANBAN (PrivOS Lists) theo đúng hướng dẫn trong skill.
        
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

  async askAI(content: string, fileName: string, fileId?: string, onLog?: (msg: string) => void): Promise<{ text: string }> {

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

    // Poll tối đa 10 phút (300 * 2s) để AI có đủ thời gian xử lý file lớn
    for (let i = 0; i < 300; i++) {
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
