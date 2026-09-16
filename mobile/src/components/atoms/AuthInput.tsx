import * as React from 'react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { View, Text, type TextInputProps } from 'react-native';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';

type Props = TextInputProps & {
  icon?: ComponentType<LucideProps>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secure?: boolean;
  error?: string;
  label?: string;
  containerClassName?: string;
};

export function AuthInput({
  icon: IconComponent,
  leftIcon,
  rightIcon,
  secure,
  error,
  label,
  containerClassName,
  secureTextEntry,
  className,
  ...props
}: Props) {
  const renderLeftIcon = leftIcon ?? (IconComponent ? <IconComponent size={18} color="#A8A29E" /> : null);

  return (
    <View className={cn('gap-1.5 mb-3', containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      <View className="relative flex-row items-center">
        {renderLeftIcon ? (
          <View className="absolute left-3 z-10">{renderLeftIcon}</View>
        ) : null}
        <Input
          className={cn(
            renderLeftIcon ? 'pl-9' : '',
            rightIcon ? 'pr-9' : '',
            error ? 'border-destructive' : '',
            className
          )}
          secureTextEntry={secure ?? secureTextEntry}
          placeholderTextColor="#A8A29E"
          {...props}
        />
        {rightIcon ? (
          <View className="absolute right-3 z-10">{rightIcon}</View>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
