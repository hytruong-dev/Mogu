import { View, type ViewProps } from 'react-native'
import { cn } from '../../lib/utils'

interface ProgressProps extends ViewProps {
  value?: number // 0–100
  max?: number
  className?: string
  indicatorClassName?: string
}

export function Progress({
  value = 0,
  max = 100,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <View
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <View
        className={cn('h-full rounded-full bg-primary', indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </View>
  )
}
