import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { HealthDayResponse } from '../../services/api/health';
import {
  DatePill,
  HC,
  HCard,
  InfoNote,
  MACROS,
  MEAL_SLOTS,
  MacroIcon,
  SLOT_LABEL,
  SlotIcon,
  SubHeader,
  fmtNum,
  formatDayLabel,
  s,
} from './HealthUI';
import { ChevronRight } from '@/components/icons';
import { Pressable } from 'react-native';

type Props = {
  day?: HealthDayResponse;
  date: Date;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPickDate: () => void;
  onOpenNutrition: () => void;
  onOpenJournal: () => void;
};

function Ring({ consumed, target }: { consumed: number | null; target: number | null }) {
  const size = 150;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = consumed != null && target && target > 0 ? Math.min(1, consumed / target) : consumed ? 1 : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#FBEFCB" strokeWidth={stroke} fill="none" />
        {ratio > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={HC.yellow}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * ratio} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={{ fontSize: 26, fontWeight: '800', color: HC.ink }}>{consumed == null ? '—' : fmtNum(consumed)}</Text>
      <Text style={{ fontSize: 14, color: HC.ink }}>kcal</Text>
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginTop: 4 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: HC.sub }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>{value}</Text>
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      className="active:opacity-70"
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: HC.line,
      }}
    >
      <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 15, color: HC.ink }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: HC.ink }}>{value}</Text>
      <ChevronRight size={18} color={HC.ink} />
    </Pressable>
  );
}

export function HealthOverviewScreen({
  day,
  date,
  onBack,
  onPrev,
  onNext,
  onPickDate,
  onOpenNutrition,
  onOpenJournal,
}: Props) {
  const consumed = day?.energy.consumedKcal ?? null;
  const target = day?.energy.targetKcal ?? null;
  const over = consumed != null && target != null && consumed > target;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ paddingHorizontal: 20 }}>
        <SubHeader title="Tổng quan dinh dưỡng" onBack={onBack} />
        <DatePill label={formatDayLabel(date)} onPrev={onPrev} onNext={onNext} onPress={onPickDate} style={{ marginHorizontal: 20 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <HCard>
          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>Năng lượng</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 18 }}>
            <Ring consumed={consumed} target={target} />
            <View style={{ flex: 1 }}>
              <Legend color={HC.yellow} label="Đã ghi" value={consumed == null ? '—' : `${fmtNum(consumed)} kcal`} />
              <Legend color="#FBEFCB" label="Mục tiêu" value={target == null ? 'Chưa đặt' : `${fmtNum(target)} kcal`} />
              {target != null ? (
                <Legend
                  color={HC.track}
                  label={over ? 'Vượt mục tiêu' : 'Còn lại'}
                  value={`${fmtNum(over ? (consumed as number) - target : day?.energy.remainingKcal ?? target - (consumed ?? 0))} kcal`}
                />
              ) : null}
            </View>
          </View>
        </HCard>

        <HCard style={{ marginTop: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink, marginTop: 6, marginBottom: 4 }}>
            Dinh dưỡng đã ghi
          </Text>
          {MACROS.map((m, i) => {
            const v = day?.macros[m.key].consumedG ?? null;
            return (
              <Row
                key={m.key}
                icon={<MacroIcon kind={m.key} size={20} />}
                label={m.label}
                value={v == null ? '—' : `${fmtNum(v)} g`}
                onPress={onOpenNutrition}
                last={i === MACROS.length - 1}
              />
            );
          })}
        </HCard>

        <HCard style={{ marginTop: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink, marginTop: 6, marginBottom: 4 }}>Theo bữa</Text>
          {MEAL_SLOTS.map((slot, i) => {
            const g = day?.mealGroups.find((x) => x.mealSlot === slot);
            const has = !!g && g.meals.length > 0;
            return (
              <Row
                key={slot}
                icon={<SlotIcon slot={slot} />}
                label={SLOT_LABEL[slot]}
                value={has ? `${fmtNum(g!.totalKcal)} kcal` : '—'}
                onPress={onOpenJournal}
                last={i === MEAL_SLOTS.length - 1}
              />
            );
          })}
        </HCard>

        <InfoNote style={{ marginTop: 14, backgroundColor: 'transparent', paddingHorizontal: 4 }}>
          Số liệu tính từ các bữa đã ghi.
        </InfoNote>
      </ScrollView>
    </SafeAreaView>
  );
}
