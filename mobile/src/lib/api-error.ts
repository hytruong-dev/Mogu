import { ApiError } from '../services/api/types';

/** Extract structured error code from API error body. */
export function getApiErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiError && err.code) return err.code;
  const body = (err as { details?: Record<string, unknown> })?.details;
  if (body && typeof body === 'object') {
    const nested = body.error;
    if (nested && typeof nested === 'object' && typeof (nested as { code?: string }).code === 'string') {
      return (nested as { code: string }).code;
    }
    if (typeof body.code === 'string') return body.code;
  }
  return undefined;
}

/** Human-readable message; prefers nested error.message when present. */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;

  const body = (err as { details?: Record<string, unknown>; response?: { data?: Record<string, unknown> } })
    ?.details ?? (err as { response?: { data?: Record<string, unknown> } })?.response?.data;

  if (body && typeof body === 'object') {
    const nested = body.error;
    if (nested && typeof nested === 'object') {
      if (typeof (nested as { message?: string }).message === 'string') {
        return (nested as { message: string }).message;
      }
      if (typeof (nested as { code?: string }).code === 'string') {
        return (nested as { code: string }).code;
      }
    }
    if (typeof body.message === 'string' && body.message) return body.message;
  }

  return (err as Error)?.message ?? 'Có lỗi xảy ra';
}

/** Known weekly-plan / randomization error codes → Vietnamese copy. */
const ERROR_MESSAGES: Record<string, string> = {
  NO_CANDIDATE: 'Không tìm thấy món phù hợp với tiêu chí của bạn.',
  PLAN_GENERATION_FAILED: 'Không thể tạo kế hoạch. Vui lòng thử lại.',
  BUDGET_EXCEEDED: 'Vượt ngân sách cho phép.',
  VERSION_CONFLICT: 'Dữ liệu đã thay đổi. Vui lòng làm mới và thử lại.',
  SLOT_LOCKED: 'Món này đã khóa, không thể đổi.',
};

export function formatApiErrorWithCode(err: unknown): string {
  const code = getApiErrorCode(err);
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return formatApiError(err);
}
