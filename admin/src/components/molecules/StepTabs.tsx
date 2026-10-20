import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepTab {
  n: number
  label: string
  active?: boolean
  done?: boolean
  onClick?: () => void
}

/**
 * Thanh 6 bước theo design Mogu:
 * - done: icon CircleCheck xanh
 * - active: nền vàng Mogu, badge trắng
 * - pending: nền trắng, số trong vòng tròn
 */
export function StepTabs({ steps }: { steps: StepTab[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {steps.map(({ n, label, active, done, onClick }) => (
        <button
          key={n}
          type="button"
          onClick={onClick}
          className={cn(
            'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all shadow-2xs',
            active
              ? 'border-primary bg-primary font-bold text-primary-foreground shadow-xs ring-2 ring-primary/20'
              : done
                ? 'border-border bg-card text-foreground hover:border-primary/40'
                : 'border-border/80 bg-muted/50 text-foreground/80 hover:bg-card hover:text-foreground hover:border-primary/40',
          )}
        >
          {done && !active ? (
            <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
          ) : (
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                active ? 'bg-primary-foreground text-primary' : 'bg-muted-foreground/20 text-foreground/90',
              )}
            >
              {n}
            </span>
          )}
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  )
}
