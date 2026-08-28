import { View, Text, type ViewProps, type TextProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex flex-row items-center rounded-full px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
        success: 'bg-emerald-100',
        warning: 'bg-amber-100',
        info: 'bg-blue-100',
        muted: 'bg-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      success: 'text-emerald-800',
      warning: 'text-amber-800',
      info: 'text-blue-800',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  label: string
  textClassName?: string
}

export function Badge({ label, variant, className, textClassName, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      <Text className={cn(badgeTextVariants({ variant }), textClassName)}>{label}</Text>
    </View>
  )
}
