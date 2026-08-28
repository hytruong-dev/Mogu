import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionLabelProps {
  children: ReactNode
  /** Thêm dấu sao đỏ (trường bắt buộc) */
  required?: boolean
  className?: string
}

/** Nhãn tiêu đề nhóm trường (Danh mục món ăn *, Loại bữa ăn *, ...). */
export function SectionLabel({ children, required, className }: SectionLabelProps) {
  return (
    <label className={cn('text-sm font-medium text-foreground', className)}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}
