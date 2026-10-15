import type { DishStatus } from '../../types'

export interface FoodsFilterState {
  search: string
  status?: DishStatus | 'ALL'
  categoryId?: string
  mealTypeId?: string
  regionId?: string
  calorieMin?: number
  calorieMax?: number
  page: number
  limit: number
}

export const STATUS_LABELS: Record<DishStatus, string> = {
  DRAFT: 'Bản nháp',
  PROCESSING: 'Đang xử lý',
  PENDING_REVIEW: 'Chờ duyệt',
  CHANGES_REQUESTED: 'Cần sửa',
  PUBLISHED: 'Đã xuất bản',
  UNPUBLISHED: 'Đã hủy xuất bản',
  REJECTED: 'Từ chối',
  FAILED: 'Thất bại',
  ARCHIVED: 'Lưu trữ',
}

export const STATUS_BADGE_VARIANTS: Record<DishStatus, { bg: string; text: string; border: string }> = {
  PUBLISHED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PENDING_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CHANGES_REQUESTED: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  PROCESSING: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  UNPUBLISHED: { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-200' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  ARCHIVED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'

export function getMediaUrl(media: { publicUrl?: string; storageKey?: string; bucket?: string } | undefined): string | null {
  if (!media) return null
  if (media.publicUrl) return media.publicUrl
  if (media.storageKey && media.bucket) {
    return `${SUPABASE_URL}/storage/v1/object/public/${media.bucket}/${media.storageKey}`
  }
  return null
}
