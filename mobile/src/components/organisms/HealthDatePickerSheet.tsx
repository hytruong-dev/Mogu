import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, X } from '@/components/icons';
import { Drawer } from '../ui/drawer';
import { Button } from '../ui/button';
import { Text as UIText } from '../ui/text';

type Props = {
  visible: boolean;
  value: Date;
  datesWithData?: Date[];
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  /** Gọi khi người dùng đổi tháng — dùng để tải chấm lịch của tháng đó. */
  onMonthChange?: (month: Date) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const INK = '#48210B';
const SUB = '#8A6F5C';
const YELLOW = '#FFC928';
const LINE = '#F1E6D3';

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
  onMonthChange,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }, [visible, value]);

  const changeMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    onMonthChange?.(next);
  };

  const days = useMemo(() => {
    const firstWeekday = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const dataKeys = useMemo(
    () => new Set(datesWithData.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)),
    [datesWithData],
  );

  return (
    <Drawer open={visible} onOpenChange={(open) => !open && onCancel()} snapHeight={600} sheetBackgroundColor="#FFFFFF">
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: INK }}>Chọn ngày</Text>
          <Pressable
            onPress={onCancel}
            hitSlop={10}
            accessibilityLabel="Đóng"
            style={{ position: 'absolute', right: -8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={22} color={INK} />
          </Pressable>
        </View>

        <View
          style={{
            height: 48,
            marginTop: 10,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: LINE,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
          }}
        >
          <Pressable
            onPress={() => changeMonth(-1)}
            accessibilityLabel="Tháng trước"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color={INK} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>
            Tháng {month.getMonth() + 1}, {month.getFullYear()}
          </Text>
          <Pressable
            onPress={() => changeMonth(1)}
            accessibilityLabel="Tháng sau"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={22} color={INK} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 13, color: SUB }}>
              {d}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {days.map((date, i) => {
            if (!date) return <View key={`e-${i}`} style={{ width: `${100 / 7}%`, height: 50 }} />;
            const selected = sameDate(date, draft);
            const hasData = dataKeys.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => setDraft(date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Ngày ${date.getDate()}${hasData ? ', có nhật ký' : ''}`}
                style={{ width: `${100 / 7}%`, height: 50, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? YELLOW : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: selected ? '800' : '500', color: INK }}>
                    {date.getDate()}
                  </Text>
                </View>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    marginTop: 1,
                    backgroundColor: hasData && !selected ? YELLOW : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: YELLOW }} />
          <Text style={{ fontSize: 13, color: SUB }}>Có nhật ký bữa ăn</Text>
        </View>
        <Button
          onPress={() => onConfirm(draft)}
          className="mb-2 h-[54px] w-full rounded-full bg-primary active:bg-[#E6AC00]"
        >
          <UIText className="text-[17px] font-extrabold text-[#48210B]">Xác nhận</UIText>
        </Button>
      </View>
    </Drawer>
  );
}
