import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-2xl active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-mogu-yellow',
        destructive: 'bg-red-500',
        outline: 'border border-border bg-transparent',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
      },
      size: {
        default: 'h-12 px-6 gap-2',
        sm: 'h-9 px-4 gap-1.5',
        lg: 'h-14 px-8 gap-2',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const textVariants = cva('font-semibold text-center', {
  variants: {
    variant: {
      default: 'text-mogu-ink text-base',
      destructive: 'text-white text-base',
      outline: 'text-foreground text-base',
      secondary: 'text-secondary-foreground text-base',
      ghost: 'text-foreground text-base',
      link: 'text-primary text-base underline',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
  label?: string
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  textClassName?: string
  children?: React.ReactNode
}

export function Button({
  label,
  loading = false,
  leftIcon,
  rightIcon,
  variant,
  size,
  className,
  textClassName,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), isDisabled && 'opacity-50', className)}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'default' ? '#111' : '#FFC20E'} />
      ) : (
        <>
          {leftIcon}
          {label ? (
            <Text className={cn(textVariants({ variant, size }), textClassName)}>
              {label}
            </Text>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </Pressable>
  )
}
