import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReviewQueueQuery, reviewApi } from '../api/review'
import type { ReviewReasonCode } from '../types'
import { useAuth } from '../providers/AuthProvider'

export function useReviewQueue(params?: ReviewQueueQuery) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['review-queue', params],
    queryFn: () => reviewApi.getQueue(params),
    enabled: !!session,
    refetchInterval: !!session ? 30_000 : false, // auto-refresh mỗi 30s khi đã login
  })
}

export function useReviewActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['review-queue'] })
    qc.invalidateQueries({ queryKey: ['admin-dishes'] })
  }

  return {
    approve: useMutation({
      mutationFn: (dishId: string) => reviewApi.approve(dishId),
      onSuccess: invalidate,
    }),
    requestChanges: useMutation({
      mutationFn: ({ dishId, reasonCode, note }: { dishId: string; reasonCode: ReviewReasonCode; note?: string }) =>
        reviewApi.requestChanges(dishId, reasonCode, note),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({ dishId, reasonCode, note }: { dishId: string; reasonCode: ReviewReasonCode; note?: string }) =>
        reviewApi.reject(dishId, reasonCode, note),
      onSuccess: invalidate,
    }),
    resolveEvidence: useMutation({
      mutationFn: ({
        dishId,
        evidenceId,
        accepted,
        note,
      }: {
        dishId: string
        evidenceId: string
        accepted: boolean
        note?: string
      }) => reviewApi.resolveEvidence(dishId, evidenceId, accepted, note),
      onSuccess: invalidate,
    }),
  }
}
