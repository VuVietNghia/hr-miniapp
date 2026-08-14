import { McpApp } from '@privos/app-react';
import { EmployeeProfile, ILifecycleService, PassedCandidate } from '../types';

export class PrivOSLifecycleService implements ILifecycleService {
  private static readonly LIST_IDENTIFIERS = ['nhan-su', 'nhansu', 'employee', 'lifecycle', 'hồ sơ'];
  private static readonly SYSTEM_CONFIG_NAME = '[Hệ thống] Không xoá - Cấu hình Kanban';
  private static readonly DEFAULT_STAGE = 'Mới nhận việc';

  constructor(private app: McpApp) { }

  async loadProfiles(roomId: string): Promise<EmployeeProfile[]> {
    try {
      const list = await this.ensureValidList(roomId);
      if (!list) return [];

      const items = await this.fetchListItems(list._id || list.id);
      const fieldDefMap = this.createFieldDefinitionMap(list.fieldDefinitions);

      // Filter out system items and map to EmployeeProfile
      return items
        .filter(item => !this.isSystemConfigItem(item))
        .map(item => this.mapItemToProfile(item, list, fieldDefMap));
    } catch (err) {
      console.error('[PrivOSLifecycleService] Error loading profiles:', err);
      return [];
    }
  }

  async loadPassedCandidates(roomId: string): Promise<PassedCandidate[]> {
    try {
      const allLists = await this.fetchAllLists(roomId);
      const screeningLists = allLists.filter(list => this.isScreeningList(list));

      console.log(`[PrivOSLifecycleService] Found ${allLists.length} lists in room, ${screeningLists.length} candidate lists:`,
        screeningLists.map(l => l.name)
      );

      if (screeningLists.length === 0) return [];

      const candidatesPromises = screeningLists.map(async (list) => {
        const listId = list._id || list.id;
        let stages = list.stages;
        if (!Array.isArray(stages) || stages.length === 0) {
          stages = await this.fetchListStages(listId);
        }

        const items = await this.fetchListItems(listId);
        const validItems = items.filter(item => !this.isSystemConfigItem(item));
        const passedItems = validItems.filter(item => this.isPassedCandidateItem(item, stages));

        console.log(`[PrivOSLifecycleService] List "${list.name}" (${listId}): ${validItems.length} total items, ${passedItems.length} stage 05+ candidates`);

        return passedItems.map(item => this.mapItemToPassedCandidate(item, { ...list, stages }));
      });

      const candidatesNested = await Promise.all(candidatesPromises);
      const allCandidates = candidatesNested.flat();

      console.log(`[PrivOSLifecycleService] Total loaded passed candidates (Stage 05+): ${allCandidates.length}`);

      // Sort by score descending (highest score first)
      return allCandidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } catch (err) {
      console.error('[PrivOSLifecycleService] Error loading passed candidates:', err);
      return [];
    }
  }

  private async getOrCreateFolder(roomId: string, folderName: string, parentId: string | null): Promise<string | null> {
    try {
      const parentQuery = parentId ? { folderId: parentId } : { channelId: roomId };
      const toolName = parentId ? 'privos.folders.getContent' : 'privos.folders.getRootContent';

      const contentRes: any = await this.app.callServerTool({
        name: toolName,
        arguments: parentQuery
      });
      const contentData = JSON.parse(contentRes?.content?.[0]?.text || '{"folders":[]}');
      const folder = contentData.folders?.find((f: any) => f.name.toLowerCase() === folderName.toLowerCase());

      if (folder) {
        return folder._id || folder.id;
      } else {
        const createArgs: any = { channelId: roomId, name: folderName };
        if (parentId) createArgs.parentId = parentId;

        const createRes: any = await this.app.callServerTool({
          name: 'privos.folders.create',
          arguments: createArgs
        });
        const createdFolder = JSON.parse(createRes?.content?.[0]?.text || '{}');
        return createdFolder._id || createdFolder.id;
      }
    } catch (err) {
      console.warn(`[PrivOSLifecycleService] Lỗi tạo folder ${folderName}:`, err);
      return null;
    }
  }

