export interface EmployeeProfile {
  _id: string;
  name: string;
  status: string;
  phone?: string;
  email?: string;
  position?: string;
  department?: string;
  startDate?: string;
  sourceCandidateId?: string;
  attachedFileObj?: any;
}

export interface ProfileLoadSuccess {
  status: 'success';
  records: EmployeeProfile[];
  isComplete: boolean;
}

export interface ProfileLoadFailure {
  status: 'failed';
  errorCode: 'PROFILE_LOAD_FAILED';
  message: string;
}

export interface ProfileLoadDegraded {
  status: 'degraded';
  reason: 'configuration_unavailable';
  records: EmployeeProfile[];
  isComplete: boolean;
}

export type ProfileLoadResult = ProfileLoadSuccess | ProfileLoadDegraded | ProfileLoadFailure;

export type LifecycleErrorCode =
  | 'PROFILE_CONFIGURATION_UNAVAILABLE'
  | 'PROFILE_CREATE_FAILED'
  | 'PROFILE_CREATE_STATUS_UNKNOWN';

export class LifecycleOperationError extends Error {
  constructor(
    public readonly code: LifecycleErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'LifecycleOperationError';
  }
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
  { status: 'Nghỉ việc', label: 'Đã nghỉ việc', color: '#ef4444' },
];

export interface PassedCandidate {
  _id: string;
  name: string;
  listName: string;
  listId: string;
  score?: number;
  category?: string;
  stageName?: string;
  reason?: string;
  position?: string;
  email?: string;
  phone?: string;
}

export interface ILifecycleService {
  loadProfiles(roomId: string): Promise<ProfileLoadResult>;
  loadPassedCandidates(roomId: string): Promise<PassedCandidate[]>;
  createProfile(roomId: string, data: Omit<EmployeeProfile, '_id' | 'status'> & { attachedFileObj?: any }): Promise<EmployeeProfile>;
  updateProfileStatus(roomId: string, profileId: string, newStatus: string): Promise<void>;
}
