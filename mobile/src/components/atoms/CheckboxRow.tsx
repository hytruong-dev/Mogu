import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '../../lib/utils';

type Props = {
  className?: string;
};

export function CheckboxRow({ className }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <Pressable
      className={cn('flex-row items-start gap-2.5', className)}
      onPress={() => setChecked((v) => !v)}
    >
      <View
        className={cn(
          'w-5 h-5 rounded-md border-[1.5px] items-center justify-center mt-px',
          checked ? 'bg-mogu-yellow border-[#E8B400]' : 'border-gray-400',
        )}
      >
        {checked && <Check size={14} color="#111" strokeWidth={3} />}
      </View>

      <Text className="flex-1 text-mogu-ink text-xs leading-[17px]">
        Tôi đồng ý với <Text className="text-mogu-coral">Điều khoản sử dụng</Text> và{' '}
        <Text className="text-mogu-coral">Chính sách bảo mật</Text>
      </Text>
    </Pressable>
  );
}
