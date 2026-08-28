import { type ComponentType } from 'react';
import { Pressable, Text } from 'react-native';
import { type LucideProps } from 'lucide-react-native';
import { cn } from '../../lib/utils';

type Props = {
  label: string;
  icon?: ComponentType<LucideProps>;
  google?: boolean;
  compact?: boolean;
  className?: string;
  onPress?: () => void;
};

export function SocialButton({
  label,
  icon: Icon,
  google,
  compact = false,
  className,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-1 min-w-0 border border-gray-400 bg-white rounded-[14px]',
        'flex-row items-center justify-center',
        compact ? 'h-[47px] gap-2' : 'h-[50px] gap-2.5',
        className,
      )}
      style={({ pressed }) => [
        pressed && { transform: [{ scale: 0.98 }], backgroundColor: '#FAFAFA' },
      ]}
    >
      {google ? (
        <Text className={cn('font-black text-[#4285F4]', compact ? 'text-xl' : 'text-[22px]')}>
          G
        </Text>
      ) : Icon ? (
        <Icon size={23} color="#050505" fill="#050505" />
      ) : null}

      <Text className={cn('text-mogu-ink font-semibold', compact ? 'text-sm' : 'text-[15px]')}>
        {label}
      </Text>
    </Pressable>
  );
}
