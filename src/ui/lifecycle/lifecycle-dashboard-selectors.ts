import type { EmployeeProfile, PassedCandidate } from './types';

export type LifecycleViewMode = 'kanban' | 'list';

export interface LifecycleFilterOptions {
  department: string;
  status: string;
  searchTerm: string;
  viewMode: LifecycleViewMode;
}

export interface LifecycleStatusCounts {
  all: number;
  wait: number;
  probation: number;
  official: number;
  resigned: number;
}

export function mergeIncompleteProfiles(
  previousProfiles: EmployeeProfile[],
  loadedProfiles: EmployeeProfile[],
): EmployeeProfile[] {
  const loadedIds = new Set(loadedProfiles.map((profile) => profile._id));
  return [
    ...loadedProfiles,
    ...previousProfiles.filter((profile) => !loadedIds.has(profile._id)),
  ];
}

export function getLifecycleDepartments(profiles: EmployeeProfile[]): string[] {
  const departments = new Set(
    profiles
      .map((profile) => profile.department?.trim())
      .filter((department): department is string => Boolean(department)),
  );
  return ['Tất cả', ...Array.from(departments).sort((left, right) => left.localeCompare(right, 'vi'))];
}

export function getLifecycleStatusCounts(profiles: EmployeeProfile[]): LifecycleStatusCounts {
  return {
    all: profiles.length,
    wait: profiles.filter((profile) => profile.status === 'Mới nhận việc').length,
    probation: profiles.filter((profile) => profile.status === 'Đang thử việc').length,
    official: profiles.filter((profile) => profile.status === 'Chính thức').length,
    resigned: profiles.filter((profile) => profile.status === 'Nghỉ việc').length,
  };
}

export function filterLifecycleProfiles(
  profiles: EmployeeProfile[],
  options: LifecycleFilterOptions,
): EmployeeProfile[] {
  const normalizedSearchTerm = options.searchTerm.trim().toLocaleLowerCase('vi');

  return profiles.filter((profile) => {
    if (options.department !== 'Tất cả' && profile.department !== options.department) return false;
    if (options.viewMode === 'list' && options.status !== 'all' && profile.status !== options.status) return false;
    if (!normalizedSearchTerm) return true;

    return [profile.name, profile.phone, profile.email, profile.position]
      .some((value) => value?.toLocaleLowerCase('vi').includes(normalizedSearchTerm));
  });
}

export function getAvailableCandidates(
  candidates: PassedCandidate[],
  profiles: EmployeeProfile[],
): PassedCandidate[] {
  const sourceCandidateIds = new Set(
    profiles
      .map((profile) => profile.sourceCandidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  );
  const legacyProfileNames = new Set(
    profiles
      .filter((profile) => !profile.sourceCandidateId)
      .map((profile) => profile.name),
  );

  return candidates.filter((candidate) => (
    !sourceCandidateIds.has(candidate._id) && !legacyProfileNames.has(candidate.name)
  ));
}
