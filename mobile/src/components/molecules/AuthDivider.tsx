import { StyleSheet } from 'react-native';
import { Text, View } from 'react-native';
import { cn } from '../../lib/utils';

export function AuthDivider({ label, className }: { label: string; className?: string }) {
  return (
    <View className={cn('w-full flex-row items-center gap-[18px]', className)}>
      <View className="flex-1 bg-gray-500" style={{ height: StyleSheet.hairlineWidth }} />
      <Text className="text-gray-600 text-[15px] font-medium">{label}</Text>
      <View className="flex-1 bg-gray-500" style={{ height: StyleSheet.hairlineWidth }} />
    </View>
  );
}
