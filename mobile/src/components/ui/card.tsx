import { View, Text, type ViewProps, type TextProps } from 'react-native'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('rounded-2xl border border-border bg-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn('gap-1 p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn('text-base font-bold text-card-foreground', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex-row items-center p-5 pt-0', className)}
      {...props}
    />
  )
}
