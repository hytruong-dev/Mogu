import { type ReactNode } from 'react'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  fullWidth?: boolean
}

export function PageContainer({
  children,
  className = '',
  fullWidth = false,
}: PageContainerProps) {
  return (
    <div
      className={`w-full py-6 px-4 sm:px-6 lg:px-8 transition-all ${
        fullWidth ? '' : 'max-w-[1600px] mx-auto'
      } ${className}`}
    >
      {children}
    </div>
  )
}
