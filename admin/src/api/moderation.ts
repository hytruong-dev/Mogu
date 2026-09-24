import api from './client'

export type ModerationReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'REJECTED'
export type ModerationTargetType = 'COMMUNITY_POST' | 'COMMENT' | 'USER'
export type ResolveAction =
  | 'DISMISS'
  | 'HIDE_CONTENT'
  | 'DELETE_CONTENT'
  | 'WARN_USER'
  | 'RESTRICT_USER'

export interface ModerationPreview {
  kind: ModerationTargetType
  id: string
  content: string
  imageUrls?: string[]
  status?: string
  likeCount?: number
  commentCount?: number
  createdAt?: string
  author?: { userId: string; displayName: string | null; avatarUrl: string | null }
  ownerUserId?: string
  accountStatus?: string
  postId?: string
}

export interface ModerationReportItem {
  id: string
  targetType: ModerationTargetType
  targetId: string
  reasonCode: string
  reasonLabel: string
  note?: string | null
  status: ModerationReportStatus
  createdAt: string
  updatedAt: string
  reporter: { userId: string; displayName: string | null; avatarUrl: string | null }
  preview: ModerationPreview | null
  openReportCount: number
  priority: 'HIGH' | 'NORMAL'
}

export interface AdminPostItem {
  id: string
  content: string
  imageUrls: string[]
  status: string
  visibility: string
  likeCount: number
  commentCount: number
  createdAt: string
  author: { userId: string; displayName: string | null; avatarUrl: string | null }
  reportCount: number
}

export const moderationAdminApi = {
  stats: () =>
    api
      .get<{
        open: number
        reviewing: number
        pending: number
        highPriority: number
        resolvedToday: number
        handledRatePercent: number
        newToday: number
      }>('/admin/moderation/reports/stats')
      .then((r) => r.data),

  listReports: (params?: {
    status?: string
    targetType?: string
    reasonCode?: string
    cursor?: string
    limit?: number
  }) =>
    api
      .get<{ data: ModerationReportItem[]; nextCursor: string | null; hasMore: boolean }>(
        '/admin/moderation/reports',
        { params },
      )
      .then((r) => r.data),

  getReport: (id: string) =>
    api.get<ModerationReportItem & { relatedReports: any[] }>(`/admin/moderation/reports/${id}`).then((r) => r.data),

  resolveReport: (id: string, body: { action: ResolveAction; note?: string }) =>
    api.patch(`/admin/moderation/reports/${id}`, body).then((r) => r.data),

  listPosts: (params?: { q?: string; status?: string; cursor?: string; limit?: number }) =>
    api
      .get<{ data: AdminPostItem[]; nextCursor: string | null; hasMore: boolean }>(
        '/admin/community/posts',
        { params },
      )
      .then((r) => r.data),

  getPost: (id: string) => api.get(`/admin/community/posts/${id}`).then((r) => r.data),

  hidePost: (id: string) => api.patch(`/admin/community/posts/${id}/hide`).then((r) => r.data),

  restorePost: (id: string) =>
    api.patch(`/admin/community/posts/${id}/restore`).then((r) => r.data),

  deletePost: (id: string) => api.delete(`/admin/community/posts/${id}`).then((r) => r.data),

  listComments: (params?: {
    type?: 'all' | 'article' | 'post'
    search?: string
    limit?: number
    offset?: number
  }) =>
    api
      .get<{ items: AdminCommentItem[]; total: number; hasMore: boolean }>('/admin/comments', { params })
      .then((r) => r.data),

  hideComment: (id: string) =>
    api.patch<{ id: string; isHidden: boolean; content: string }>(`/admin/comments/${id}/hide`).then((r) => r.data),

  deleteComment: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/admin/comments/${id}`).then((r) => r.data),
}

export interface AdminCommentItem {
  id: string
  type: 'article' | 'post'
  content: string
  targetId: string
  targetTitle: string
  author: {
    userId: string
    displayName: string
    avatarUrl?: string | null
  }
  likesCount: number
  repliesCount: number
  createdAt: string
  updatedAt: string
  isHidden: boolean
}
