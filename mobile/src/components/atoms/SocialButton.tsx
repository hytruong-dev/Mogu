import { type ComponentType } from 'react';
import { type LucideProps } from 'lucide-react-native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
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
    <Button
      variant="outline"
      onPress={onPress}
      className={cn(
        'min-w-0 flex-1 rounded-[14px] border-gray-400 bg-white',
        compact ? 'h-[47px] gap-2' : 'h-[50px] gap-2.5',
        className,
      )}
    >
      {google ? (
        <Text className={cn('font-black text-[#4285F4]', compact ? 'text-xl' : 'text-[22px]')}>
          G
        </Text>
      ) : Icon ? (
        <Icon size={23} color="#050505" fill="#050505" />
      ) : null}
      <Text className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-[15px]')}>
        {label}
      </Text>
    </Button>
  );
}
