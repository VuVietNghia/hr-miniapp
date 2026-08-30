import type { ListsClient } from '../../platform/contracts';
import type { EmployeeProfile } from '../types';

export const LIFECYCLE_LIST_NAMES = ['[HR-MiniApp] Hồ sơ nhân sự', 'Hồ sơ nhân sự'] as const;

export function isLifecycleListName(name: string): boolean {
  return LIFECYCLE_LIST_NAMES.some(candidate => candidate === name);
}

export function getMockProfiles(): EmployeeProfile[] {
  return [
    { _id: 'sample-1', name: 'Nguyễn Văn A', status: 'Mới nhận việc' },
    { _id: 'sample-2', name: 'Lê Thị B', status: 'Đang thử việc' },
    { _id: 'sample-3', name: 'Trần Văn C', status: 'Chính thức' },
    { _id: 'sample-4', name: 'Phạm Thị D', status: 'Nghỉ việc' },
  ];
}

export async function getHrListId(lists: ListsClient, roomId: string): Promise<string | null> {
  if (!roomId.trim()) throw new Error('Không xác định được Room lifecycle.');
  return (await lists.listByRoom(roomId)).find(list => isLifecycleListName(list.name))?._id ?? null;
}

export async function createHrList(): Promise<never> {
  throw new Error('Tự động tạo hoặc sửa List lifecycle chưa được xác minh.');
}

export async function fetchProfilesFromServer(lists: ListsClient, listId: string): Promise<EmployeeProfile[]> {
  const info = await lists.getInfo(listId);
  const page = await lists.queryItems({ listId, count: 500 });
  if (page.nextCursor) throw new Error('Danh sách lifecycle vượt giới hạn trang an toàn.');
  return page.items.map(item => ({
    _id: item._id,
    name: item.name,
    status: info.stages.find(stage => stage._id === item.stageId)?.name ?? 'Mới nhận việc',
  }));
}

export async function loadEmployeeProfiles(lists: ListsClient, roomId: string): Promise<EmployeeProfile[]> {
  const listId = await getHrListId(lists, roomId);
  if (!listId) throw new Error('Không tìm thấy List hồ sơ nhân sự.');
  return fetchProfilesFromServer(lists, listId);
}

export async function createEmployeeProfile(lists: ListsClient, roomId: string, name: string): Promise<EmployeeProfile> {
  const listId = await getHrListId(lists, roomId);
  if (!listId) throw new Error('Không tìm thấy List hồ sơ nhân sự.');
  const info = await lists.getInfo(listId);
  const stage = info.stages.find(candidate => candidate.name === 'Mới nhận việc') ?? info.stages[0];
  if (!stage) throw new Error('List hồ sơ nhân sự thiếu stage khởi tạo.');
  const item = await lists.createItem({ listId, title: name, stageId: stage._id, customFields: [] });
  return { _id: item._id, name, status: stage.name ?? 'Mới nhận việc' };
}
