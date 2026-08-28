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
        'flex min-w-[110px] flex-col items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-colors',
        checked
          ? 'border-[var(--mogu-yellow)] bg-[var(--mogu-yellow-light)] text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-[var(--mogu-yellow)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {Icon && <Icon className="h-5 w-5" />}
      <span className="flex items-center gap-2">
        {label}
        {checked && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--mogu-yellow)]">
            <Check className="h-3 w-3 text-black" strokeWidth={3} />
          </span>
        )}
      </span>
    </button>
  )
}
