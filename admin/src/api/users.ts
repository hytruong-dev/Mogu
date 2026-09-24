import api from './client'

export type AdminUserListQuery = {
  q?: string
  status?: string
  cursor?: string
  limit?: number
}

export type AdminUserSummary = {
  metrics: {
    totalUsers: number
    activeUsersToday: number
    newUsers: number
    restrictedUsers: number
  }
  period?: { from: string; toExclusive: string; timezone: string }
  generatedAt?: string
}

export type AdminUserListItem = {
  userId: string
  displayName: string | null
  username: string | null
  email: string
  emailMasked: boolean
  avatarUrl: string | null
  accountStatus: string
  primaryGoal: { id: string; code: string; name: string } | null
  lastActiveAt: string | null
  joinedAt: string
  availableActions?: string[]
}

export type AdminUserDetail = {
  userId: string
  identity: {
    displayName: string | null
    username: string | null
    email: string
    emailMasked: boolean
    avatarUrl: string | null
    emailVerified?: boolean
  }
  account: {
    status: string
    mustChangePassword?: boolean
    lastLoginAt: string | null
    createdAt: string
    lockedUntil?: string | null
  }
  access: { roles: string[]; activeSessionCount?: number }
  productSummary: {
    onboardingStatus?: string
    primaryGoal: { code: string; name: string } | null
    savedDishCount: number
    randomRunCount: number
    publishedPostCount: number
  }
  activeRestriction: {
    id?: string
    type?: string
    reasonCode?: string
    startsAt?: string
    endsAt?: string | null
  } | null
  availableActions: string[]
}

export const usersApi = {
  summary: (params?: { from?: string; to?: string; timezone?: string }) =>
    api.get<AdminUserSummary>('/admin/users/summary', { params }).then((r) => r.data),

  list: (params?: AdminUserListQuery) =>
    api
      .get<{ items: AdminUserListItem[]; pageInfo: { nextCursor: string | null; hasNextPage?: boolean; hasMore?: boolean } }>(
        '/admin/users',
        { params },
      )
      .then((r) => r.data),

  detail: (userId: string) =>
    api.get<AdminUserDetail>(`/admin/users/${userId}`).then((r) => r.data),

  requestPasswordReset: (userId: string, body?: { reasonCode?: string; caseId?: string }) =>
    api.post(`/admin/users/${userId}/password-reset-requests`, body ?? {}).then((r) => r.data),

  sendVerificationReminder: (userId: string, body?: { reasonCode?: string; caseId?: string }) =>
    api.post(`/admin/users/${userId}/email-verification-reminders`, body ?? {}).then((r) => r.data),

  listSessions: (userId: string) =>
    api.get(`/admin/users/${userId}/sessions`).then((r) => r.data),

  revokeSessions: (
    userId: string,
    body: { scope: 'ALL' | 'SELECTED'; sessionIds?: string[]; reasonCode?: string; caseId?: string },
  ) => api.post(`/admin/users/${userId}/session-revocations`, body).then((r) => r.data),

  suspend: (
    userId: string,
    body: { reasonCode: string; caseId?: string; endsAt?: string; revokeSessions?: boolean },
  ) => api.post(`/admin/users/${userId}/suspensions`, body).then((r) => r.data),

  endSuspension: (userId: string, suspensionId: string, body?: { reasonCode?: string; caseId?: string }) =>
    api.post(`/admin/users/${userId}/suspensions/${suspensionId}/end`, body ?? {}).then((r) => r.data),

  unlock: (userId: string, body?: { reasonCode?: string; caseId?: string }) =>
    api.post(`/admin/users/${userId}/security-unlocks`, body ?? {}).then((r) => r.data),

  listRoles: (userId: string) => api.get(`/admin/users/${userId}/roles`).then((r) => r.data),

  assignRole: (userId: string, role: string, body?: { reasonCode?: string; ticketId?: string }) =>
    api.put(`/admin/users/${userId}/roles/${role}`, body ?? {}).then((r) => r.data),

  revokeRole: (userId: string, role: string) =>
    api.delete(`/admin/users/${userId}/roles/${role}`).then((r) => r.data),

  auditEvents: (userId: string, params?: { cursor?: string; limit?: number; eventType?: string }) =>
    api.get(`/admin/users/${userId}/audit-events`, { params }).then((r) => r.data),

  authAudit: (userId: string, params?: { limit?: number }) =>
    api.get(`/admin/users/${userId}/auth-audit`, { params }).then((r) => r.data),

  createExport: (body?: { reasonCode?: string; format?: string; columns?: string[] }) =>
    api.post('/admin/user-list-exports', body ?? { format: 'CSV' }).then((r) => r.data),

  getExport: (jobId: string) => api.get(`/admin/user-list-exports/${jobId}`).then((r) => r.data),

  privacyCases: (userId: string) =>
    api.get(`/admin/users/${userId}/privacy-cases`).then((r) => r.data),

  privacyCaseAction: (caseId: string, body: { action: string; reasonCode?: string }) =>
    api.post(`/admin/privacy-cases/${caseId}/actions`, body).then((r) => r.data),
}
