import api from './client'

export interface CommunityReview {
  id: string
  dishId: string
  userId: string
  rating: number
  comment: string | null
  isVisible: boolean
  createdAt: string
  updatedAt: string
  dish?: { id: string; name: string; slug: string }
  profile?: { id: string; displayName: string | null; avatarUrl: string | null }
}

export interface AdminReviewListParams {
  dishId?: string
  userId?: string
  isVisible?: boolean
  page?: number
  limit?: number
}

export interface AdminReviewListResponse {
  data: CommunityReview[]
  total: number
  page: number
  limit: number
}

export const reviewsAdminApi = {
  /** [Admin] Danh sách tất cả reviews */
  list: (params?: AdminReviewListParams) =>
    api.get<AdminReviewListResponse>('/admin/reviews', { params }).then((r) => r.data),

  /** [Admin] Ẩn review */
  hide: (id: string) =>
    api.patch<CommunityReview>(`/admin/reviews/${id}/hide`).then((r) => r.data),

  /** [Super Admin] Xóa cứng review */
  delete: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/admin/reviews/${id}`).then((r) => r.data),
}
