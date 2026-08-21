import { McpApp } from '@privos/app-react';
import {
  EmployeeProfile,
  ILifecycleService,
  LifecycleOperationError,
  PassedCandidate,
  ProfileLoadResult,
} from '../types';

interface ListItemsPage {
  items: any[];
  isComplete: boolean;
}

interface LifecycleListContext {
  list: any;
  configurationStatus: 'ready' | 'unavailable';
}

export class PrivOSLifecycleService implements ILifecycleService {
  private static readonly PROFILE_PAGE_SIZE = 100;
  private static readonly MAX_PROFILE_ITEMS = 500;
  private static readonly SYSTEM_PREFIX = '[HR-MiniApp]';
  private static readonly LEGACY_EXACT_NAME = 'Hồ sơ nhân sự';
  private static readonly SYSTEM_CONFIG_NAME = '[Hệ thống] Không xoá - Cấu hình Kanban';
  private static readonly DEFAULT_STAGE = 'Mới nhận việc';

  constructor(private app: McpApp) { }

  async loadProfiles(roomId: string): Promise<ProfileLoadResult> {
    try {
      const context = await this.resolveListContext(roomId);
      const page = await this.fetchAllListItems(context.list._id || context.list.id);
      const fieldDefMap = this.createFieldDefinitionMap(context.list.fieldDefinitions);

      const records = page.items
        .filter(item => !this.isSystemConfigItem(item))
        .map(item => this.mapItemToProfile(item, context.list, fieldDefMap));

      if (context.configurationStatus === 'unavailable') {
        return {
          status: 'degraded',
          reason: 'configuration_unavailable',
          records,
          isComplete: page.isComplete,
        };
      }

      return { status: 'success', records, isComplete: page.isComplete };
    } catch {
      console.error('[PrivOSLifecycleService] PROFILE_LOAD_FAILED');
      return {
        status: 'failed',
        errorCode: 'PROFILE_LOAD_FAILED',
        message: 'Employee profiles are temporarily unavailable.',
      };
    }
  }

  async loadPassedCandidates(roomId: string): Promise<PassedCandidate[]> {
    try {
      const allLists = await this.fetchAllLists(roomId);
      const screeningLists = allLists.filter(list => this.isScreeningList(list));

      console.log(`[PrivOSLifecycleService] CANDIDATE_LISTS_LOADED total=${allLists.length} screening=${screeningLists.length}`);

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

        console.log(`[PrivOSLifecycleService] CANDIDATE_LIST_SCANNED total=${validItems.length} passed=${passedItems.length}`);

        return passedItems.map(item => this.mapItemToPassedCandidate(item, { ...list, stages }));
      });

      const candidatesNested = await Promise.all(candidatesPromises);
      const allCandidates = candidatesNested.flat();

      console.log(`[PrivOSLifecycleService] PASSED_CANDIDATES_LOADED count=${allCandidates.length}`);

