import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Checkbox } from '../ui/checkbox';
import { cn } from '../../lib/utils';

export function CheckboxRow({
  className,
  checked,
  onCheckedChange,
}: {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isChecked = checked ?? internal;

  const toggle = () => {
    const next = !isChecked;
    if (checked === undefined) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <View className={cn('flex-row items-start gap-2.5', className)}>
      <Checkbox
        checked={isChecked}
        onCheckedChange={(val) => {
          if (checked === undefined) setInternal(val);
          onCheckedChange?.(val);
        }}
      />

      <Pressable onPress={toggle} className="flex-1">
        <Text className="text-foreground text-xs leading-[17px]">
          Tôi đồng ý với <Text className="text-accent font-medium">Điều khoản sử dụng</Text> và{' '}
          <Text className="text-accent font-medium">Chính sách bảo mật</Text>
        </Text>
      </Pressable>
    </View>
  );
}
