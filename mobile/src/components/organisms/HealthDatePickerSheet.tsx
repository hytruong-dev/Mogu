import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';

type Props = {
  visible: boolean;
  value: Date;
  datesWithData?: Date[];
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function HealthDatePickerSheet({
  visible,
  value,
  datesWithData = [],
  onCancel,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  // ─── Reanimated values ────────────────────────────────────────────────────
  const sheetY = useSharedValue(520);
  const backdropOpacity = useSharedValue(0);

  // Track previous visible to animate
  const prevVisible = useMemo(() => ({ val: false }), []);
  if (visible !== prevVisible.val) {
    prevVisible.val = visible;
    if (visible) {
      setDraft(value);
      setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
      sheetY.value = 520;
      backdropOpacity.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 220 });
      sheetY.value = withTiming(0, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    }
  }

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // ─── Calendar grid ────────────────────────────────────────────────────────
  const days = useMemo(() => {
    const firstWeekday = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from(
        { length: count },
        (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
      ),
    ];
  }, [month]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Animated.View
          style={backdropStyle}
          className="absolute inset-0 bg-black/[0.45]"
          pointerEvents="box-none"
        >
          <Pressable className="flex-1" onPress={onCancel} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={sheetStyle}
          className="min-h-[520px] rounded-t-[28px] bg-white px-5 pb-7"
        >
          {/* Handle */}
          <View className="w-14 h-1.5 rounded-full bg-gray-300 self-center mt-3" />

          {/* Header */}
          <View className="h-[72px] flex-row items-center justify-between">
            <Pressable onPress={onCancel} className="min-w-[60px] min-h-[44px] justify-center">
              <Text className="text-[17px] text-mogu-ink">Hủy</Text>
            </Pressable>

            <Text className="text-[22px] font-bold text-mogu-ink">Chọn ngày</Text>

            <Pressable
              onPress={() => onConfirm(draft)}
              className="min-w-[60px] min-h-[44px] justify-center items-end"
            >
              <Text className="text-[17px] font-semibold text-[#E6A700]">Xong</Text>
            </Pressable>
          </View>

          {/* Month navigator */}
          <View className="h-[54px] flex-row items-center justify-between">
            <Pressable
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="w-11 h-11 items-center justify-center"
            >
              <ChevronLeft size={26} color="#161616" />
            </Pressable>

            <Text className="text-[18px] font-bold text-mogu-ink">
              Tháng {month.getMonth() + 1}, {month.getFullYear()}
            </Text>

            <Pressable
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="w-11 h-11 items-center justify-center"
            >
              <ChevronRight size={26} color="#161616" />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View className="flex-row mt-1.5">
            {WEEKDAYS.map((d) => (
              <Text
                key={d}
                className="text-[14px] text-[#626262] text-center"
                style={{ width: '14.285%' }}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View className="flex-row flex-wrap mt-2.5">
            {days.map((date, i) => {
              if (!date) {
                return (
                  <View
                    key={`empty-${i}`}
                    className="h-[52px] items-center justify-center"
                    style={{ width: '14.285%' }}
                  />
                );
              }
              const selected = sameDate(date, draft);
              const hasData = datesWithData.some((item) => sameDate(item, date));

              return (
                <Pressable
                  key={date.toISOString()}
                  className="h-[52px] items-center justify-center"
                  style={{ width: '14.285%' }}
                  onPress={() => setDraft(date)}
                >
                  <View
                    className={cn(
                      'w-[42px] h-[42px] rounded-full items-center justify-center',
                      selected && 'bg-mogu-yellow',
                    )}
                  >
                    <Text className={cn('text-[16px] text-mogu-ink', selected && 'font-bold')}>
                      {date.getDate()}
                    </Text>
                    {hasData && (
                      <View className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full bg-mogu-ink" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Legend */}
          <View className="flex-row items-center justify-center gap-2.5 mt-3.5">
            <View className="w-2 h-2 rounded-full bg-mogu-ink" />
            <Text className="text-[14px] text-[#303030]">Có dữ liệu bữa ăn</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