      // Sort by score descending (highest score first)
      return allCandidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } catch {
      console.error('[PrivOSLifecycleService] PASSED_CANDIDATE_LOAD_FAILED');
      return [];
    }
  }



  async createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'> & { attachedFileObj?: any }): Promise<EmployeeProfile> {
    try {
      const context = await this.resolveListContext(roomId);
      if (context.configurationStatus === 'unavailable') {
        throw new LifecycleOperationError(
          'PROFILE_CONFIGURATION_UNAVAILABLE',
          'Cấu hình Hồ sơ NS chưa sẵn sàng. Không thể tạo hồ sơ mới.',
        );
      }

      const customFields = this.buildCustomFieldsForCreation(data, context.list.fieldDefinitions);
      const descriptionParts = this.buildProfileDescription(data);
      this.appendDocumentField(customFields, data.attachedFileObj, context.list.fieldDefinitions);

      const res: any = await this.app.callServerTool({
        name: 'privos.lists.createItem',
        arguments: {
          listId: context.list._id || context.list.id,
          title: data.name,
          customFields,
          ...(descriptionParts.length > 0 ? { description: descriptionParts.join('\n\n') } : {})
        }
      });

      const parsed = JSON.parse(res?.content?.[0]?.text || '{}');
      const persistedId = parsed._id || parsed.id;
      if (typeof persistedId !== 'string' || !persistedId.trim()) {
        throw new LifecycleOperationError(
          'PROFILE_CREATE_STATUS_UNKNOWN',
          'Chưa xác nhận được trạng thái lưu hồ sơ. Vui lòng tải lại danh sách trước khi thử lại.',
        );
      }

      return {
        ...data,
        _id: persistedId,
        status: PrivOSLifecycleService.DEFAULT_STAGE
      };
    } catch (error) {
      if (error instanceof LifecycleOperationError) throw error;
      console.error('[PrivOSLifecycleService] PROFILE_CREATE_STATUS_UNKNOWN');
      throw new LifecycleOperationError(
        'PROFILE_CREATE_STATUS_UNKNOWN',
        'Chưa xác nhận được trạng thái lưu hồ sơ. Vui lòng tải lại danh sách trước khi thử lại.',
        error,
      );
    }
  }

  async updateProfileStatus(roomId: string, profileId: string, newStatus: string): Promise<void> {
    try {
      const context = await this.resolveListContext(roomId);
      if (context.configurationStatus === 'unavailable') {
        throw new LifecycleOperationError(
          'PROFILE_CONFIGURATION_UNAVAILABLE',
          'Cấu hình Hồ sơ NS chưa sẵn sàng. Không thể đổi trạng thái.',
        );
      }

      const targetStage = context.list.stages.find(
        (s: any) => s.name === newStatus || (s.name || '').toLowerCase() === newStatus.toLowerCase()
      );

      if (!targetStage) {
        throw new LifecycleOperationError(
          'PROFILE_CONFIGURATION_UNAVAILABLE',
          'Không tìm thấy trạng thái nhân sự phù hợp trong cấu hình.',
        );
      }

      const stageId = targetStage._id || targetStage.id;
      if (!stageId) {
        throw new LifecycleOperationError(
          'PROFILE_CONFIGURATION_UNAVAILABLE',
          'Trạng thái nhân sự chưa có định danh hợp lệ.',
        );
      }

      await this.app.callServerTool({
        name: 'privos.lists.moveItemToStage',
        arguments: {
          itemId: profileId,
          stageId
        }
      });
    } catch (error) {
      console.error('[PrivOSLifecycleService] PROFILE_STATUS_UPDATE_FAILED');
      throw error;
    }
  }

  // --- Private Helper Methods ---

  private buildProfileDescription(
    data: Omit<EmployeeProfile, '_id' | 'status'> & { attachedFileObj?: any },
  ): string[] {
    const descriptionParts: string[] = [];
    const fileObject = data.attachedFileObj;
    const fileId = fileObject?._id || fileObject?.id;
    const fileUrl = fileObject?.downloadUrl || fileObject?.url;

    if (data.sourceCandidateId) descriptionParts.push(`[sourceCandidateId:${data.sourceCandidateId}]`);
    if (fileId) descriptionParts.push(`[fileId:${fileId}]`);
    else if (fileUrl) descriptionParts.push(`[fileUrl:${fileUrl}]`);

    return descriptionParts;
  }

  private appendDocumentField(customFields: any[], fileObject: any, fieldDefinitions: any[]): void {
    if (!fileObject) return;

    const fileField = (fieldDefinitions || []).find((field: any) => {
      const fieldName = String(field.name || '').toLowerCase();
      return field.type === 'DOCUMENT' || fieldName.includes('hồ sơ') || fieldName.includes('document');
    });
    if (!fileField) return;

    customFields.push({ fieldId: fileField._id || fileField.id, value: [fileObject] });
  }

  private async resolveListContext(roomId: string): Promise<LifecycleListContext> {
    const existingList = await this.findExistingList(roomId);
    if (existingList) return this.enrichListWithStages(existingList);

    const newList = await this.createNewList(roomId);
    if (!newList) throw new Error('Employee profile list is unavailable.');

    return {
      list: newList,
      configurationStatus: this.isValidStagesArray(newList.stages) ? 'ready' : 'unavailable',
    };
  }

  private async findExistingList(roomId: string): Promise<any | null> {
    const res: any = await this.app.callServerTool({
      name: 'privos.lists.getAll',
      arguments: { roomId }
    });

    const text = res?.content?.[0]?.text;
    if (!text) throw new Error('Employee list response is empty.');

    const parsed = JSON.parse(text);
    const lists = Array.isArray(parsed) ? parsed : parsed?.lists;
    if (!Array.isArray(lists)) throw new Error('Employee list response is malformed.');

    const foundList = lists.find((l: any) => {
      const name = l.name || '';
      return name.startsWith(PrivOSLifecycleService.SYSTEM_PREFIX) || name === PrivOSLifecycleService.LEGACY_EXACT_NAME;
    }) || null;
    return foundList;
  }

  private async enrichListWithStages(list: any): Promise<LifecycleListContext> {
    try {
      const configItem = await this.fetchSystemConfigItem(list._id || list.id);
      if (configItem?.description) {
        const configuredStages = JSON.parse(configItem.description);
        if (!this.isValidStagesArray(configuredStages)) {
          return { list, configurationStatus: 'unavailable' };
        }
        return { list: { ...list, stages: configuredStages }, configurationStatus: 'ready' };
      }
    } catch {
      return { list, configurationStatus: 'unavailable' };
    }

    return {
      list,
      configurationStatus: this.isValidStagesArray(list.stages) ? 'ready' : 'unavailable',
    };
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

  private async createNewList(roomId: string): Promise<any | null> {
    try {
      const res: any = await this.app.callServerTool({
        name: 'privos.lists.create',
        arguments: {
          roomId,
          name: `${PrivOSLifecycleService.SYSTEM_PREFIX} Hồ sơ nhân sự`,
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
    } catch {
      console.error('[PrivOSLifecycleService] PROFILE_LIST_CREATE_FAILED');
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
    const page = await this.fetchAllListItems(listId);
    return page.items;
  }

  private async fetchAllListItems(listId: string): Promise<ListItemsPage> {
    const items: any[] = [];
    let offset = 0;

    while (items.length < PrivOSLifecycleService.MAX_PROFILE_ITEMS) {
      const page = await this.fetchListItemsPage(listId, offset);
      items.push(...page.items);

      if (page.isComplete) return { items, isComplete: true };
      if (page.items.length === 0) return { items, isComplete: false };
      offset += page.items.length;
    }

    return { items, isComplete: false };
  }

  private async fetchListItemsPage(listId: string, offset: number): Promise<ListItemsPage> {
    const res: any = await this.app.callServerTool({
      name: 'privos.lists.getItems',
      arguments: { listId, offset, count: PrivOSLifecycleService.PROFILE_PAGE_SIZE }
    });

    const text = res?.content?.[0]?.text;
    if (!text) {
      throw new Error('List items response is empty.');
    }

    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed?.items || []);
    if (!Array.isArray(items)) {
      throw new Error('List items response is malformed.');
    }

    const total = typeof parsed?.total === 'number'
      ? parsed.total
      : typeof parsed?.totalCount === 'number'
        ? parsed.totalCount
        : undefined;
    const isComplete = parsed?.hasMore === false
      || (total !== undefined && items.length >= total)
      || (parsed?.hasMore !== true && items.length < PrivOSLifecycleService.PROFILE_PAGE_SIZE);

    return { items, isComplete };
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
        const sourceMatch = item.description.match(/\[sourceCandidateId:(.+?)\]/);
        if (sourceMatch) {
          profile.sourceCandidateId = sourceMatch[1];
        }

        const fileIdMatch = item.description.match(/\[fileId:(.+?)\]/);
        if (fileIdMatch) {
          profile.attachedFileId = fileIdMatch[1];
        }

        const fileMatch = item.description.match(/\[fileUrl:(.+?)\]/);
        if (fileMatch) {
          profile.attachedFileUrl = fileMatch[1];
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
    
    // Helper to validate if a string is a valid Kanban status
    const isValidStatus = (statusStr: string) => {
      return Array.isArray(stages) && stages.some(s => s.name === statusStr);
    };

    let resolvedStatus = PrivOSLifecycleService.DEFAULT_STAGE;
    if (typeof item.stage === 'string' && isValidStatus(item.stage)) resolvedStatus = item.stage;
    else if (typeof item.status === 'string' && isValidStatus(item.status)) resolvedStatus = item.status;
    else if (item.stage?.name && isValidStatus(item.stage.name)) resolvedStatus = item.stage.name;
    
    return resolvedStatus;
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
    else if (fname.includes('hồ sơ') || fname.includes('document')) profile.attachedFileObj = Array.isArray(value) ? value[0] : value;
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
    } catch {
      console.warn('[PrivOSLifecycleService] LIST_STAGE_TOOL_UNAVAILABLE');
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
    } catch {
      console.warn('[PrivOSLifecycleService] LIST_STAGE_REST_UNAVAILABLE');
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
    const emailVal = this.extractFieldValue(item.customFields, ['email', 'thu_dien_tu']);
    const phoneVal = this.extractFieldValue(item.customFields, ['sdt', 'sđt', 'phone', 'dien_thoai', 'điện thoại']);

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
      email: emailVal ? String(emailVal).trim() : undefined,
      phone: phoneVal ? String(phoneVal).trim() : undefined,
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
