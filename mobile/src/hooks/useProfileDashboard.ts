import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi, type ProfileDashboard } from '../services/api/profile';
import {
  getCachedProfileDashboard,
  saveCachedProfileDashboard,
} from '../services/api/storage';

export const PROFILE_DASHBOARD_QUERY_KEY = ['profile', 'dashboard'] as const;

export function useProfileDashboard() {
  const queryClient = useQueryClient();

  // Preload from AsyncStorage if memory cache is completely empty
  useEffect(() => {
    const existing = queryClient.getQueryData<ProfileDashboard>(PROFILE_DASHBOARD_QUERY_KEY);
    if (!existing) {
      void (async () => {
        const cached = await getCachedProfileDashboard();
        if (cached && !queryClient.getQueryData(PROFILE_DASHBOARD_QUERY_KEY)) {
          queryClient.setQueryData(PROFILE_DASHBOARD_QUERY_KEY, cached);
        }
      })();
    }
  }, [queryClient]);

  const query = useQuery({
    queryKey: PROFILE_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const data = await profileApi.dashboard();
      void saveCachedProfileDashboard(data);
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const updateDashboardCache = (
    updater: (prev: ProfileDashboard | undefined) => ProfileDashboard | undefined,
  ) => {
    queryClient.setQueryData<ProfileDashboard>(PROFILE_DASHBOARD_QUERY_KEY, (old) => {
      const updated = updater(old);
      if (updated) {
        void saveCachedProfileDashboard(updated);
      }
      return updated;
    });
  };

  const invalidateDashboard = () => {
    return queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  };

  return {
    ...query,
    dash: query.data,
    /**
     * isInitialLoading: ONLY true when there is absolutely no data in cache yet.
     * When returning from another screen or tab, dash already exists, so this is false!
     */
    isInitialLoading: query.isLoading && !query.data,
    updateDashboardCache,
    invalidateDashboard,
  };
}
