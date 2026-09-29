import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  foodScanReportsApi,
  type FoodScanReportQuery,
  type UpdateFoodScanReportDto,
} from '../api/food-scan-reports'
import { useAuth } from '../providers/AuthProvider'

const KEY = 'food-scan-reports'

export function useFoodScanReports(query: FoodScanReportQuery) {
  const { session } = useAuth()
  return useQuery({
    queryKey: [KEY, 'list', query],
    queryFn: () => foodScanReportsApi.list(query),
    enabled: !!session,
    refetchInterval: session ? 30_000 : false,
  })
}

export function useFoodScanReportSummary() {
  const { session, hasRole } = useAuth()
  const allowed = hasRole('SUPER_ADMIN', 'CONTENT_ADMIN')
  return useQuery({
    queryKey: [KEY, 'summary'],
    queryFn: () => foodScanReportsApi.summary(),
    enabled: !!session && allowed,
    refetchInterval: session && allowed ? 30_000 : false,
    retry: false,
  })
}

export function useFoodScanReport(id: string | null | undefined) {
  const { session } = useAuth()
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => foodScanReportsApi.get(id as string),
    enabled: !!session && !!id,
  })
}

export function useUpdateFoodScanReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFoodScanReportDto }) =>
      foodScanReportsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    },
  })
}
