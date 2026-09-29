import { ScrollView, Pressable, Text, View } from 'react-native';
import { ChevronRight, Flame, X } from '@/components/icons';
import { Drawer } from '../../components/ui/drawer';
import {
  HC,
  InfoNote,
  MACROS,
  MacroBadge,
  PrimaryButton,
  ProgressBar,
  fmtNum,
  type MacroKey,
} from './HealthUI';

export type NutritionSheetPeriod = 'day' | 'week' | 'month' | 'year';

const TITLES: Record<NutritionSheetPeriod, string> = {
  day: 'Dinh dưỡng ngày',
  week: 'Dinh dưỡng tuần',
  month: 'Dinh dưỡng tháng',
  year: 'Dinh dưỡng năm',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  period: NutritionSheetPeriod;
  subtitle: string;
  kcal: number | null;
  /** Mục tiêu năng lượng trong ngày — chỉ dùng tính % với kỳ ngày. */
  dailyKcalTarget?: number | null;
  /** TB kcal trên ngày có ghi (kỳ tuần/tháng/năm). */
  avgPerActiveDay?: number | null;
  macros: Record<MacroKey, number | null>;
  /** Chỉ truyền khi người dùng thực sự đặt mục tiêu macro. */
  macroTargets?: Partial<Record<MacroKey, number | null>>;
  onPressMacro?: (key: MacroKey) => void;
};

export function NutritionSheet({
  visible,
  onClose,
  period,
  subtitle,
  kcal,
  dailyKcalTarget,
  avgPerActiveDay,
  macros,
  macroTargets,
  onPressMacro,
}: Props) {
  const isDay = period === 'day';
  const target = isDay ? dailyKcalTarget ?? null : null;
  const pct = target && target > 0 && kcal != null ? Math.round((kcal / target) * 100) : null;

  return (
    <Drawer open={visible} onOpenChange={(o) => !o && onClose()} snapHeight={640} sheetBackgroundColor={HC.card}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: HC.ink }}>{TITLES[period]}</Text>
            <Text style={{ fontSize: 14, color: HC.sub, marginTop: 2 }}>{subtitle}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Đóng"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -10 }}
          >
            <X size={22} color={HC.ink} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, marginTop: 14 }} showsVerticalScrollIndicator={false}>
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: HC.line,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: HC.yellowSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Flame size={22} color={HC.yellowDeep} fill={HC.yellow} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: HC.sub }}>Năng lượng đã ghi</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: HC.ink }}>
                  {kcal == null ? '—' : `${fmtNum(kcal)} kcal`}
                </Text>
              </View>
            </View>
            {isDay ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: HC.sub }}>
                    {target != null ? `Mục tiêu ${fmtNum(target)} kcal` : 'Chưa đặt mục tiêu'}
                  </Text>
                  {pct != null ? <Text style={{ fontSize: 13, fontWeight: '800', color: HC.ink }}>{pct}%</Text> : null}
                </View>
                {pct != null ? <ProgressBar value={pct} style={{ marginTop: 8 }} /> : null}
              </>
            ) : (
              <Text style={{ fontSize: 13, color: HC.sub, marginTop: 6 }}>
                {avgPerActiveDay && avgPerActiveDay > 0
                  ? `TB ngày có ghi · ${fmtNum(avgPerActiveDay)} kcal`
                  : 'Chưa có ngày nào được ghi'}
              </Text>
            )}
          </View>

          <View style={{ gap: 10, marginTop: 12 }}>
            {MACROS.map((m) => {
              const v = macros[m.key];
              const t = macroTargets?.[m.key] ?? null;
              return (
                <Pressable
                  key={m.key}
                  disabled={!onPressMacro}
                  onPress={() => onPressMacro?.(m.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: HC.line,
                    padding: 12,
                  }}
                >
                  <MacroBadge kind={m.key} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>
                      {m.label} · {v == null ? '—' : `${fmtNum(v)} g`}
                    </Text>
                    <Text style={{ fontSize: 13, color: HC.sub, marginTop: 2 }}>
                      {t != null && isDay ? `Mục tiêu ${fmtNum(t)} g` : 'Chưa đặt mục tiêu'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={HC.ink} />
                </Pressable>
              );
            })}
          </View>

          <InfoNote style={{ marginTop: 12 }}>
            Tổng hợp từ các bữa đã ghi.{'\n'}Dữ liệu có thể chưa đầy đủ.
          </InfoNote>
        </ScrollView>

        <PrimaryButton label="Đóng" onPress={onClose} style={{ marginTop: 12, marginBottom: 8 }} />
      </View>
    </Drawer>
  );
}
