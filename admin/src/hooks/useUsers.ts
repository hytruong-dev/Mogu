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

export function useAdminUserActions() {
  const qc = useQueryClient()
  const invalidate = (userId?: string) => {
    qc.invalidateQueries({ queryKey: ['admin-users'] })
    qc.invalidateQueries({ queryKey: ['admin-users-summary'] })
    if (userId) qc.invalidateQueries({ queryKey: ['admin-user', userId] })
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
    unlock: useMutation({
      mutationFn: (userId: string) =>
        usersApi.unlock(userId, { reasonCode: 'SUPPORT_UNLOCK' }),
      onSuccess: (_d, userId) => invalidate(userId),
    }),
    createExport: useMutation({
      mutationFn: () =>
        usersApi.createExport({ reasonCode: 'OPS_LIST', format: 'CSV' }),
    }),
  }
}
