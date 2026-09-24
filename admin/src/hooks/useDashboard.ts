import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type DashboardRange } from '../api/dashboard'
import { useAuth } from '../providers/AuthProvider'

export function useDashboardSummary(range: DashboardRange = '7d') {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dashboard', 'summary', range],
    queryFn: () => dashboardApi.summary(range),
    enabled: !!session,
    staleTime: 60_000,
  })
}

export function useDashboardGrowth(days = 7) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dashboard', 'growth', days],
    queryFn: () => dashboardApi.growth(days),
    enabled: !!session,
    staleTime: 60_000,
  })
}

export function useTrendingDishes(window: '24h' | '7d' = '7d', limit = 5) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dashboard', 'trending', window, limit],
    queryFn: () => dashboardApi.trendingDishes(window, limit),
    enabled: !!session,
    staleTime: 5 * 60_000,
  })
}

export function useDashboardActivities(limit = 10) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dashboard', 'activities', limit],
    queryFn: () => dashboardApi.activities(limit),
    enabled: !!session,
    refetchInterval: !!session ? 30_000 : false,
  })
}
