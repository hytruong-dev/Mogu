import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SegmentedTab<T extends string> {
  value: T
  label: ReactNode
  icon?: LucideIcon
  count?: number | string
}

/**
 * Underline-style page tabs used under page headers.
 * Scrolls horizontally on small screens instead of wrapping.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('-mx-1 overflow-x-auto border-b border-border px-1', className)}>
      <div role="tablist" className="flex min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.value === value
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-slate-300 hover:text-foreground dark:hover:border-slate-600'
              )}
            >
              {Icon && <Icon size={16} className={active ? 'text-primary' : undefined} />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums',
                    active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
