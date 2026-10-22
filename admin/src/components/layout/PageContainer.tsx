import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  fullWidth?: boolean
}

export function PageContainer({ children, className, fullWidth = false }: PageContainerProps) {
  return (
    <div className={cn('w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8', !fullWidth && 'mx-auto max-w-[1440px]', className)}>
      {children}
    </div>
  )
}
