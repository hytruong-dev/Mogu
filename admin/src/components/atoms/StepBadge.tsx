import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepBadgeProps {
  /** Số thứ tự bước (1-based) */
  n: number
  /** Đã hoàn thành → hiển thị dấu tick */
  done?: boolean
  /** Đang active → nền đen, chữ vàng */
  active?: boolean
}

/**
 * Badge số thứ tự bước trong StepTabs.
 * - done:  viền đen, dấu check
 * - active: nền đen, chữ vàng Mogu
 * - else:  nền muted, chữ muted
 */
export function StepBadge({ n, done, active }: StepBadgeProps) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold',
        active
          ? 'bg-black text-[var(--mogu-yellow)]'
          : done
            ? 'border border-black/30 text-foreground'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
    </span>
  )
}
