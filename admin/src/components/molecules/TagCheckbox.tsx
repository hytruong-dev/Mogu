import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagCheckboxProps {
  label: string
  icon?: LucideIcon
  checked?: boolean
  disabled?: boolean
  onClick?: () => void
}

/**
 * Ô chọn dạng chip có icon (dùng cho Loại bữa ăn, Mục tiêu phù hợp).
 * - checked: viền + nền vàng Mogu nhạt, hiện dấu tick vàng
 * - disabled: mờ 50%
 */
export function TagCheckbox({ label, icon: Icon, checked, disabled, onClick }: TagCheckboxProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-w-[110px] flex-col items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all',
        checked
          ? 'border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-300 dark:border-amber-500 font-semibold shadow-2xs ring-1 ring-amber-400/30'
          : 'border-border bg-card text-muted-foreground hover:border-amber-400/60 hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {Icon && <Icon className="h-5 w-5" />}
      <span className="flex items-center gap-1.5">
        {label}
        {checked && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white dark:text-slate-950">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </span>
    </button>
  )
}
