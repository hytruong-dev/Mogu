import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        success: 'border border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70 font-medium',
        warning: 'border border-amber-200/70 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70 font-medium',
        info: 'border border-blue-200/70 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70 font-medium',
        rose: 'border border-rose-200/70 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70 font-medium',
        orange: 'border border-orange-200/70 bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/70 font-medium',
        purple: 'border border-purple-200/70 bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/70 font-medium',
        neutral: 'border border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700 font-medium',
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
