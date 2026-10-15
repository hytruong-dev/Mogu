import {
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import type { ReviewReasonCode } from '../../types'

export const REASON_OPTIONS: { value: ReviewReasonCode; label: string }[] = [
  { value: 'INSUFFICIENT_SOURCE', label: 'Thiếu nguồn tham khảo' },
  { value: 'CONFLICTING_DATA', label: 'Dữ liệu mâu thuẫn' },
  { value: 'WRONG_DISH', label: 'Sai món ăn' },
  { value: 'NUTRITION_RISK', label: 'Rủi ro dinh dưỡng' },
  { value: 'ALLERGEN_RISK', label: 'Rủi ro dị ứng' },
  { value: 'COPYRIGHT_RISK', label: 'Vấn đề bản quyền' },
  { value: 'DUPLICATE', label: 'Món trùng lặp' },
  { value: 'CONTENT_QUALITY', label: 'Chất lượng nội dung kém' },
]

export interface ConfidenceMeta {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success'
  colorClass: string
  barColor: string
  icon: LucideIcon
  pct: number
}

export function getConfidenceMeta(score?: number): ConfidenceMeta {
  if (score === undefined || score === null) {
    return {
      label: 'Chờ đánh giá',
      variant: 'secondary',
      colorClass: 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800',
      barColor: 'bg-slate-300 dark:bg-slate-700',
      icon: Clock,
      pct: 0,
    }
  }
  if (score >= 80) {
    return {
      label: `${score}% Rất tốt`,
      variant: 'success',
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
      pct: score,
    }
  }
  if (score >= 60) {
    return {
      label: `${score}% Khá tốt`,
      variant: 'warning',
      colorClass: 'text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      barColor: 'bg-amber-500',
      icon: Sparkles,
      pct: score,
    }
  }
  return {
    label: `${score}% Cần lưu ý`,
    variant: 'destructive',
    colorClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    barColor: 'bg-rose-500',
    icon: AlertTriangle,
    pct: score,
  }
}

export function formatVnd(val?: number | null) {
  if (val === undefined || val === null || val === 0) return null
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

export function getDifficultyMeta(diff?: string | null) {
  switch (diff) {
    case 'EASY':
      return { label: 'Dễ làm', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' }
    case 'MEDIUM':
      return { label: 'Trung bình', colorClass: 'text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' }
    case 'HARD':
      return { label: 'Cầu kỳ / Khó', colorClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' }
    default:
      return { label: 'Tiêu chuẩn', colorClass: 'text-muted-foreground bg-muted border-border' }
  }
}

export const FLAVOR_TAG_LABELS: Record<string, string> = {
  DAM_DA: 'Đậm đà',
  CHUA: 'Chua thanh',
  BEO: 'Béo ngậy',
  NGUYEN_BAN: 'Nguyên bản',
  CAY: 'Cay nồng',
  NGOT: 'Ngọt thanh',
  MAN: 'Mặn mà',
  THANH_DAM: 'Thanh đạm',
  THOM: 'Thơm nồng',
  GION: 'Giòn sần sật',
  CHUA_CAY: 'Chua cay',
  CHUA_NGOT: 'Chua ngọt',
  NGU_VI: 'Ngũ vị',
  DANG: 'Đắng nhẹ',
  THANH_MAT: 'Thanh mát',
}

export function formatFlavorTag(tag: string): string {
  const upper = tag.toUpperCase().trim()
  return FLAVOR_TAG_LABELS[upper] ?? tag.replace(/_/g, ' ')
}

export const MEAL_SLOT_LABELS: Record<string, string> = {
  BREAKFAST: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Ăn vặt / Ăn nhẹ',
  LATE_NIGHT: 'Ăn khuya',
  ANYTIME: 'Mọi thời điểm',
}

export const DISH_TYPE_LABELS: Record<string, string> = {
  SOUP: 'Món nước / Canh / Súp',
  NOODLE: 'Bún / Phở / Mì / Miến',
  RICE: 'Cơm / Xôi',
  DRY: 'Món khô / Món mặn',
  SALAD: 'Nộm / Gỏi / Salad',
  DESSERT: 'Tráng miệng / Chè',
  DRINK: 'Thức uống',
  SNACK: 'Khai vị / Ăn vặt',
}

export const NUTRITION_BASIS_LABELS: Record<string, string> = {
  PER_SERVING: '1 khẩu phần chuẩn',
  PER_100G: '100g thực phẩm',
  WHOLE_RECIPE: 'Toàn bộ công thức',
}

export const NUTRITION_METHOD_LABELS: Record<string, string> = {
  AI_ESTIMATED: 'AI phân tích & ước lượng',
  INGREDIENT_CALCULATED: 'Tính từ định lượng nguyên liệu',
  SOURCE_VERIFIED: 'Đối chiếu viện / tài liệu kiểm chứng',
}

export function parseStepInstruction(instruction?: string, fallbackTitle?: string) {
  if (!instruction) return { title: fallbackTitle || '', body: '' }
  const lines = instruction.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { title: fallbackTitle || '', body: '' }
  if (lines.length === 1) {
    return { title: fallbackTitle || '', body: lines[0] }
  }
  return {
    title: lines[0],
    body: lines.slice(1).join('\n'),
  }
}

export { ALLERGEN_LABELS, getAllergenDisplayName, getAllergenDisplayName as formatAllergen } from '../ingredients/types'

