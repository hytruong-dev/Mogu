import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Text } from '../ui/text';

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

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }, [visible, value]);

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
    <Drawer open={visible} onOpenChange={(open) => !open && onCancel()} snapHeight={560}>
      <DrawerHeader className="flex-row items-center justify-between px-5">
        <Button variant="ghost" onPress={onCancel} className="h-11 min-w-[60px] px-0">
          <Text className="text-[17px] text-foreground">Hủy</Text>
        </Button>
        <DrawerTitle className="text-[22px]">Chọn ngày</DrawerTitle>
        <Button
          variant="ghost"
          onPress={() => onConfirm(draft)}
          className="h-11 min-w-[60px] items-end px-0"
        >
          <Text className="text-[17px] font-semibold text-primary">Xong</Text>
        </Button>
      </DrawerHeader>

      <DrawerContent className="px-5 pb-2">
        <View className="h-[54px] flex-row items-center justify-between">
          <Pressable
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="size-11 items-center justify-center"
          >
            <ChevronLeft size={26} color="#161616" />
          </Pressable>
          <Text className="text-[18px] font-bold text-foreground">
            Tháng {month.getMonth() + 1}, {month.getFullYear()}
          </Text>
          <Pressable
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="size-11 items-center justify-center"
          >
            <ChevronRight size={26} color="#161616" />
          </Pressable>
        </View>

        <View className="mt-1.5 flex-row">
          {WEEKDAYS.map((d) => (
            <Text
              key={d}
              className="text-center text-[14px] text-muted-foreground"
              style={{ width: '14.285%' }}
            >
              {d}
            </Text>
          ))}
        </View>

        <View className="mt-2.5 flex-row flex-wrap">
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
                    'size-[42px] items-center justify-center rounded-full',
                    selected && 'bg-primary',
                  )}
                >
                  <Text className={cn('text-[16px] text-foreground', selected && 'font-bold')}>
                    {date.getDate()}
                  </Text>
                  {hasData ? (
                    <View className="absolute bottom-[3px] size-[5px] rounded-full bg-foreground" />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </DrawerContent>

      <DrawerFooter className="items-center px-5">
        <View className="flex-row items-center justify-center gap-2.5">
          <View className="size-2 rounded-full bg-foreground" />
          <Text className="text-[14px] text-foreground">Có dữ liệu bữa ăn</Text>
        </View>
      </DrawerFooter>
    </Drawer>
  );
}
