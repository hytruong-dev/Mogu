import { Pressable, Text, type PressableProps } from 'react-native'
import { cn } from '../../lib/utils'

interface ToggleProps extends PressableProps {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  label?: string
  children?: React.ReactNode
  className?: string
  textClassName?: string
}

export function Toggle({
  pressed,
  onPressedChange,
  label,
  children,
  className,
  textClassName,
  ...props
}: ToggleProps) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center rounded-xl px-4 py-2 transition-colors',
        pressed ? 'bg-accent' : 'bg-transparent',
        className,
      )}
      onPress={() => onPressedChange?.(!pressed)}
      {...props}
    >
      {children ?? (
        <Text
          className={cn(
            'text-sm font-medium',
            pressed ? 'text-accent-foreground' : 'text-muted-foreground',
            textClassName,
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}
