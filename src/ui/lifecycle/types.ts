export interface EmployeeProfile {
  _id: string;
  name: string;
  status: string;
  mst: string;
  bankAccount: string;
  phone?: string;
  email?: string;
  position?: string;
  department?: string;
  salary?: string;
  startDate?: string;
}

export interface KanbanColumnDef {
  status: string;
  label: string;
  color: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { status: 'Mới nhận việc', label: 'Đang chờ hoàn thiện hồ sơ', color: '#f59e0b' },
  { status: 'Đang thử việc', label: 'Đang thử việc', color: '#3b82f6' },
  { status: 'Chính thức', label: 'Nhân viên chính thức', color: '#10b981' },
];

export interface ILifecycleService {
  loadProfiles(roomId: string): Promise<EmployeeProfile[]>;
  createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'>): Promise<EmployeeProfile>;
}