  private async ensureEmployeeFolder(roomId: string, data: Partial<EmployeeProfile>): Promise<string | null> {
    try {
      // 1. Thư mục gốc: employees
      let employeesFolderId = await this.getOrCreateFolder(roomId, 'employees', null);
      if (!employeesFolderId) return null;

      // 2. Thư mục vị trí (position)
      const positionName = data.position || 'Chung';
      let positionFolderId = await this.getOrCreateFolder(roomId, positionName, employeesFolderId);
      if (!positionFolderId) return employeesFolderId; // fallback

      // 3. Thư mục cá nhân nhân sự
      const empFolderName = data.name ? data.name.replace(/\s+/g, '_') : 'Unknown_Profile';
      let empFolderId = await this.getOrCreateFolder(roomId, empFolderName, positionFolderId);

      return empFolderId || positionFolderId;
    } catch (err) {
      console.warn('[PrivOSLifecycleService] Error ensuring employee folders:', err);
      return null;
    }
  }

  async createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'>): Promise<EmployeeProfile> {
    try {
      const list = await this.ensureValidList(roomId);
      if (list) {
        const customFields = this.buildCustomFieldsForCreation(data, list.fieldDefinitions);

        let fileId = null;
        let fileObjToSave = null;
        let fileDownloadUrl = null;
        const debugLog: string[] = [];

        // Tạo thông tin MD
        const markdownLines = [
          `# Hồ sơ: ${data.name}`,
          `- Số điện thoại: ${data.phone || 'Chưa cập nhật'}`,
          `- Email: ${data.email || 'Chưa cập nhật'}`,
          `- Vị trí: ${data.position || 'Chưa xác định'}`,
          `- Phòng ban: ${data.department || 'Chưa xác định'}`,
          `- Ngày bắt đầu: ${data.startDate || 'Chưa xác định'}`
        ];
        const markdownContent = markdownLines.join('\n');

        // Base64 encode an toàn với Unicode
        const base64Data = btoa(unescape(encodeURIComponent(markdownContent)));

        // Lấy folder ID phù hợp (Cấu trúc: employees -> vị trí -> tên nhân sự)
        const folderId = await this.ensureEmployeeFolder(roomId, data);
        const safeName = data.name.replace(/\s+/g, '_');
        const expectedFileName = `HoSo_${safeName}_${Date.now()}.md`;

        // Upload Markdown file lên PrivOS
        try {
          const uploadRes: any = await this.app.uploadFile({
            channelId: roomId,
            fileName: expectedFileName,
            base64Data: base64Data, // PrivOS expects raw base64 without prefix
            mimeType: 'text/markdown',
            folderId: folderId || undefined,
            uploadOnly: true // Skip posting message, returns `{ file: { _id, url } }`
          } as any);

          if (uploadRes) {
            // Handle both { file: { _id, url } } and { message: { file: { _id } } }
            const fileObj = uploadRes.file || (uploadRes.message && uploadRes.message.file);
            let rawFileId = (fileObj && fileObj._id) || uploadRes._id || uploadRes.id;

            // Lấy URL fallback nếu cần
            fileDownloadUrl = uploadRes.downloadUrl || uploadRes.url || (fileObj && fileObj.url);

            try {
              // Thêm delay 1 giây để File Management kịp đồng bộ từ Rocket.Chat
              await new Promise(resolve => setTimeout(resolve, 1000));

              const filesRes: any = await this.app.callServerTool({
                name: 'privos.files.getByChannel',
                arguments: { channelId: roomId, folderId: folderId || undefined, limit: 50 }
              });
              const filesText = filesRes?.content?.[0]?.text;
              if (filesText) {
                const files = JSON.parse(filesText);
                const targetName = `HoSo_${safeName}_`;
                // Tìm file vừa upload (có prefix HoSo_Name_)
                const matchedFile = files.find((f: any) => f.name && f.name.includes(targetName));
                if (matchedFile && (matchedFile._id || matchedFile.id)) {
                  fileId = matchedFile._id || matchedFile.id;
                  fileObjToSave = matchedFile;
                  fileDownloadUrl = matchedFile.downloadUrl || fileDownloadUrl;
                  debugLog.push(`✅ Found in FM: ${fileId}`);
                } else {
                  fileId = rawFileId; // Fallback
                  fileObjToSave = { _id: fileId, name: expectedFileName, type: 'text/markdown' };
                  debugLog.push(`❌ Not found in FM (count: ${files.length}). Fallback to: ${rawFileId}`);
                }
              } else {
                fileId = rawFileId;
                fileObjToSave = { _id: fileId, name: expectedFileName, type: 'text/markdown' };
                debugLog.push(`❌ FM query empty. Fallback to: ${rawFileId}`);
              }
            } catch (queryErr) {
              console.warn('[PrivOSLifecycleService] Không thể query File Management, dùng raw ID', queryErr);
              fileId = rawFileId;
              fileObjToSave = { _id: fileId, name: expectedFileName, type: 'text/markdown' };
              debugLog.push(`❌ FM query error. Fallback to: ${rawFileId}`);
            }
          }
        } catch (err) {
          console.error('[PrivOSLifecycleService] Lỗi khi upload Markdown hồ sơ:', err);
        }

        if (fileObjToSave) {
          // Tìm trường có type là DOCUMENT hoặc tên chứa 'hồ sơ' / 'document'
          const fileFieldDef = (list.fieldDefinitions || []).find((fd: any) =>
            fd.type === 'DOCUMENT' ||
            (fd.name || '').toLowerCase().includes('hồ sơ') ||
            (fd.name || '').toLowerCase().includes('document')
          );
          if (fileFieldDef) {
            customFields.push({ fieldId: fileFieldDef._id || fileFieldDef.id, value: [fileObjToSave] });
          }
        }

        const descriptionParts = [];
        // Hiển thị debug log lên UI
        if (typeof debugLog !== 'undefined' && debugLog.length > 0) {
          descriptionParts.push(`**Debug ID:** ${debugLog.join(' | ')}`);
        }

        if (data.sourceCandidateId) {
          descriptionParts.push(`[sourceCandidateId:${data.sourceCandidateId}]`);
        }
        if (fileDownloadUrl) {
          descriptionParts.push(`[fileUrl:${fileDownloadUrl}]`);
        }

        const res: any = await this.app.callServerTool({
          name: 'privos.lists.createItem',
          arguments: {
            listId: list._id || list.id,
            title: data.name,
            customFields,
            ...(descriptionParts.length > 0 ? { description: descriptionParts.join('\n\n') } : {})
          }
        });

        const parsed = JSON.parse(res?.content?.[0]?.text || '{}');
        return {
          ...data,
          _id: parsed._id || parsed.id || this.generateLocalId(),
          status: PrivOSLifecycleService.DEFAULT_STAGE
        };
      }
    } catch (err) {
      console.error('[PrivOSLifecycleService] Connection error when creating profile:', err);
    }

