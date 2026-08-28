import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/utils';

type Props = {
  question: string;
  action: string;
  onPress?: () => void;
  compact?: boolean;
  className?: string;
};

export function AuthFooter({ question, action, onPress, compact = false, className }: Props) {
  return (
    <View
      className={cn('flex-row justify-center flex-wrap', compact ? 'mt-2.5' : 'mt-3.5', className)}
    >
      <Text className="text-mogu-ink text-sm font-medium">{question} </Text>
      <Pressable onPress={onPress} hitSlop={12}>
        <Text className="text-[#F2AE00] text-sm font-semibold underline">{action}</Text>
      </Pressable>
    </View>
  );
}
