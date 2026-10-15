import { type ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  tabs,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-6 space-y-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-slate-500 max-w-3xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
      {tabs && <div className="pt-1">{tabs}</div>}
    </div>
  )
}
