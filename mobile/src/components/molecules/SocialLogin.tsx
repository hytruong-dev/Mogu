import { View } from 'react-native';
import { Apple } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { AuthDivider } from './AuthDivider';
import { SocialButton } from '../atoms/SocialButton';

type Props = {
  label: string;
  compact?: boolean;
  className?: string;
};

export function SocialLogin({ label, compact = false, className }: Props) {
  return (
    <View className={cn('w-full', compact ? 'mt-2' : 'mt-3.5', className)}>
      <AuthDivider label={label} />
      <View className={cn('w-full flex-row', compact ? 'gap-3 mt-[9px]' : 'gap-3.5 mt-3')}>
        <SocialButton label="Google" google compact={compact} />
        <SocialButton label="Apple" icon={Apple} compact={compact} />
      </View>
    </View>
  );
}
