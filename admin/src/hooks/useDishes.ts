import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type AdminDishQuery, type CreateDishDto, dishesApi } from '../api/dishes'
import { useAuth } from '../providers/AuthProvider'

export function useAdminDishes(params?: AdminDishQuery) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dishes', params],
    queryFn: () => dishesApi.list(params),
    enabled: !!session,
  })
}

export function useAdminDish(id: string) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['admin-dish', id],
    queryFn: () => dishesApi.detail(id),
    enabled: !!id && !!session,
    refetchOnMount: 'always',
  })
}

export function useCreateDish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateDishDto) => dishesApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-dishes'] }),
  })
}

export function useUpdateDish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateDishDto> & { version?: number } }) =>
      dishesApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-dishes'] })
      qc.invalidateQueries({ queryKey: ['admin-dish', id] })
    },
  })
}

export function useDeleteDish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dishesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-dishes'] }),
  })
}

export function useDishLifecycle() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-dishes'] })
    qc.invalidateQueries({ queryKey: ['review-queue'] })
  }
  return {
    submitForReview: useMutation({
      mutationFn: ({ id, note, reviewTeam }: { id: string; note?: string; reviewTeam?: string }) =>
        dishesApi.submitForReview(id, { note, reviewTeam }),
      onSuccess: invalidate,
    }),
    publishDirect: useMutation({ mutationFn: dishesApi.publishDirect, onSuccess: invalidate }),
    unpublish: useMutation({ mutationFn: dishesApi.unpublish, onSuccess: invalidate }),
    republish: useMutation({ mutationFn: dishesApi.republish, onSuccess: invalidate }),
    archive: useMutation({ mutationFn: dishesApi.archive, onSuccess: invalidate }),
    restore: useMutation({ mutationFn: dishesApi.restore, onSuccess: invalidate }),
  }
}
