import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterChipProps {
  label: string
  /** Hiển thị nút xoá */
  onRemove?: () => void
  /** Variant màu sắc */
  variant?: 'yellow' | 'neutral' | 'green'
  className?: string
}

/**
 * Chip nhỏ hiển thị trong danh mục / khẩu vị / preview phân loại.
 * Mặc định dùng tone vàng Mogu (giống design).
 */
export function FilterChip({ label, onRemove, variant = 'yellow', className }: FilterChipProps) {
  const palette =
    variant === 'green'
      ? 'bg-emerald-100 text-emerald-700'
      : variant === 'neutral'
        ? 'bg-muted text-muted-foreground'
        : 'bg-[var(--mogu-yellow-light)] text-foreground border border-[var(--mogu-yellow)]/40'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
        palette,
        className,
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
          aria-label={`Xoá ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
