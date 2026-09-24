import api from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Topic {
  id: string
  slug: string
  title: string
  description?: string
  coverImageUrl?: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { articles: number }
}

export interface Article {
  id: string
  slug: string
  title: string
  summary?: string
  content?: string
  coverImageUrl?: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED'
  readMinutes: number
  viewCount: number
  likeCount?: number
  commentCount?: number
  publishAt?: string | null
  isPinned?: boolean
  featuredAt?: string | null
  authorId: string
  topicId?: string
  createdAt: string
  updatedAt: string
  author?: { userId: string; displayName: string; avatarUrl?: string }
  topic?: { id: string; title: string; slug: string }
  tags?: string[]
}

export interface CreateTopicDto {
  slug: string
  title: string
  description?: string
  coverImageUrl?: string
  displayOrder?: number
  isActive?: boolean
}

export interface UpdateTopicDto {
  slug?: string
  title?: string
  description?: string
  coverImageUrl?: string
  displayOrder?: number
  isActive?: boolean
}

export interface CreateArticleDto {
  slug: string
  title: string
  summary?: string
  content: string
  coverImageUrl?: string
  readMinutes?: number
  topicId?: string
  tags?: string[]
}

export interface UpdateArticleDto {
  slug?: string
  title?: string
  summary?: string
  content?: string
  coverImageUrl?: string
  readMinutes?: number
  topicId?: string
  tags?: string[]
}

// ── Topics Admin API ──────────────────────────────────────────────────────────

export const topicsAdminApi = {
  list: () => api.get<Topic[]>('/admin/topics').then((r) => r.data),
  create: (dto: CreateTopicDto) => api.post<Topic>('/admin/topics', dto).then((r) => r.data),
  update: (id: string, dto: UpdateTopicDto) =>
    api.patch<Topic>(`/admin/topics/${id}`, dto).then((r) => r.data),
  delete: (id: string) => api.delete(`/admin/topics/${id}`).then((r) => r.data),
}

// ── Articles Admin API ────────────────────────────────────────────────────────

export const articlesAdminApi = {
  list: (params?: { topicId?: string; q?: string; cursor?: string; limit?: number }) =>
    api
      .get<{ data: Article[]; nextCursor: string | null; hasMore: boolean }>('/admin/articles', {
        params,
      })
      .then((r) => r.data),

  get: (id: string) =>
    api.get<Article & { content?: string }>(`/articles/${id}`).then((r) => r.data),

  publish: (id: string, body?: { publishAt?: string; schedule?: boolean }) =>
    api.patch<Article>(`/admin/articles/${id}/publish`, body).then((r) => r.data),

  togglePin: (id: string, isPinned?: boolean) =>
    api.patch<Article>(`/admin/articles/${id}/pin`, { isPinned }).then((r) => r.data),

  delete: (id: string) => api.delete(`/admin/articles/${id}`).then((r) => r.data),

  create: (dto: CreateArticleDto) =>
    api.post<Article>('/articles', dto).then((r) => r.data),

  update: (id: string, dto: UpdateArticleDto) =>
    api.patch<Article>(`/admin/articles/${id}`, dto).then((r) => r.data),
}

export interface ExploreAnalytics {
  postsPerDay?: Array<{ date: string; count: number }>
  dau?: number
  engagementDau?: number
  topArticles?: Array<{ id: string; title: string; viewCount?: number; likeCount?: number }>
  topPosts?: Array<{ id: string; content?: string; likeCount?: number; commentCount?: number }>
  reportRate?: number
  totalPosts?: number
  totalArticles?: number
  totalReports?: number
  impressions?: number
  openDetails?: number
  [key: string]: unknown
}

export const exploreAdminApi = {
  analytics: (params?: { from?: string; to?: string }) =>
    api
      .get<ExploreAnalytics>('/admin/explore/analytics', { params })
      .then((r) => r.data),
}
