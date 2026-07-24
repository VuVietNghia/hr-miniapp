import { McpApp } from '@privos/app-react';
import { EmployeeProfile, ILifecycleService } from '../types';

export class PrivOSLifecycleService implements ILifecycleService {
  constructor(private app: McpApp) {}

  private async getHrList(roomId: string): Promise<any | null> {
    try {
      const res: any = await this.app.callServerTool({
        name: 'privos.lists.getAll',
        arguments: { roomId }
      });

      const text = res?.content?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text);
      const lists = Array.isArray(parsed) ? parsed : (parsed?.lists || []);

      const hrList = lists.find((l: any) =>
        ['nhan-su', 'nhansu', 'employee', 'lifecycle', 'hồ sơ'].some(kw =>
          (l.name || '').toLowerCase().includes(kw)
        )
      );
      
      return hrList || null;
    } catch (err) {
      console.error('[PrivOSLifecycleService] Failed to get HR List:', err);
      return null;
    }
  }

  private async createHrList(roomId: string): Promise<any | null> {
    try {
      const res: any = await this.app.callServerTool({
        name: 'privos.lists.create',
        arguments: { 
          roomId, 
          name: 'Hồ sơ nhân sự',
          fieldDefinitions: [
            { name: "Số điện thoại", type: "TEXT" },
            { name: "Email", type: "TEXT" },
            { name: "Vị trí", type: "SELECT", options: [{value: "Developer"}, {value: "Tester"}, {value: "HR"}, {value: "Sales"}] },
            { name: "Phòng ban", type: "SELECT", options: [{value: "IT"}, {value: "Business"}, {value: "Back-office"}] },
            { name: "Mã số thuế", type: "TEXT" },
            { name: "Số tài khoản", type: "TEXT" },
            { name: "Mức lương", type: "NUMBER" },
            { name: "Ngày bắt đầu", type: "DATE" }
          ],
          stages: [
            { name: "Mới nhận việc", color: "#f59e0b" },
            { name: "Đang thử việc", color: "#3b82f6" },
            { name: "Chính thức", color: "#10b981" },
            { name: "Nghỉ việc", color: "#ef4444" }
          ]
        }
      });
      const parsed = JSON.parse(res?.content?.[0]?.text || '{}');
      return parsed.list || parsed || null;
    } catch (err) {
      console.error('[PrivOSLifecycleService] Failed to create HR List:', err);
      return null;
    }
  }

  async loadProfiles(roomId: string): Promise<EmployeeProfile[]> {
    try {
      let list = await this.getHrList(roomId);
      if (!list) {
        console.log('[PrivOSLifecycleService] Không tìm thấy list nhân sự trên server. Đang tạo mới...');
        list = await this.createHrList(roomId);
        if (!list) return [];
      }

      // Lấy items
      const res: any = await this.app.callServerTool({
        name: 'privos.lists.getItems',
        arguments: { listId: list._id || list.id }
      });

      const text = res?.content?.[0]?.text;
      if (!text) return [];

      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : (parsed?.items || []);

      // Mapping customFields từ ID sang đối tượng field (để tra cứu options)
      const fieldDefMap = new Map<string, any>();
      if (list.fieldDefinitions) {
        list.fieldDefinitions.forEach((fd: any) => {
          fieldDefMap.set(fd._id, fd);
        });
      }

      return items.map((item: any) => {
        const profile: any = {
          _id: item._id || item.id,
          name: item.name || item.title || 'Không có tên',
          status: item.stage || item.status || 'Mới nhận việc',
        };

        const mapFieldValue = (fieldId: string, val: any) => {
          const fd = fieldDefMap.get(fieldId);
          if (!fd) return val;
          const fname = fd.name.toLowerCase();
          
          // Map option ID back to option string value for SELECT fields
          let displayVal = val;
          if (fd.type === 'SELECT' && Array.isArray(fd.options)) {
            const opt = fd.options.find((o: any) => o._id === val || o.id === val);
            if (opt) displayVal = opt.value;
          }

          if (fname.includes('thoại') || fname.includes('phone')) profile.phone = displayVal;
          else if (fname.includes('email')) profile.email = displayVal;
          else if (fname.includes('vị trí') || fname.includes('position')) profile.position = displayVal;
          else if (fname.includes('phòng')) profile.department = displayVal;
          else if (fname.includes('thuế') || fname.includes('mst')) profile.mst = displayVal;
          else if (fname.includes('tài khoản') || fname.includes('bank')) profile.bankAccount = displayVal;
          else if (fname.includes('lương') || fname.includes('salary')) profile.salary = displayVal;
          else if (fname.includes('ngày') || fname.includes('date')) profile.startDate = displayVal;
        };

        // Extract custom fields
        if (Array.isArray(item.customFields)) {
          item.customFields.forEach((cf: any) => {
            mapFieldValue(cf.fieldId || cf.fieldDefinitionId, cf.value);
          });
        } else if (item.customFields && typeof item.customFields === 'object') {
           // Fallback in case customFields is an object mapping key to value
           Object.keys(item.customFields).forEach(key => {
             mapFieldValue(key, item.customFields[key]);
           });
        }

        return profile as EmployeeProfile;
      });
    } catch (err) {
      console.error('[PrivOSLifecycleService] Lỗi khi load hồ sơ từ server:', err);
      return [];
    }
  }

  async createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'>): Promise<EmployeeProfile> {
    try {
      let list = await this.getHrList(roomId);
      if (!list) {
        list = await this.createHrList(roomId);
      }

      if (list) {
        // Prepare custom fields array
        const customFields: any[] = [];
        if (list.fieldDefinitions) {
          list.fieldDefinitions.forEach((fd: any) => {
            const fname = fd.name.toLowerCase();
            let value = undefined;
            if (fname.includes('thoại') || fname.includes('phone')) value = data.phone;
            else if (fname.includes('email')) value = data.email;
            else if (fname.includes('vị trí') || fname.includes('position')) value = data.position;
            else if (fname.includes('phòng')) value = data.department;
            else if (fname.includes('thuế') || fname.includes('mst')) value = data.mst;
            else if (fname.includes('tài khoản') || fname.includes('bank')) value = data.bankAccount;
            else if (fname.includes('lương') || fname.includes('salary')) value = data.salary;
            else if (fname.includes('ngày') || fname.includes('date')) value = data.startDate;

            if (value) {
              // Map string value to option ID for SELECT fields
              let finalValue = value;
              if (fd.type === 'SELECT' && Array.isArray(fd.options)) {
                const opt = fd.options.find((o: any) => o.value === value);
                if (opt) finalValue = opt._id || opt.id;
              }
              customFields.push({ fieldId: fd._id, value: finalValue });
            }
          });
        }

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
          _id: parsed._id || parsed.id || `local-${Date.now()}`,
          status: 'Mới nhận việc'
        };
      }
    } catch (err) {
      console.error(`[PrivOSLifecycleService] Lỗi kết nối khi tạo hồ sơ:`, err);
    }
    
    // Fallback if failed
    return {
      ...data,
      _id: `local-${Date.now()}`,
      status: 'Mới nhận việc'
    };
  }
}
