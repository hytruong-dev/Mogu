import api from './client'

export type BroadcastType = 'SYSTEM' | 'PROMO' | 'REMINDER'
export type BroadcastScope = 'ALL' | 'SPECIFIC_USER'

export interface BroadcastNotificationDto {
  title: string
  body: string
  type?: BroadcastType
  scope?: BroadcastScope
  targetUser?: string
  deepLink?: string
}

export interface BroadcastResult {
  success: boolean
  totalRecipients: number
  pushTokensTargeted: number
  pushSentCount: number
  pushFailedCount: number
  message?: string
}

export interface BroadcastHistoryItem {
  id: string
  occurredAt: string
  actor: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  title: string
  body: string
  type: BroadcastType
  scope: BroadcastScope
  targetUser: string | null
  deepLink: string | null
  totalRecipients: number
  pushSentCount: number
  pushFailedCount: number
}

export interface BroadcastHistoryResponse {
  items: BroadcastHistoryItem[]
  total: number
  hasMore: boolean
}

export const adminNotificationsApi = {
  broadcast: (dto: BroadcastNotificationDto) =>
    api.post<BroadcastResult>('/admin/notifications/broadcast', dto).then((r) => r.data),

  history: (params?: { limit?: number; offset?: number }) =>
    api.get<BroadcastHistoryResponse>('/admin/notifications/history', { params }).then((r) => r.data),
}
