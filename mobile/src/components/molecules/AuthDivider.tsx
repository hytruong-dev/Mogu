import { Text, View } from 'react-native';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

export function AuthDivider({ label, className }: { label: string; className?: string }) {
  return (
    <View className={cn('w-full flex-row items-center gap-[18px]', className)}>
      <Separator className="flex-1 bg-border" />
      <Text className="text-muted-foreground text-[15px] font-medium">{label}</Text>
      <Separator className="flex-1 bg-border" />
    </View>
  );
}
