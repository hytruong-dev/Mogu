import api from './client'
import type { CursorPage, ReviewQueueItem, ReviewReasonCode } from '../types'

export interface ReviewQueueQuery {
  limit?: number
  cursor?: string
}

export const reviewApi = {
  // ── Queue ─────────────────────────────────────────────────────────────────

  getQueue: (params?: ReviewQueueQuery) =>
    api.get<CursorPage<ReviewQueueItem>>('/admin/review-queue', { params }).then((r) => r.data),

  // ── Actions ───────────────────────────────────────────────────────────────

  approve: (dishId: string) =>
    api.post(`/admin/dishes/${dishId}/approve`).then((r) => r.data),

  requestChanges: (dishId: string, reasonCode: ReviewReasonCode, note?: string) =>
    api
      .post(`/admin/dishes/${dishId}/request-changes`, { reasonCode, note })
      .then((r) => r.data),

  reject: (dishId: string, reasonCode: ReviewReasonCode, note?: string) =>
    api
      .post(`/admin/dishes/${dishId}/reject`, { reasonCode, note })
      .then((r) => r.data),

  resolveEvidence: (dishId: string, evidenceId: string, accepted: boolean, note?: string) =>
    api
      .post(`/admin/dishes/${dishId}/evidence/${evidenceId}/resolve`, { accepted, note })
      .then((r) => r.data),

  rollback: (dishId: string, targetVersion: number) =>
    api
      .post(`/admin/dishes/${dishId}/rollback`, { targetVersion })
      .then((r) => r.data),
}
