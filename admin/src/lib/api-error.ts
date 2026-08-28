/** Đọc message lỗi từ response API (validation, conflict, ...). */
export function formatApiError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) {
    return (err as Error)?.message ?? 'Có lỗi xảy ra'
  }

  const nested = data.error as Record<string, unknown> | string | undefined
  if (nested && typeof nested === 'object') {
    if (Array.isArray(nested.details) && nested.details.length) {
      return (nested.details as Array<{ field?: string; message?: string }>)
        .map((d) => `${d.field ?? 'field'}: ${d.message ?? 'không hợp lệ'}`)
        .join('\n')
    }
    if (typeof nested.message === 'string' && nested.message) {
      const version =
        nested.currentVersion != null ? ` (phiên bản hiện tại: ${nested.currentVersion})` : ''
      return nested.message + version
    }
    if (typeof nested.code === 'string') {
      return nested.code
    }
  }

  if (typeof data.message === 'string' && data.message && data.message !== 'Conflict Exception') {
    return data.message
  }

  return 'Có lỗi xảy ra'
}
