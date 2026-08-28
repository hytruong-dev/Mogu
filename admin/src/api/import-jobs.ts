import api from './client'
import type { CursorPage, ImportJob } from '../types'

export interface CreateImportJobDto {
  query: string            // tên món ăn
  relatedKeywords?: string[] // từ khóa dạng array
  regionHint?: string      // vùng miền (code: north/central/south)
  sourceTypes?: string[]   // nguồn dữ liệu (chỉ để log, AI tự tổng hợp)
}

export interface ImportJobQuery {
  limit?: number
  cursor?: string
}

export const importJobsApi = {
  create: (dto: CreateImportJobDto) =>
    api.post<ImportJob>('/admin/import-jobs', dto).then((r) => r.data),

  list: (params?: ImportJobQuery) =>
    api.get<CursorPage<ImportJob>>('/admin/import-jobs', { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<ImportJob>(`/admin/import-jobs/${id}`).then((r) => r.data),

  cancel: (id: string) =>
    api.post<ImportJob>(`/admin/import-jobs/${id}/cancel`).then((r) => r.data),
}
