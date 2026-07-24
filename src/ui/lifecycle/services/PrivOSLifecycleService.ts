import { McpApp } from '@privos/app-react';
import { EmployeeProfile, ILifecycleService } from '../types';

export class PrivOSLifecycleService implements ILifecycleService {
  private static readonly LIST_IDENTIFIERS = ['nhan-su', 'nhansu', 'employee', 'lifecycle', 'hồ sơ'];
  private static readonly SYSTEM_CONFIG_NAME = '[Hệ thống] Không xoá - Cấu hình Kanban';
  private static readonly DEFAULT_STAGE = 'Mới nhận việc';

  constructor(private app: McpApp) {}

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

  async createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'>): Promise<EmployeeProfile> {
    try {
      const list = await this.ensureValidList(roomId);
      if (list) {
        const customFields = this.buildCustomFieldsForCreation(data, list.fieldDefinitions);
        const res: any = await this.app.callServerTool({
          name: 'privos.lists.createItem',
          arguments: {
            listId: list._id || list.id,
            title: data.name,
            customFields
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
      { name: "Vị trí", type: "SELECT", options: [{value: "Developer"}, {value: "Tester"}, {value: "HR"}, {value: "Sales"}] },
      { name: "Phòng ban", type: "SELECT", options: [{value: "IT"}, {value: "Business"}, {value: "Back-office"}] },
      { name: "Mã số thuế", type: "TEXT" },
      { name: "Số tài khoản", type: "TEXT" },
      { name: "Mức lương", type: "NUMBER" },
      { name: "Ngày bắt đầu", type: "DATE" }
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
      arguments: { listId }
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

    if (item.customFields) {
      this.extractCustomFields(profile, item.customFields, fieldDefMap);
    }

    return profile as EmployeeProfile;
  }

  private getStageName(item: any, stages: any[]): string {
    let statusName = item.stage || item.status || PrivOSLifecycleService.DEFAULT_STAGE;
    if (item.stageId && Array.isArray(stages)) {
      const matchedStage = stages.find((s: any) => s._id === item.stageId || s.id === item.stageId);
      if (matchedStage) {
        statusName = matchedStage.name;
      }
    }
    return statusName;
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
    else if (fname.includes('thuế') || fname.includes('mst')) profile.mst = value;
    else if (fname.includes('tài khoản') || fname.includes('bank')) profile.bankAccount = value;
    else if (fname.includes('lương') || fname.includes('salary')) profile.salary = value;
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
    if (fname.includes('thuế') || fname.includes('mst')) return data.mst;
    if (fname.includes('tài khoản') || fname.includes('bank')) return data.bankAccount;
    if (fname.includes('lương') || fname.includes('salary')) return data.salary;
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
}
