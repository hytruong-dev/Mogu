import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Keep data fresh for 5 minutes — tab switches / back navigation will not trigger duplicate network calls */
      staleTime: 1000 * 60 * 5,
      /** Keep unused queries in memory for 24 hours */
      gcTime: 1000 * 60 * 60 * 24,
      /** In mobile, do not re-fetch merely on window focus */
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
