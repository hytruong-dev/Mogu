import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  className?: string
}

/**
 * Standard page title block. Every page uses the same type scale and spacing
 * so the admin feels consistent from screen to screen.
 */
export function PageHeader({ title, description, badge, actions, tabs, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {badge}
          </div>
          {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
      {tabs && <div className="max-w-full overflow-x-auto">{tabs}</div>}
    </div>
  )
}
