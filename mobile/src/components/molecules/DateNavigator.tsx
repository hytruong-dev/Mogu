import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { cn } from '../../lib/utils';

type Props = {
  date: Date;
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
  onPress?: () => void;
  className?: string;
};

export function formatHealthDate(date: Date) {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return `${isToday ? 'Hôm nay, ' : ''}${date.getDate()} tháng ${date.getMonth() + 1}`;
}

export function DateNavigator({ date, label, onPrevious, onNext, onPress, className }: Props) {
  return (
    <View
      className={cn(
        'h-[54px] rounded-[27px] border border-[#E8E0D2] bg-white',
        'flex-row items-center px-2.5',
        className,
      )}
    >
      <Pressable onPress={onPrevious} hitSlop={8} className="w-11 h-11 items-center justify-center">
        <ChevronLeft size={25} color="#161616" />
      </Pressable>

      <Pressable
        onPress={onPress}
        disabled={!onPress}
        className="flex-1 h-11 items-center justify-center px-1"
      >
        <Text className="text-mogu-ink text-[16px] font-medium text-center" numberOfLines={1}>
          {label ?? formatHealthDate(date)}
        </Text>
      </Pressable>

      <Pressable onPress={onNext} hitSlop={8} className="w-11 h-11 items-center justify-center">
        <ChevronRight size={25} color="#161616" />
      </Pressable>
    </View>
  );
}
