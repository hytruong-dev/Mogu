import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        success: 'border border-emerald-200/70 bg-emerald-50 text-emerald-800 font-medium',
        warning: 'border border-amber-200/70 bg-amber-50 text-amber-800 font-medium',
        info: 'border border-blue-200/70 bg-blue-50 text-blue-800 font-medium',
        rose: 'border border-rose-200/70 bg-rose-50 text-rose-800 font-medium',
        orange: 'border border-orange-200/70 bg-orange-50 text-orange-800 font-medium',
        purple: 'border border-purple-200/70 bg-purple-50 text-purple-800 font-medium',
        neutral: 'border border-slate-200 bg-slate-50 text-slate-700 font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
