import { TextInput, View, Text, type TextInputProps } from 'react-native'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react-native'
import { cn } from '../../lib/utils'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  /** Icon component (Lucide) hiển thị bên trái */
  icon?: ComponentType<LucideProps>
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Alias cho secureTextEntry */
  secure?: boolean
  containerClassName?: string
  inputClassName?: string
}

export function Input({
  label,
  error,
  icon: IconComponent,
  leftIcon,
  rightIcon,
  secure,
  containerClassName,
  inputClassName,
  editable = true,
  secureTextEntry,
  ...props
}: InputProps) {
  const renderLeftIcon = leftIcon ?? (IconComponent ? <IconComponent size={18} color="#A8A29E" /> : null)

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      ) : null}
      <View
        className={cn(
          'flex-row items-center rounded-xl border border-border bg-card px-3.5',
          'min-h-[46px]',
          error ? 'border-destructive' : '',
          !editable && 'opacity-50',
        )}
      >
        {renderLeftIcon ? <View className="mr-2">{renderLeftIcon}</View> : null}
        <TextInput
          className={cn(
            'flex-1 text-base text-foreground py-2.5',
            inputClassName,
          )}
          placeholderTextColor="#A8A29E"
          editable={editable}
          secureTextEntry={secure ?? secureTextEntry}
          {...props}
        />
        {rightIcon ? <View className="ml-2">{rightIcon}</View> : null}
      </View>
      {error ? (
        <Text className="text-xs text-destructive">{error}</Text>
      ) : null}
    </View>
  )
}
