import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '../ui/badge'

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
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80'
      : variant === 'neutral'
        ? 'bg-muted text-muted-foreground border-border'
        : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80 font-medium'

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-normal select-none',
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
          className="cursor-pointer opacity-70 transition-opacity hover:opacity-100 rounded-full p-0.5"
          aria-label={`Xoá ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  )
}