    // Fallback if failed
    return {
      ...data,
      _id: this.generateLocalId(),
      status: PrivOSLifecycleService.DEFAULT_STAGE
    };
  }

  async updateProfileStatus(roomId: string, profileId: string, newStatus: string): Promise<void> {
    try {
      const list = await this.ensureValidList(roomId);
      if (!list || !Array.isArray(list.stages)) {
        console.warn('[PrivOSLifecycleService] Cannot update stage: list or stages not found');
        return;
      }

      // Find stage matching newStatus
      const targetStage = list.stages.find(
        (s: any) => s.name === newStatus || (s.name || '').toLowerCase() === newStatus.toLowerCase()
      );

      if (!targetStage) {
        console.warn(`[PrivOSLifecycleService] Target stage "${newStatus}" not found in list stages:`, list.stages);
        return;
      }

      const stageId = targetStage._id || targetStage.id;
      if (!stageId) {
        console.warn(`[PrivOSLifecycleService] Target stage "${newStatus}" does not have a valid stageId:`, targetStage);
        return;
      }

      await this.app.callServerTool({
        name: 'privos.lists.moveItemToStage',
        arguments: {
          itemId: profileId,
          stageId
        }
      });
      console.log(`[PrivOSLifecycleService] Successfully moved profile ${profileId} to stage ${newStatus} (${stageId})`);
    } catch (err) {
      console.error('[PrivOSLifecycleService] Failed to move profile to stage:', err);
      throw err;
    }
  }

  // --- Private Helper Methods ---

  private generateLocalId(): string {
    return `local-${Date.now()}`;
  }

  private async ensureValidList(roomId: string): Promise<any | null> {
    let list = await this.findExistingList(roomId);

    if (list) {
      list = await this.enrichListWithStagesOrDelete(list);
    }

    if (!list) {
      console.log('[PrivOSLifecycleService] Valid list not found, creating a new one...');
      list = await this.createNewList(roomId);
    }

    return list;
  }

  private async findExistingList(roomId: string): Promise<any | null> {
    const res: any = await this.app.callServerTool({
      name: 'privos.lists.getAll',
      arguments: { roomId }
    });

    const text = res?.content?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const lists = Array.isArray(parsed) ? parsed : (parsed?.lists || []);

    return lists.find((l: any) =>
      PrivOSLifecycleService.LIST_IDENTIFIERS.some(kw =>
        (l.name || '').toLowerCase().includes(kw)
      )
    ) || null;
  }

  private async enrichListWithStagesOrDelete(list: any): Promise<any | null> {
    const configItem = await this.fetchSystemConfigItem(list._id || list.id);

    if (configItem && configItem.description) {
      try {
        list.stages = JSON.parse(configItem.description);
      } catch (e) {
        console.warn('Failed to parse config item description');
      }
    }

    if (this.isValidStagesArray(list.stages)) {
      return list;
    }

    // List is corrupted or missing stages config -> delete and return null to trigger recreation
    console.log('[PrivOSLifecycleService] List is old/corrupted (no stages). Deleting to clean up...');
    await this.deleteList(list._id || list.id);
    return null;
  }

  private isValidStagesArray(stages: any): boolean {
    return Array.isArray(stages) && stages.length > 0;
  }

  private async fetchSystemConfigItem(listId: string): Promise<any | null> {
    const searchRes: any = await this.app.callServerTool({
      name: 'privos.lists.searchItems',
      arguments: { listId, query: '[Hệ thống] Không xoá' }
    });

    const searchParsed = JSON.parse(searchRes?.content?.[0]?.text || '[]');
    return searchParsed.find((i: any) => this.isSystemConfigItem(i)) || null;
  }

  private isSystemConfigItem(item: any): boolean {
    return (item.name || item.title || '').includes('[Hệ thống]');
  }

  private async deleteList(listId: string): Promise<void> {
    await this.app.callServerTool({
      name: 'privos.lists.deleteMany',
      arguments: { listIds: [listId] }
    });
  }

  private async createNewList(roomId: string): Promise<any | null> {
    try {
      const res: any = await this.app.callServerTool({
        name: 'privos.lists.create',
        arguments: {
          roomId,
          name: 'Hồ sơ nhân sự',
          fieldDefinitions: this.getInitialFieldDefinitions(),
          stages: this.getInitialStages()
        }
      });

      const parsed = JSON.parse(res?.content?.[0]?.text || '{}');
      const newList = parsed.list || parsed || null;

      if (newList && parsed.stages) {
        await this.createSystemConfigItem(newList._id || newList.id, parsed.stages);
        newList.stages = parsed.stages;
      }

      return newList;
    } catch (err) {
      console.error('[PrivOSLifecycleService] Failed to create HR List:', err);
      return null;
    }
  }

  private async createSystemConfigItem(listId: string, stages: any[]): Promise<void> {
    await this.app.callServerTool({
      name: 'privos.lists.createItem',
      arguments: {
        listId,
        title: PrivOSLifecycleService.SYSTEM_CONFIG_NAME,
        description: JSON.stringify(stages)
      }
    });
  }

  private getInitialFieldDefinitions(): any[] {
    return [
      { name: "Số điện thoại", type: "TEXT" },
      { name: "Email", type: "TEXT" },
      { name: "Vị trí", type: "SELECT", options: [{ value: "Developer" }, { value: "Tester" }, { value: "HR" }, { value: "Sales" }] },
      { name: "Phòng ban", type: "SELECT", options: [{ value: "IT" }, { value: "Business" }, { value: "Back-office" }] },
      { name: "Ngày bắt đầu", type: "DATE" },
      { name: "Hồ sơ đính kèm", type: "DOCUMENT" }
    ];
  }

  private getInitialStages(): any[] {
    return [
      { name: "Mới nhận việc", color: "#f59e0b" },
      { name: "Đang thử việc", color: "#3b82f6" },
      { name: "Chính thức", color: "#10b981" },
      { name: "Nghỉ việc", color: "#ef4444" }
    ];
  }

  private async fetchListItems(listId: string): Promise<any[]> {
    const res: any = await this.app.callServerTool({
      name: 'privos.lists.getItems',
      arguments: { listId, count: 100 }
    });

    const text = res?.content?.[0]?.text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed?.items || []);
  }

  private createFieldDefinitionMap(fieldDefinitions: any[] | undefined): Map<string, any> {
    const fieldDefMap = new Map<string, any>();
    if (fieldDefinitions) {
      fieldDefinitions.forEach((fd: any) => {
        fieldDefMap.set(fd._id || fd.id, fd); // Fixed ID lookup
      });
    }
    return fieldDefMap;
  }

  private mapItemToProfile(item: any, list: any, fieldDefMap: Map<string, any>): EmployeeProfile {
    const profile: any = {
      _id: item._id || item.id,
      name: item.name || item.title || 'Không có tên',
      status: this.getStageName(item, list.stages),
    };

    if (item.description) {
      const match = item.description.match(/\[sourceCandidateId:([^\]]+)\]/);
      if (match) {
        profile.sourceCandidateId = match[1];
      }
      const urlMatch = item.description.match(/\[fileUrl:([^\]]+)\]/);
      if (urlMatch) {
        profile.attachedFileUrl = urlMatch[1];
      }
    }

    if (item.customFields) {
      this.extractCustomFields(profile, item.customFields, fieldDefMap);
    }

    return profile as EmployeeProfile;
  }

  private getStageName(item: any, stages: any[]): string {
    const stageId = item.stageId || item.stage_id || item.stage?._id || item.stage?.id;
    if (stageId && Array.isArray(stages) && stages.length > 0) {
      const matchedStage = stages.find((s: any) => s._id === stageId || s.id === stageId);
      if (matchedStage) {
        return matchedStage.name;
      }
    }
    if (typeof item.stage === 'string') return item.stage;
    if (typeof item.status === 'string') return item.status;
    if (item.stage?.name) return item.stage.name;
    return PrivOSLifecycleService.DEFAULT_STAGE;
  }

  private extractCustomFields(profile: any, customFieldsData: any, fieldDefMap: Map<string, any>): void {
    const parseField = (fieldId: string, val: any) => {
      const fd = fieldDefMap.get(fieldId);
      if (!fd) return;

      const displayVal = this.getDisplayValueForField(fd, val);
      this.assignProfileFieldByName(profile, fd.name, displayVal);
    };

    if (Array.isArray(customFieldsData)) {
      customFieldsData.forEach((cf: any) => parseField(cf.fieldId || cf.fieldDefinitionId, cf.value));
    } else if (typeof customFieldsData === 'object') {
      Object.keys(customFieldsData).forEach(key => parseField(key, customFieldsData[key]));
    }
  }

  private getDisplayValueForField(fd: any, rawValue: any): any {
    if (fd.type === 'SELECT' && Array.isArray(fd.options)) {
      const opt = fd.options.find((o: any) => o._id === rawValue || o.id === rawValue);
      if (opt) return opt.value;
    }
    return rawValue;
  }

  private assignProfileFieldByName(profile: any, fieldName: string, value: any): void {
    const fname = fieldName.toLowerCase();

    if (fname.includes('thoại') || fname.includes('phone')) profile.phone = value;
    else if (fname.includes('email')) profile.email = value;
    else if (fname.includes('vị trí') || fname.includes('position')) profile.position = value;
    else if (fname.includes('phòng')) profile.department = value;
    else if (fname.includes('ngày') || fname.includes('date')) profile.startDate = value;
  }

  private buildCustomFieldsForCreation(data: Omit<EmployeeProfile, '_id' | 'status'>, fieldDefinitions: any[] | undefined): any[] {
    const customFields: any[] = [];
    if (!fieldDefinitions) return customFields;

    fieldDefinitions.forEach((fd: any) => {
      const valueToSave = this.getProfileValueByFieldName(data, fd.name);
      if (valueToSave) {
        customFields.push({
          fieldId: fd._id || fd.id, // Fixed ID lookup
          value: this.getRawValueForField(fd, valueToSave)
        });
      }
    });

    return customFields;
  }

  private getProfileValueByFieldName(data: any, fieldName: string): any {
    const fname = fieldName.toLowerCase();
    if (fname.includes('thoại') || fname.includes('phone')) return data.phone;
    if (fname.includes('email')) return data.email;
    if (fname.includes('vị trí') || fname.includes('position')) return data.position;
    if (fname.includes('phòng')) return data.department;
    if (fname.includes('ngày') || fname.includes('date')) return data.startDate;
    return undefined;
  }

  private getRawValueForField(fd: any, displayValue: any): any {
    if (fd.type === 'SELECT' && Array.isArray(fd.options)) {
      const opt = fd.options.find((o: any) => o.value === displayValue);
      if (opt) return opt._id || opt.id;
    }
    return displayValue;
  }

  private async fetchAllLists(roomId: string): Promise<any[]> {
    const res: any = await this.app.callServerTool({
      name: 'privos.lists.getAll',
      arguments: { roomId }
    });

    const text = res?.content?.[0]?.text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed?.lists || []);
  }

  private async fetchListStages(listId: string): Promise<any[]> {
    // 1. Try MCP tool privos.stages.getByList
    try {
      const res: any = await this.app.callServerTool({
        name: 'privos.stages.getByList',
        arguments: { listId }
      });
      const text = res?.content?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        const stages = Array.isArray(parsed) ? parsed : (parsed?.stages || []);
        if (stages.length > 0) return stages;
      }
    } catch (err) {
      console.warn(`[PrivOSLifecycleService] Could not fetch stages via tool for list ${listId}:`, err);
    }

    // 2. Fallback via restCall lists.info if available
    try {
      if (this.app?.rest) {
        const res: any = await this.app.rest({
          method: 'GET',
          path: 'lists.info',
          query: { listId }
        });
        const body: any = res?.body ?? res;
        if (Array.isArray(body?.stages) && body.stages.length > 0) {
          return body.stages;
        }
      }
    } catch (err) {
      console.warn(`[PrivOSLifecycleService] Could not fetch stages via REST for list ${listId}:`, err);
    }

    return [];
  }

  private normalizeText(str: string): string {
    return (str || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .trim();
  }

  private isScreeningList(list: any): boolean {
    const rawName = (list.name || '').toUpperCase();
    const normalizedName = this.normalizeText(rawName);

    // Explicitly exclude HR lifecycle lists
    const isHrLifecycle =
      normalizedName.includes('HO SO NHAN SU') ||
      normalizedName.includes('NHAN SU') ||
      normalizedName.includes('LIFECYCLE') ||
      normalizedName.includes('EMPLOYEE');

    // In a recruitment room, all other lists are candidate screening/recruitment lists
    return !isHrLifecycle;
  }

  private isPassedCandidateItem(item: any, stages?: any[]): boolean {
    const rawStageName = this.getStageName(item, stages || []);
    const stageName = this.normalizeText(rawStageName);

    // CHỈ lấy ứng viên đang ở Stage 05 (Mời phỏng vấn)
    // Dùng Regex ^05[_\s] để đảm bảo bắt buộc bắt đầu bằng 05_ hoặc 05 (tránh dính 105_)
    const isStage5 = /^05[_\s]/.test(stageName) ||
      stageName.includes('MOI PHONG VAN') ||
      stageName.includes('MOI_PHONG_VAN');

    return isStage5;
  }

  private mapItemToPassedCandidate(item: any, list: any): PassedCandidate {
    const rawTitle = item.name || item.title || 'Không có tên';
    const parsedNameInfo = this.cleanCandidateName(rawTitle);
    const scoreVal = this.extractFieldValue(item.customFields, ['tong_diem', 'điểm', 'score', 'diem']);
    const categoryVal = this.extractFieldValue(item.customFields, ['phan_loai', 'loại', 'category', 'ket_qua']);
    const reasonVal = this.extractFieldValue(item.customFields, ['ly_do', 'lý do', 'reason', 'nhan_xet']);

    return {
      _id: item._id || item.id,
      name: parsedNameInfo.name,
      listName: list.name || 'Screening List',
      listId: list._id || list.id,
      score: typeof scoreVal === 'number' ? scoreVal : (scoreVal ? Number(scoreVal) : undefined),
      category: categoryVal ? String(categoryVal) : undefined,
      stageName: this.getStageName(item, list.stages || []),
      reason: reasonVal ? String(reasonVal) : (item.description || undefined),
      position: parsedNameInfo.position,
    };
  }

  private extractFieldValue(customFields: any, fieldKeys: string[]): any {
    if (!customFields) return undefined;

    if (Array.isArray(customFields)) {
      for (const cf of customFields) {
        const id = (cf.fieldId || cf.fieldDefinitionId || cf.name || '').toLowerCase();
        if (fieldKeys.some(key => id.includes(key.toLowerCase()))) {
          return cf.value;
        }
      }
    } else if (typeof customFields === 'object') {
      for (const key of Object.keys(customFields)) {
        if (fieldKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
          return customFields[key];
        }
      }
    }
    return undefined;
  }

  private cleanCandidateName(rawTitle: string): { name: string, position?: string } {
    let title = rawTitle.replace(/\.(md|pdf)$/i, '').trim();
    // Remove date prefix like 2026-07-06_ or 2026_07_06_
    title = title.replace(/^\d{4}[-_]\d{2}[-_]\d{2}_?/i, '');
    // Remove CV_ or CV- prefix
    title = title.replace(/^CV[-_]?/i, '');

    // Split by _ or - to extract position if present (e.g. "NguyenVanA_Developer")
    const parts = title.split(/[-_]/).filter(Boolean);
    if (parts.length >= 2) {
      const candidateName = parts[0].replace(/([A-Z])/g, ' $1').trim();
      const rawPos = parts.slice(1).join(' ').replace(/([A-Z])/g, ' $1').trim();
      return {
        name: candidateName || parts[0],
        position: this.normalizePosition(rawPos)
      };
    }

    return { name: title };
  }

  private normalizePosition(rawPosition: string): string {
    const pos = rawPosition.toLowerCase();
    if (pos.includes('dev') || pos.includes('lap trinh') || pos.includes('developer')) return 'Developer';
    if (pos.includes('test') || pos.includes('qa') || pos.includes('kiem thu')) return 'Tester';
    if (pos.includes('design') || pos.includes('ui') || pos.includes('ux')) return 'Designer';
    if (pos.includes('product') || pos.includes('pm')) return 'Product Manager';
    if (pos.includes('hr') || pos.includes('nhan su') || pos.includes('recruiter')) return 'HR';
    if (pos.includes('sale') || pos.includes('kinh doanh')) return 'Sales';
    if (pos.includes('market')) return 'Marketing';
    return rawPosition;
  }
}
