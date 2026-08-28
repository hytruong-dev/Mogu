import { useEffect, useRef } from 'react'
import { Animated, View, type ViewProps } from 'react-native'
import { cn } from '../../lib/utils'

interface SkeletonProps extends ViewProps {
  className?: string
}

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[{ opacity }, style]}
      className={cn('rounded-xl bg-muted', className)}
      {...props}
    />
  )
}
