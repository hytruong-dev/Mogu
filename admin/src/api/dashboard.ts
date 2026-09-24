import api from './client'

export type DashboardRange = '7d' | '30d'

export interface DashboardSummary {
  generatedAt: string
  range: { from: string; to: string }
  kpi: {
    dishes: {
      total: number
      published: number
      draft: number
      pendingReview: number
      failed: number
      publishedThisWeek: number
      publishedLastWeek: number
      publishedGrowthPercent: number | null
    }
    importJobs: {
      active: number
      failedLast7d: number
      doneLast7d: number
    }
    moderation: {
      openReports: number
      activePosts: number
      pendingComments: number
    }
    weeklyPlans?: {
      total: number
      inRange: number
      previousRange: number
      growthPercent: number | null
      failed: number
      failureRatePercent: number
    }
    mealLogs?: {
      total: number
      inRange: number
      previousRange: number
      avgPerDay: number
      growthPercent: number | null
    }
  }
  tasks: Array<{
    key: string
    count: number
    route: string
    priority: 'high' | 'medium' | 'low'
  }>
  insight: {
    code: string
    message: string
    ctaRoute: string
  }
}

export interface GrowthPoint {
  date: string
  newDishes: number
  publishedDishes: number
}

export interface GrowthResponse {
  days: number
  series: GrowthPoint[]
}

export interface TrendingDishItem {
  dishId: string
  name: string
  slug: string
  imageUrl: string | null
  categoryName: string | null
  metrics: { views: number; saves: number; clicks: number; ratingAvg: number }
  trendScore: number
  rank: number
}

export interface TrendingResponse {
  window: '24h' | '7d'
  items: TrendingDishItem[]
  fallback: boolean
}

export interface ActivityItem {
  id: string
  type: 'IMPORT_JOB' | 'DISH_REVIEW' | 'MODERATION' | 'ADMIN_ACTION' | string
  status: 'DONE' | 'FAILED' | 'IN_PROGRESS' | 'INFO' | string
  title: string
  description: string
  actor: { id: string; displayName: string }
  route: string
  occurredAt: string
}

export interface ActivitiesResponse {
  items: ActivityItem[]
  pageInfo: { nextCursor: string | null; hasNextPage: boolean }
}

export const dashboardApi = {
  summary: (range: DashboardRange = '7d') =>
    api.get<DashboardSummary>('/admin/dashboard/summary', { params: { range } }).then((r) => r.data),

  growth: (days = 7) =>
    api.get<GrowthResponse>('/admin/dashboard/growth', { params: { days } }).then((r) => r.data),

  trendingDishes: (window: '24h' | '7d' = '7d', limit = 5) =>
    api
      .get<TrendingResponse>('/admin/dashboard/trending-dishes', { params: { window, limit } })
      .then((r) => r.data),

  activities: (limit = 10) =>
    api.get<ActivitiesResponse>('/admin/dashboard/activities', { params: { limit } }).then((r) => r.data),
}
