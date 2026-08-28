import api from './client'

export interface DishImportMapping {
  source: string
  target: string
}

export interface ImportOptionsPayload {
  duplicateMode: 'SKIP' | 'CREATE_NEW' | 'UPDATE_DRAFT_ONLY'
  imageImportMode?: 'DOWNLOAD_TO_R2' | 'URL_ONLY'
  unknownIngredientMode?: 'CREATE_SUGGESTION' | 'SKIP'
  failureMode?: 'PARTIAL_SUCCESS' | 'ROLLBACK_ALL'
  outputStatus?: 'DRAFT'
}

export interface ImportValidationSummary {
  total: number
  valid: number
  warning: number
  error: number
  duplicate: number
  eligibleRows?: number
}

export interface ImportIssueRow {
  rowNumber: number
  status: string
  dishName?: string
  mapped?: Record<string, string>
  issues?: { field: string; code: string; message: string; rawValue?: string }[]
  createdDishId?: string
}

function toBeMapping(mapping: DishImportMapping[]) {
  return mapping.map((m) => ({ source: m.source, target: m.target }))
}

function fromBeMapping(mapping: any[] = []): DishImportMapping[] {
  return mapping.map((m) => ({
    source: m.source ?? '',
    target: m.target ?? '',
  }))
}

function unwrap<T>(data: any): T {
  return (data?.data ?? data) as T
}

export const dishImportsApi = {
  templateUrl: '/admin/dish-imports/template',

  downloadTemplate: async () => {
    const res = await api.get('/admin/dish-imports/template', { responseType: 'blob' })
    return res.data as Blob
  },

  createSession: async (csvText: string, fileName: string) => {
    const data = unwrap<any>(await api.post('/admin/dish-imports/sessions', { csvText, fileName }).then((r) => r.data))
    return {
      ...data,
      sessionId: data.sessionId ?? data.id,
      mapping: fromBeMapping(data.mapping),
      sample: data.sample ?? data.preview ?? [],
    }
  },

  getSession: async (sessionId: string) => {
    const data = unwrap<any>(await api.get(`/admin/dish-imports/sessions/${sessionId}`).then((r) => r.data))
    return {
      ...data,
      sessionId: data.sessionId ?? sessionId,
      mapping: fromBeMapping(data.mapping),
      sample: data.sample ?? [],
    }
  },

  saveMapping: (
    sessionId: string,
    mapping: DishImportMapping[],
    extra?: { headerRow?: number; sheetName?: string; multiValueSeparator?: string },
  ) =>
    api
      .put(`/admin/dish-imports/sessions/${sessionId}/mapping`, {
        mapping: toBeMapping(mapping),
        ...extra,
      })
      .then((r) => unwrap(r.data)),

  validate: (sessionId: string) =>
    api.post(`/admin/dish-imports/sessions/${sessionId}/validate`).then((r) => unwrap(r.data)),

  patchRow: (sessionId: string, rowNumber: number, patch: Record<string, string>) =>
    api
      .patch(`/admin/dish-imports/sessions/${sessionId}/rows/${rowNumber}`, patch)
      .then((r) => unwrap(r.data)),

  revalidateRow: (sessionId: string, rowNumber: number) =>
    api
      .post(`/admin/dish-imports/sessions/${sessionId}/rows/${rowNumber}/revalidate`)
      .then((r) => unwrap(r.data)),

  saveOptions: (sessionId: string, options: ImportOptionsPayload) =>
    api.put(`/admin/dish-imports/sessions/${sessionId}/options`, options).then((r) => unwrap(r.data)),

  start: (sessionId: string) =>
    api.post(`/admin/dish-imports/sessions/${sessionId}/start`).then((r) => unwrap(r.data)),

  getJob: async (jobId: string) => {
    const job = unwrap<any>(await api.get(`/admin/dish-imports/jobs/${jobId}`).then((r) => r.data))
    const status = job.status === 'CANCEL_REQUESTED' ? 'CANCELLED' : job.status
    return {
      ...job,
      status,
      progressPercent: job.progressPercent ?? 0,
      createdCount: job.createdCount ?? 0,
      skippedCount: job.skippedCount ?? 0,
      failedCount: job.failedCount ?? 0,
      warningCount: job.warningCount ?? 0,
      totalRows: job.totalRows ?? 0,
      jobId: job.id ?? job.jobId ?? jobId,
      sessionId: job.sessionId,
    }
  },

  getJobRows: (jobId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    api
      .get(`/admin/dish-imports/jobs/${jobId}/rows`, { params })
      .then((r) => unwrap<{ total: number; items: ImportIssueRow[] }>(r.data)),

  cancel: (jobId: string) =>
    api.post(`/admin/dish-imports/jobs/${jobId}/cancel`).then((r) => unwrap(r.data)),

  downloadReport: async (jobId: string) => {
    const res = await api.get(`/admin/dish-imports/jobs/${jobId}/report`, { responseType: 'blob' })
    return res.data as Blob
  },

  reportUrl: (jobId: string) => `/admin/dish-imports/jobs/${jobId}/report`,
}
