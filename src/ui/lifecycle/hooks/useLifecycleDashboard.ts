import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling';
import { mergeIncompleteProfiles } from '../lifecycle-dashboard-selectors';
import {
  loadProfilesWithRetry,
  reconcileProfileLoadStatus,
} from '../lifecycle-load-policy';
import type { ProfileLoadStatusMessage } from '../lifecycle-load-policy';
import type { EmployeeProfile, ILifecycleService, PassedCandidate } from '../types';

export type LifecycleDataState = 'loading' | 'ready' | 'degraded' | 'error';
export type LifecycleStatusMessage = ProfileLoadStatusMessage;

interface UseLifecycleDashboardOptions {
  roomId: string;
  service: ILifecycleService;
}

export function useLifecycleDashboard({ roomId, service }: UseLifecycleDashboardOptions) {
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [passedCandidates, setPassedCandidates] = useState<PassedCandidate[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [dataState, setDataState] = useState<LifecycleDataState>('loading');
  const [statusMessage, setStatusMessage] = useState<LifecycleStatusMessage | null>(null);
  const refreshingProfilesRef = useRef(false);
  const refreshingCandidatesRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatusLater = useCallback((delayMs: number) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), delayMs);
  }, []);

  const refreshCandidates = useCallback(async (silent = false) => {
    if (refreshingCandidatesRef.current) return;
    refreshingCandidatesRef.current = true;
    if (!silent) setIsLoadingCandidates(true);
    try {
      const candidates = await service.loadPassedCandidates(roomId);
      setPassedCandidates((previous) => (
        areCandidatesEqual(previous, candidates) ? previous : candidates
      ));
    } catch {
      console.error('[LifecycleDashboard] CANDIDATE_LOAD_FAILED');
    } finally {
      refreshingCandidatesRef.current = false;
      if (!silent) setIsLoadingCandidates(false);
    }
  }, [roomId, service]);

  const refreshProfiles = useCallback(async (silent = false) => {
    if (refreshingProfilesRef.current) return;
    refreshingProfilesRef.current = true;
    if (!silent) setIsLoadingProfiles(true);

    try {
      const result = silent
        ? await service.loadProfiles(roomId)
        : await loadProfilesWithRetry(() => service.loadProfiles(roomId));
      if (result.status === 'failed') {
        setDataState('error');
        console.error(`[LifecycleDashboard] ${result.errorCode}`);
        if (!silent) setStatusMessage((current) => reconcileProfileLoadStatus(current, false));
        return;
      }

      setDataState(result.status === 'degraded' ? 'degraded' : 'ready');
      setStatusMessage((current) => reconcileProfileLoadStatus(current, true));
      setProfiles((previous) => {
        const nextProfiles = result.isComplete
          ? result.records
          : mergeIncompleteProfiles(previous, result.records);
        return areProfilesEqual(previous, nextProfiles) ? previous : nextProfiles;
      });
    } catch {
      setDataState('error');
      console.error('[LifecycleDashboard] PROFILE_LOAD_FAILED');
      if (!silent) setStatusMessage((current) => reconcileProfileLoadStatus(current, false));
    } finally {
      refreshingProfilesRef.current = false;
      if (!silent) setIsLoadingProfiles(false);
    }
  }, [roomId, service]);

  usePolling(
    useCallback(() => refreshProfiles(true), [refreshProfiles]),
    { enabled: Boolean(roomId), interval: 5000, immediate: false },
  );

  useEffect(() => {
    void refreshProfiles();
    void refreshCandidates();
  }, [refreshCandidates, refreshProfiles]);

  useEffect(() => () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }, []);

  const createProfile = useCallback(async (
    data: Omit<EmployeeProfile, '_id' | 'status'>,
  ) => {
    if (dataState !== 'ready') {
      throw new Error('Cấu hình Hồ sơ NS chưa sẵn sàng. Không thể tạo hồ sơ mới.');
    }

    setStatusMessage({ text: 'Đang tạo hồ sơ nhân sự...', type: 'info' });
    try {
      const newProfile = await service.createProfile(roomId, data);
      setProfiles((previous) => [...previous, newProfile]);
      setStatusMessage({ text: 'Đã tạo hồ sơ nhân sự thành công.', type: 'success' });
      clearStatusLater(3000);
      await refreshProfiles(true);
    } catch (error) {
      setStatusMessage({
        text: 'Không thể xác nhận hồ sơ đã được lưu. Vui lòng tải lại trước khi thử tiếp.',
        type: 'error',
      });
      throw error;
    }
  }, [clearStatusLater, dataState, refreshProfiles, roomId, service]);

  const moveProfile = useCallback(async (profileId: string, newStatus: string) => {
    if (dataState !== 'ready') {
      setStatusMessage({
        text: 'Cấu hình Hồ sơ NS chưa sẵn sàng. Không thể đổi trạng thái.',
        type: 'error',
      });
      return;
    }

    const targetProfile = profiles.find((profile) => profile._id === profileId);
    if (!targetProfile || targetProfile.status === newStatus) return;

    const previousStatus = targetProfile.status;
    setProfiles((previous) => previous.map((profile) => (
      profile._id === profileId ? { ...profile, status: newStatus } : profile
    )));
    setStatusMessage({ text: 'Đã cập nhật trạng thái nhân sự.', type: 'success' });

    try {
      await service.updateProfileStatus(roomId, profileId, newStatus);
      clearStatusLater(3000);
    } catch {
      console.error('[LifecycleDashboard] PROFILE_STATUS_UPDATE_FAILED');
      setProfiles((previous) => previous.map((profile) => (
        profile._id === profileId ? { ...profile, status: previousStatus } : profile
      )));
      setStatusMessage({
        text: 'Không thể đồng bộ trạng thái. Vị trí trước đó đã được khôi phục.',
        type: 'error',
      });
      clearStatusLater(5000);
    }
  }, [clearStatusLater, dataState, profiles, roomId, service]);

  return {
    profiles,
    passedCandidates,
    isLoadingProfiles,
    isLoadingCandidates,
    dataState,
    statusMessage,
    refreshCandidates,
    createProfile,
    moveProfile,
  };
}

function areCandidatesEqual(previous: PassedCandidate[], next: PassedCandidate[]): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((candidate, index) => (
    candidate._id === next[index]?._id
    && candidate.name === next[index]?.name
    && candidate.position === next[index]?.position
    && candidate.score === next[index]?.score
  ));
}

function areProfilesEqual(previous: EmployeeProfile[], next: EmployeeProfile[]): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((profile, index) => {
    const candidate = next[index];
    return profile._id === candidate?._id
      && profile.name === candidate?.name
      && profile.status === candidate?.status
      && profile.department === candidate?.department
      && profile.position === candidate?.position
      && profile.phone === candidate?.phone
      && profile.email === candidate?.email;
  });
}
