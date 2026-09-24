import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi, type AdminUserListQuery } from '../api/users'
import { useAuth } from '../providers/AuthProvider'

export function useUsersSummary() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: () => usersApi.summary(),
    enabled: !!session,
  })
}

export function useAdminUsers(params?: AdminUserListQuery) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => usersApi.list(params),
    enabled: !!session,
  })
}

export function useAdminUser(userId: string | null) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => usersApi.detail(userId!),
    enabled: !!session && !!userId,
  })
}

export function useUserSessions(userId: string | null) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-user-sessions', userId],
    queryFn: () => usersApi.listSessions(userId!),
    enabled: !!session && !!userId,
  })
}

export function useUserAuditEvents(userId: string | null) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-user-audit', userId],
    queryFn: () => usersApi.auditEvents(userId!),
    enabled: !!session && !!userId,
  })
}

export function useUserAuthAudit(userId: string | null) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-user-auth-audit', userId],
    queryFn: () => usersApi.authAudit(userId!),
    enabled: !!session && !!userId,
  })
}

export function useAdminUserActions() {
  const qc = useQueryClient()
  const invalidate = (userId?: string) => {
    qc.invalidateQueries({ queryKey: ['admin-users'] })
    qc.invalidateQueries({ queryKey: ['admin-users-summary'] })
    if (userId) {
      qc.invalidateQueries({ queryKey: ['admin-user', userId] })
      qc.invalidateQueries({ queryKey: ['admin-user-sessions', userId] })
      qc.invalidateQueries({ queryKey: ['admin-user-audit', userId] })
      qc.invalidateQueries({ queryKey: ['admin-user-auth-audit', userId] })
    }
  }
  return {
    passwordReset: useMutation({
      mutationFn: (userId: string) =>
        usersApi.requestPasswordReset(userId, { reasonCode: 'SUPPORT_REQUEST' }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    verificationReminder: useMutation({
      mutationFn: (userId: string) =>
        usersApi.sendVerificationReminder(userId, { reasonCode: 'SUPPORT_REQUEST' }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    suspend: useMutation({
      mutationFn: (userId: string) =>
        usersApi.suspend(userId, {
          reasonCode: 'POLICY_VIOLATION',
          revokeSessions: true,
        }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    suspendWithReason: useMutation({
      mutationFn: ({ userId, reasonCode }: { userId: string; reasonCode: string }) =>
        usersApi.suspend(userId, { reasonCode, revokeSessions: true }),
      onSuccess: (_d, vars) => invalidate(vars.userId),
    }),
    endSuspension: useMutation({
      mutationFn: ({ userId, suspensionId }: { userId: string; suspensionId?: string }) =>
        usersApi.endSuspension(userId, suspensionId ?? 'current'),
      onSuccess: (_d, vars) => invalidate(vars.userId),
    }),
    unlock: useMutation({
      mutationFn: (userId: string) =>
        usersApi.unlock(userId, { reasonCode: 'SUPPORT_UNLOCK' }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    assignRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: string }) =>
        usersApi.assignRole(userId, role),
      onSuccess: (_d, vars) => invalidate(vars.userId),
    }),
    revokeRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: string }) =>
        usersApi.revokeRole(userId, role),
      onSuccess: (_d, vars) => invalidate(vars.userId),
    }),
    revokeSessions: useMutation({
      mutationFn: (userId: string) =>
        usersApi.revokeSessions(userId, { scope: 'ALL', reasonCode: 'ADMIN_FORCE' }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    createExport: useMutation({
      mutationFn: () =>
        usersApi.createExport({ reasonCode: 'OPS_LIST', format: 'CSV' }),
    }),
  }
}
