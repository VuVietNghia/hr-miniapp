import type {
  FieldDefinition,
  ListInfo,
  ListItem,
  ListsClient,
  StageSummary,
} from '../../platform/contracts';
import type { AttachedFileReference, EmployeeProfile, ILifecycleService, PassedCandidate } from '../types';
import { isLifecycleListName } from './lifecycleService';

type ProfileCreateInput = Omit<EmployeeProfile, '_id' | 'status'>;

const DEFAULT_STAGE = 'Mới nhận việc';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const ATTACHED_FILE_KEYS = [
  '_id',
  'id',
  'name',
  'downloadUrl',
  'url',
  'link',
  'fileUrl',
  'title',
  'fileName',
] as const satisfies readonly (keyof AttachedFileReference)[];

function documentRef(value: unknown): AttachedFileReference | null {
  if (typeof value === 'string' && value.trim()) return { url: value };
  const candidate = record(value);
  if (!candidate) return null;
  const result: AttachedFileReference = {};
  for (const key of ATTACHED_FILE_KEYS) {
    const valueAtKey = text(candidate[key]);
    if (valueAtKey?.trim()) result[key] = valueAtKey;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export class PrivOSLifecycleService implements ILifecycleService {
  constructor(private readonly lists: ListsClient) {}

  get capabilities(): Readonly<{ stageMovement: boolean }> {
    return this.lists.capabilities;
  }

  async loadProfiles(roomId: string): Promise<EmployeeProfile[]> {
    const list = await this.requireLifecycleList(roomId);
    const items = await this.fetchItems(list.list._id);
    const fields = new Map((list.list.fieldDefinitions ?? []).map(field => [field._id, field]));
    return items.filter(item => !this.isSystemItem(item)).map(item => this.mapProfile(item, list.stages, fields));
  }

  async loadPassedCandidates(roomId: string): Promise<PassedCandidate[]> {
    this.requireRoom(roomId);
    const summaries = await this.lists.listByRoom(roomId);
    const screening = summaries.filter(list => this.isScreeningName(list.name));
    const nested = await Promise.all(screening.map(async summary => {
      const info = await this.lists.getInfo(summary._id);
      const items = await this.fetchItems(summary._id);
      return items
        .filter(item => !this.isSystemItem(item) && this.isPassed(item, info.stages))
        .map(item => this.mapCandidate(item, info));
    }));
    return nested.flat().sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  }

  async createProfile(roomId: string, data: ProfileCreateInput): Promise<EmployeeProfile> {
    const info = await this.requireLifecycleList(roomId);
    const stage = info.stages.find(candidate => candidate.name === DEFAULT_STAGE) ?? info.stages[0];
    if (!stage) throw new Error('List hồ sơ nhân sự thiếu trạng thái khởi tạo.');

    const fields = info.list.fieldDefinitions ?? [];
    const customFields = this.buildCustomFields(data, fields);
    const attached = documentRef(data.attachedFileObj);
    const fileField = fields.find(field => field.type === 'DOCUMENT' || /hồ sơ|document/iu.test(field.name));
    if (attached && fileField) customFields.push({ fieldId: fileField._id, value: [attached] });

    const description: string[] = [];
    if (data.sourceCandidateId) description.push(`[sourceCandidateId:${data.sourceCandidateId}]`);
    const fileId = attached?._id ?? attached?.id;
    const fileUrl = attached?.downloadUrl ?? attached?.url;
    if (fileId) description.push(`[fileId:${fileId}]`);
    else if (fileUrl) description.push(`[fileUrl:${fileUrl}]`);

    const created = await this.lists.createItem({
      listId: info.list._id,
      title: data.name,
      stageId: stage._id,
      customFields,
      ...(description.length === 0 ? {} : { description: description.join('\n\n') }),
    });
    return { ...data, _id: created._id, status: stage.name ?? DEFAULT_STAGE };
  }

  async updateProfileStatus(roomId: string, profileId: string, newStatus: string): Promise<void> {
    if (!this.lists.capabilities.stageMovement) {
      throw new Error('Di chuyển trạng thái lifecycle không khả dụng trên kết nối PrivOS hiện tại.');
    }
    const info = await this.requireLifecycleList(roomId);
    const target = info.stages.find(stage => stage.name?.toLocaleLowerCase('vi') === newStatus.toLocaleLowerCase('vi'));
    if (!target) throw new Error(`Không tìm thấy trạng thái lifecycle: ${newStatus}.`);
    await this.lists.moveItemToStage(profileId, target._id);
  }

  private async requireLifecycleList(roomId: string): Promise<ListInfo> {
    this.requireRoom(roomId);
    const summary = (await this.lists.listByRoom(roomId)).find(list => isLifecycleListName(list.name));
    if (!summary) {
      throw new Error('Không tìm thấy List hồ sơ nhân sự; tự động tạo/sửa List chưa được xác minh.');
    }
    const info = await this.lists.getInfo(summary._id);
    if (info.stages.length === 0) {
      throw new Error('List hồ sơ nhân sự thiếu cấu hình stage; không xóa hoặc tạo lại tự động.');
    }
    return info;
  }

  private requireRoom(roomId: string): void {
    if (!roomId.trim()) throw new Error('Không xác định được Room lifecycle.');
  }

  private async fetchItems(listId: string): Promise<readonly ListItem[]> {
    const page = await this.lists.queryItems({ listId, count: 500 });
    if (page.nextCursor) throw new Error('Danh sách lifecycle vượt giới hạn trang an toàn.');
    return page.items;
  }

  private isScreeningName(name: string): boolean {
    const normalized = this.normalize(name);
    return !normalized.includes('HO SO NHAN SU')
      && !normalized.includes('NHAN SU')
      && !normalized.includes('LIFECYCLE')
      && !normalized.includes('EMPLOYEE');
  }

  private isSystemItem(item: ListItem): boolean {
    return item.name.includes('[Hệ thống]');
  }

  private stageName(item: ListItem, stages: readonly StageSummary[]): string {
    const matched = item.stageId ? stages.find(stage => stage._id === item.stageId) : undefined;
    return matched?.name ?? DEFAULT_STAGE;
  }

  private mapProfile(
    item: ListItem,
    stages: readonly StageSummary[],
    fields: ReadonlyMap<string, FieldDefinition>,
  ): EmployeeProfile {
    const profile: EmployeeProfile = { _id: item._id, name: item.name, status: this.stageName(item, stages) };
    const source = /\[sourceCandidateId:(.+?)\]/u.exec(item.description ?? '')?.[1];
    const fileId = /\[fileId:(.+?)\]/u.exec(item.description ?? '')?.[1];
    const fileUrl = /\[fileUrl:(.+?)\]/u.exec(item.description ?? '')?.[1];
    if (source) profile.sourceCandidateId = source;
    if (fileId) profile.attachedFileId = fileId;
    if (fileUrl) profile.attachedFileUrl = fileUrl;
    for (const custom of item.customFields ?? []) {
      const field = fields.get(custom.fieldId);
      if (field) this.assignProfileField(profile, field.name, custom.value);
    }
    return profile;
  }

  private assignProfileField(profile: EmployeeProfile, name: string, value: unknown): void {
    const normalized = name.toLocaleLowerCase('vi');
    const stringValue = typeof value === 'string' ? value : undefined;
    if (/thoại|phone/iu.test(normalized)) profile.phone = stringValue;
    else if (/email/iu.test(normalized)) profile.email = stringValue;
    else if (/vị trí|position/iu.test(normalized)) profile.position = stringValue;
    else if (/phòng/iu.test(normalized)) profile.department = stringValue;
    else if (/ngày|date/iu.test(normalized)) profile.startDate = stringValue;
    else if (/hồ sơ|document/iu.test(normalized)) {
      const attachment = documentRef(Array.isArray(value) ? value[0] : value);
      if (attachment) profile.attachedFileObj = attachment;
    }
  }

  private buildCustomFields(data: ProfileCreateInput, fields: readonly FieldDefinition[]): Array<{ fieldId: string; value: unknown }> {
    const result: Array<{ fieldId: string; value: unknown }> = [];
    for (const field of fields) {
      const normalized = field.name.toLocaleLowerCase('vi');
      const value = /thoại|phone/iu.test(normalized) ? data.phone
        : /email/iu.test(normalized) ? data.email
          : /vị trí|position/iu.test(normalized) ? data.position
            : /phòng/iu.test(normalized) ? data.department
              : /ngày|date/iu.test(normalized) ? data.startDate
                : undefined;
      if (value !== undefined && value !== '') result.push({ fieldId: field._id, value });
    }
    return result;
  }

  private isPassed(item: ListItem, stages: readonly StageSummary[]): boolean {
    const normalized = this.normalize(this.stageName(item, stages));
    return /^05[_\s]/u.test(normalized) || normalized.includes('MOI PHONG VAN');
  }

  private mapCandidate(item: ListItem, info: ListInfo): PassedCandidate {
    const parsed = this.cleanCandidateName(item.name);
    const values = new Map((item.customFields ?? []).map(field => [this.normalize(field.fieldId), field.value]));
    const get = (...keys: string[]): unknown => {
      for (const [id, value] of values) if (keys.some(key => id.includes(this.normalize(key)))) return value;
      return undefined;
    };
    const score = get('tong_diem', 'diem', 'score');
    const category = get('phan_loai', 'category', 'ket_qua');
    const reason = get('ly_do', 'reason', 'nhan_xet');
    const email = get('email', 'thu_dien_tu');
    const phone = get('sdt', 'phone', 'dien_thoai');
    return {
      _id: item._id,
      name: parsed.name,
      listName: info.list.name,
      listId: info.list._id,
      stageName: this.stageName(item, info.stages),
      ...(parsed.position ? { position: parsed.position } : {}),
      ...(score === undefined || Number.isNaN(Number(score)) ? {} : { score: Number(score) }),
      ...(category === undefined ? {} : { category: String(category) }),
      ...(reason === undefined && !item.description ? {} : { reason: reason === undefined ? item.description : String(reason) }),
      ...(email === undefined ? {} : { email: String(email).trim() }),
      ...(phone === undefined ? {} : { phone: String(phone).trim() }),
    };
  }

  private normalize(value: string): string {
    return value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').trim();
  }

  private cleanCandidateName(raw: string): { name: string; position?: string } {
    const cleaned = raw.replace(/\.(md|pdf)$/iu, '').replace(/^\d{4}[-_]\d{2}[-_]\d{2}_?/u, '').replace(/^CV[-_]?/iu, '');
    const parts = cleaned.split(/[-_]/u).filter(Boolean);
    if (parts.length < 2) return { name: cleaned };
    const name = parts[0].replace(/([A-Z])/g, ' $1').trim() || parts[0];
    const position = parts.slice(1).join(' ').replace(/([A-Z])/g, ' $1').trim();
    return { name, position };
  }
}
