import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  profileApi,
  profileVersionOf,
  withVersionRetry,
  type HealthProfile,
  type MeProfile,
  type UserSettings,
} from '../services/api/profile';

export const ME_PROFILE_QUERY_KEY = ['profile', 'me'] as const;
export const MY_SETTINGS_QUERY_KEY = ['profile', 'settings'] as const;
export const HEALTH_PROFILE_QUERY_KEY = ['profile', 'healthProfile'] as const;

/** Cached `/profile/me` plus helpers to mutate it with automatic 412 retry. */
export function useMeProfile() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ME_PROFILE_QUERY_KEY,
    queryFn: () => profileApi.me(),
    staleTime: 30_000,
  });

  const fetchVersion = useCallback(async () => {
    const fresh = await qc.fetchQuery({
      queryKey: ME_PROFILE_QUERY_KEY,
      queryFn: () => profileApi.me(),
      staleTime: 0,
    });
    return profileVersionOf(fresh);
  }, [qc]);

  /** Run a profile mutation that needs `If-Match`; retries once on version conflict. */
  const mutate = useCallback(
    async <T,>(run: (version: number) => Promise<T>): Promise<T> => {
      const cached = qc.getQueryData<MeProfile>(ME_PROFILE_QUERY_KEY);
      const result = await withVersionRetry(
        fetchVersion,
        run,
        cached ? profileVersionOf(cached) : undefined,
      );
      void qc.invalidateQueries({ queryKey: ME_PROFILE_QUERY_KEY });
      return result;
    },
    [qc, fetchVersion],
  );

  return { ...query, me: query.data, mutate, fetchVersion };
}

/** Cached `/me/settings`; `patch` applies optimistic cache update + 412 retry. */
export function useMySettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: MY_SETTINGS_QUERY_KEY,
    queryFn: () => profileApi.getSettings(),
    staleTime: 30_000,
  });

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<UserSettings> => {
      const fetchVersion = async () => {
        const s = await profileApi.getSettings();
        qc.setQueryData(MY_SETTINGS_QUERY_KEY, s);
        return s.version ?? 1;
      };
      const cached = qc.getQueryData<UserSettings>(MY_SETTINGS_QUERY_KEY);
      const next = await withVersionRetry(
        fetchVersion,
        (v) => profileApi.updateSettings(body, v),
        cached?.version,
      );
      qc.setQueryData(MY_SETTINGS_QUERY_KEY, next);
      return next;
    },
    [qc],
  );

  return { ...query, settings: query.data, patch };
}

/** Cached `/me/health-profile`. */
export function useHealthProfile() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: HEALTH_PROFILE_QUERY_KEY,
    queryFn: () => profileApi.getHealthProfile(),
    staleTime: 15_000,
  });
  const setHealth = useCallback(
    (hp: HealthProfile) => qc.setQueryData(HEALTH_PROFILE_QUERY_KEY, hp),
    [qc],
  );
  return { ...query, health: query.data, setHealth };
}
