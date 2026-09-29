/**
 * Nhật ký bữa ăn — redesign 29/09/2026 (màn 04, 07–12 + sheet 06/13).
 * Ngày / Tuần / Tháng / Năm, xu hướng tuần/tháng, tất cả tháng trong năm.
 * Mọi số liệu lấy từ /meal-logs/stats; ngày chưa ghi hiển thị “—”, không suy diễn 0 kcal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, CloudOff, Plus, RefreshCw } from '@/components/icons';
import { healthApi, type FormattedMealLog, type MealStatsResponse } from '../../services/api/health';
import { getDeviceTimeZone } from '../../lib/dates';
import { HealthDatePickerSheet } from '../../components/organisms/HealthDatePickerSheet';
import { NutritionSheet } from '../health/NutritionSheet';
import {
  BarChart,
  Bone,
  DatePill,
  EmptyThumb,
  HC,
  HCard,
  ListRow,
  MACROS,
  MEAL_SLOTS,
  OutlineButton,
  PrimaryButton,
  SLOT_LABEL,
  Segmented,
  SubHeader,
  Thumb,
  ThumbRow,
  fmtNum,
  formatTime,
  parseISODate,
  s,
  toLocalDateISO,
  weekdayFull,
  type BarDatum,
  type MealSlot,
} from '../health/HealthUI';

export type JournalPeriod = 'day' | 'week' | 'month' | 'year';

interface MealJournalScreenProps {
  onBack: () => void;
  onOpenDish?: (dishId: string, title?: string) => void;
  /** Mở form ghi bữa cho ngày/bữa đang xem. Không truyền thì ẩn CTA. */
  onLogMeal?: (date: Date, slot?: MealSlot) => void;
  initialPeriod?: JournalPeriod;
  initialDate?: Date;
}

type SubScreen = 'WEEK_TREND' | 'MONTH_TREND' | 'YEAR_ALL_MONTHS' | null;
type Metric = 'energy' | 'meals';

const PERIODS: Array<{ id: JournalPeriod; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

const METRICS: Array<{ id: Metric; label: string }> = [
  { id: 'energy', label: 'Năng lượng' },
  { id: 'meals', label: 'Số bữa' },
];

// ─── Date helpers ────────────────────────────────────────────────────────────

function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

function periodLabel(period: JournalPeriod, d: Date) {
  if (period === 'day') return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  if (period === 'week') {
    const a = startOfWeek(d);
    const b = new Date(a);
    b.setDate(a.getDate() + 6);
    return `${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}, ${b.getFullYear()}`;
  }
  if (period === 'month') return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  return `Năm ${d.getFullYear()}`;
}

function shiftDate(period: JournalPeriod, d: Date, dir: 1 | -1) {
  const r = new Date(d);
  if (period === 'day') r.setDate(r.getDate() + dir);
  else if (period === 'week') r.setDate(r.getDate() + 7 * dir);
  else if (period === 'month') r.setMonth(r.getMonth() + dir, 1);
  else r.setFullYear(r.getFullYear() + dir);
  return r;
}

function shortDate(iso: string) {
  const d = parseISODate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "1-7/9" → { start: 1, end: 7 } */
function parseWeekRange(subLabel: string, key: string) {
  const m = subLabel.match(/^(\d+)-(\d+)/);
  if (m) return { start: Number(m[1]), end: Number(m[2]) };
  const start = Number(key.replace('w-', '')) || 1;
  return { start, end: start + 6 };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function MealJournalScreen({
  onBack,
  onOpenDish,
  onLogMeal,
  initialPeriod = 'day',
  initialDate,
}: MealJournalScreenProps) {
  const tz = getDeviceTimeZone();
  const [period, setPeriod] = useState<JournalPeriod>(initialPeriod);
  const [date, setDate] = useState<Date>(() => initialDate ?? new Date());
  const [history, setHistory] = useState<Array<{ period: JournalPeriod; date: Date; sub: SubScreen }>>([]);
  const [sub, setSub] = useState<SubScreen>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => (initialDate ?? new Date()).toISOString().slice(0, 7));

  const iso = toLocalDateISO(date);

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['health', 'journal', period, iso, tz],
    queryFn: () => healthApi.getMealStats(period, iso, tz),
    staleTime: 15_000,
    placeholderData: (prev) => (prev && prev.period === period ? prev : undefined),
  });

  const { data: calendar } = useQuery({
    queryKey: ['health', 'calendar', pickerMonth, tz, 'nutrition-only'],
    queryFn: () => healthApi.getCalendar(pickerMonth, tz),
    enabled: pickerOpen,
    staleTime: 60_000,
  });
  const datesWithData = useMemo(
    () => (calendar?.days ?? []).filter((d: any) => d.hasMealLog).map((d: any) => parseISODate(d.localDate)),
    [calendar],
  );

  const pushAndGo = useCallback(
    (nextPeriod: JournalPeriod, nextDate: Date) => {
      setHistory((h) => [...h, { period, date, sub }]);
      setPeriod(nextPeriod);
      setDate(nextDate);
      setSub(null);
    },
    [period, date, sub],
  );

  const handleBack = useCallback(() => {
    if (sheetOpen) return setSheetOpen(false);
    if (sub) return setSub(null);
    const last = history[history.length - 1];
    if (last) {
      setHistory((h) => h.slice(0, -1));
      setPeriod(last.period);
      setDate(last.date);
      setSub(last.sub);
      return;
    }
    onBack();
  }, [sheetOpen, sub, history, onBack]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => h.remove();
  }, [handleBack]);

  const openDay = (dayIso: string) => pushAndGo('day', parseISODate(dayIso));
  const openMonth = (monthKey: string) => {
    const [y, m] = monthKey.split('-').map(Number);
    pushAndGo('month', new Date(y, m - 1, 1));
  };

  const navProps = {
    label: periodLabel(period, date),
    onPrev: () => setDate((d) => shiftDate(period, d, -1)),
    onNext: () => setDate((d) => shiftDate(period, d, 1)),
  };

  const body = (() => {
    if (isLoading && !stats) return <JournalSkeleton />;
    if (error && !stats) return <JournalError onRetry={() => void refetch()} />;
    if (!stats) return null;
    if (sub === 'WEEK_TREND') return <WeekTrend stats={stats} onSelectDay={openDay} />;
    if (sub === 'MONTH_TREND') return <MonthTrend stats={stats} onSelectDay={openDay} />;
    if (sub === 'YEAR_ALL_MONTHS') return <AllMonths stats={stats} onSelectMonth={openMonth} />;
    if (period === 'day')
      return (
        <DayView
          stats={stats}
          onOpenSheet={() => setSheetOpen(true)}
          onOpenDish={onOpenDish}
          onLogSlot={onLogMeal ? (slot) => onLogMeal(date, slot) : undefined}
        />
      );
    if (period === 'week')
      return <WeekView stats={stats} onOpenSheet={() => setSheetOpen(true)} onSelectDay={openDay} />;
    if (period === 'month')
      return (
        <MonthView
          stats={stats}
          onOpenSheet={() => setSheetOpen(true)}
          onSelectWeek={(start) => pushAndGo('week', new Date(date.getFullYear(), date.getMonth(), start))}
        />
      );
    return <YearView stats={stats} onOpenSheet={() => setSheetOpen(true)} onSelectMonth={openMonth} />;
  })();

  const title =
    sub === 'WEEK_TREND'
      ? 'Xu hướng tuần'
      : sub === 'MONTH_TREND'
        ? 'Xu hướng tháng'
        : sub === 'YEAR_ALL_MONTHS'
          ? 'Các tháng trong năm'
          : 'Nhật ký bữa ăn';

  const footer = (() => {
    if (sub || !stats) return null;
    if (period === 'day')
      return onLogMeal ? <PrimaryButton label="Ghi bữa ăn" onPress={() => onLogMeal(date)} /> : null;
    if (period === 'week') return <OutlineButton label="Xem xu hướng tuần" onPress={() => setSub('WEEK_TREND')} />;
    if (period === 'month') return <OutlineButton label="Xem xu hướng tháng" onPress={() => setSub('MONTH_TREND')} />;
    return <OutlineButton label="Xem tất cả tháng" onPress={() => setSub('YEAR_ALL_MONTHS')} />;
  })();

  const macroTotals = {
    protein: stats && stats.totalMeals > 0 ? stats.totals.proteinG : null,
    carbs: stats && stats.totalMeals > 0 ? stats.totals.carbsG : null,
    fat: stats && stats.totalMeals > 0 ? stats.totals.fatG : null,
  };

  return (
    <View style={s.safe}>
      <View style={{ paddingHorizontal: 20 }}>
        <SubHeader
          title={title}
          onBack={handleBack}
          align={period === 'day' || sub === 'YEAR_ALL_MONTHS' ? 'center' : sub ? 'center' : 'left'}
          right={isFetching && stats ? <ActivityIndicator size="small" color={HC.yellowDeep} /> : null}
        />
        {!sub ? <Segmented options={PERIODS} value={period} onChange={(p) => { setPeriod(p); setSub(null); }} /> : null}
        <DatePill
          label={sub === 'YEAR_ALL_MONTHS' ? String(date.getFullYear()) : navProps.label}
          showIcon={period === 'day'}
          onPrev={navProps.onPrev}
          onNext={navProps.onNext}
          onPress={() => {
            setPickerMonth(iso.slice(0, 7));
            setPickerOpen(true);
          }}
          style={{
            marginTop: 12,
            alignSelf: 'center',
            width: '78%',
            backgroundColor: period === 'day' ? HC.card : 'transparent',
            borderWidth: period === 'day' ? 1 : 0,
            shadowOpacity: period === 'day' ? 0.06 : 0,
            elevation: period === 'day' ? 2 : 0,
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>

      {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>{footer}</View> : null}

      <NutritionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        period={period}
        subtitle={periodLabel(period, date)}
        kcal={stats && stats.totalMeals > 0 ? stats.totals.kcal : null}
        dailyKcalTarget={stats?.targets.dailyKcalTarget ?? null}
        avgPerActiveDay={stats?.avgKcalPerActiveDay ?? null}
        macros={macroTotals}
      />

      <HealthDatePickerSheet
        visible={pickerOpen}
        value={date}
        datesWithData={datesWithData}
        onMonthChange={(m) => setPickerMonth(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setPickerOpen(false);
          setDate(d);
        }}
      />
    </View>
  );
}

// ─── Summary cards ───────────────────────────────────────────────────────────

function PeriodSummary({
  stats,
  onPress,
  showAvg = true,
}: {
  stats: MealStatsResponse;
  onPress: () => void;
  showAvg?: boolean;
}) {
  const has = stats.totalMeals > 0;
  return (
    <HCard onPress={onPress} accessibilityLabel="Xem dinh dưỡng của kỳ" style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
      <View style={{ flex: 1.1 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: HC.ink }}>
          {has ? fmtNum(stats.totals.kcal) : '—'} <Text style={{ fontSize: 18 }}>kcal</Text>
        </Text>
        <Text style={{ fontSize: 14, color: HC.sub, marginTop: 4 }}>{stats.totalMeals} bữa đã ghi</Text>
      </View>
      <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: HC.line, marginHorizontal: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>
          {stats.period === 'year' ? stats.daysLogged : `${stats.daysLogged}/${stats.totalDays}`}
        </Text>
        <Text style={{ fontSize: 12, color: HC.sub }}>ngày có nhật ký</Text>
        {showAvg ? (
          <>
            <View style={{ height: 1, backgroundColor: HC.line, marginVertical: 8 }} />
            <Text style={{ fontSize: 12, color: HC.sub }}>TB ngày có ghi</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: HC.ink }}>
              {stats.daysLogged > 0 ? `${fmtNum(stats.avgKcalPerActiveDay)} kcal` : '—'}
            </Text>
          </>
        ) : null}
      </View>
    </HCard>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <HCard style={{ marginTop: 14 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: HC.ink, marginBottom: 12 }}>{title}</Text>
      {children}
    </HCard>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 17, fontWeight: '800', color: HC.ink, marginTop: 20, marginBottom: 10 }}>{children}</Text>;
}

// ─── Day (04) ────────────────────────────────────────────────────────────────

function DayView({
  stats,
  onOpenSheet,
  onOpenDish,
  onLogSlot,
}: {
  stats: MealStatsResponse;
  onOpenSheet: () => void;
  onOpenDish?: (id: string, title?: string) => void;
  onLogSlot?: (slot: MealSlot) => void;
}) {
  const has = stats.totalMeals > 0;
  const meals = [...(stats.items ?? [])].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  const bySlot = (slot: string) => meals.filter((m) => m.mealSlot === slot);
  const macroVal = { protein: stats.totals.proteinG, carbs: stats.totals.carbsG, fat: stats.totals.fatG };

  return (
    <View>
      <HCard onPress={onOpenSheet} accessibilityLabel="Xem dinh dưỡng ngày" style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: HC.ink }}>
            {has ? fmtNum(stats.totals.kcal) : '—'} <Text style={{ fontSize: 18 }}>kcal</Text>
          </Text>
          <Text style={{ fontSize: 14, color: HC.sub }}>{stats.totalMeals} bữa đã ghi</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {MACROS.map((m) => (
            <View key={m.key} style={{ flex: 1, borderRadius: 14, backgroundColor: HC.chip, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: HC.sub }}>{m.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: HC.ink, marginTop: 2 }}>
                {has ? `${fmtNum(macroVal[m.key])} g` : '—'}
              </Text>
            </View>
          ))}
        </View>
      </HCard>

      <View style={{ gap: 12, marginTop: 14 }}>
        {MEAL_SLOTS.map((slot) => {
          const list = bySlot(slot);
          const kcal = list.reduce((acc, m) => acc + (m.totals?.kcal ?? 0), 0);
          return (
            <HCard key={slot} style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: HC.ink }}>{SLOT_LABEL[slot]}</Text>
                {list.length ? <Text style={{ fontSize: 15, fontWeight: '800', color: HC.ink }}>{fmtNum(kcal)} kcal</Text> : null}
              </View>
              {list.length === 0 ? (
                <Pressable
                  onPress={() => onLogSlot?.(slot)}
                  disabled={!onLogSlot}
                  accessibilityRole="button"
                  accessibilityLabel={`Ghi ${SLOT_LABEL[slot]}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: HC.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={20} color={HC.ink} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: HC.sub }}>Chưa ghi bữa</Text>
                  {onLogSlot ? <ChevronRight size={18} color={HC.ink} /> : null}
                </Pressable>
              ) : (
                list.map((meal) => <MealItemRow key={meal.id} meal={meal} onOpenDish={onOpenDish} />)
              )}
            </HCard>
          );
        })}
      </View>
    </View>
  );
}

function MealItemRow({ meal, onOpenDish }: { meal: FormattedMealLog; onOpenDish?: (id: string, title?: string) => void }) {
  const first = meal.items?.[0];
  const name = meal.items?.map((i) => i.displayName).join(', ') || 'Món ăn';
  const dishId = meal.items?.find((i) => i.referenceId)?.referenceId;
  return (
    <Pressable
      onPress={() => dishId && onOpenDish?.(dishId, first?.displayName)}
      disabled={!dishId || !onOpenDish}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatTime(meal.occurredAt)}`}
      className="active:opacity-75"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}
    >
      <Thumb uri={first?.thumbnailUrl} width={78} height={60} radius={12} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: HC.ink }}>{name}</Text>
        <Text style={{ fontSize: 13, color: HC.sub, marginTop: 3 }}>{formatTime(meal.occurredAt)}</Text>
      </View>
      {dishId && onOpenDish ? <ChevronRight size={18} color={HC.ink} /> : null}
    </Pressable>
  );
}

// ─── Week (07) ───────────────────────────────────────────────────────────────

function weekBars(stats: MealStatsResponse, metric: Metric): BarDatum[] {
  return stats.series.map((it) => ({
    key: it.key,
    label: it.label,
    subLabel: it.subLabel,
    value: it.mealCount > 0 ? (metric === 'energy' ? it.consumedKcal ?? it.kcal : it.mealCount) : null,
  }));
}

function DayRows({
  stats,
  onSelectDay,
  labelStyle = 'weekday-first',
}: {
  stats: MealStatsResponse;
  onSelectDay: (iso: string) => void;
  labelStyle?: 'weekday-first' | 'date-first';
}) {
  const groups = new Map(stats.dayGroups.map((g) => [g.localDate, g]));
  return (
    <View style={{ gap: 10 }}>
      {stats.series.map((it) => {
        const dayIso = it.date ?? it.key;
        const g = groups.get(dayIso);
        const title =
          labelStyle === 'weekday-first'
            ? `${weekdayFull(dayIso)}, ${shortDate(dayIso)}`
            : `${shortDate(dayIso)}, ${weekdayFull(dayIso)}`;
        return (
          <ListRow
            key={it.key}
            title={title}
            subtitle={g ? `${fmtNum(g.consumedKcal)} kcal` : 'Chưa có nhật ký'}
            muted={!g}
            right={g ? <ThumbRow urls={g.previewMediaUrls} /> : labelStyle === 'date-first' ? <Text style={{ color: HC.sub }}>–</Text> : <EmptyThumb />}
            onPress={() => onSelectDay(dayIso)}
          />
        );
      })}
    </View>
  );
}

function WeekView({
  stats,
  onOpenSheet,
  onSelectDay,
}: {
  stats: MealStatsResponse;
  onOpenSheet: () => void;
  onSelectDay: (iso: string) => void;
}) {
  return (
    <View>
      <PeriodSummary stats={stats} onPress={onOpenSheet} />
      <ChartCard title="Năng lượng theo ngày">
        <BarChart
          data={weekBars(stats, 'energy')}
          showValues
          onPressItem={(d) => onSelectDay(d.key)}
        />
      </ChartCard>
      <SectionHeading>Các ngày trong tuần</SectionHeading>
      <DayRows stats={stats} onSelectDay={onSelectDay} />
    </View>
  );
}

// ─── Month (08) ──────────────────────────────────────────────────────────────

function monthWeeks(stats: MealStatsResponse) {
  const month = Number(stats.startDate.slice(5, 7));
  return stats.weeklySeries.map((w) => {
    const { start, end } = parseWeekRange(w.subLabel, w.key);
    const days = stats.dayGroups.filter((g) => {
      const n = Number(g.localDate.slice(8, 10));
      return n >= start && n <= end;
    });
    const thumbs = days
      .slice()
      .sort((a, b) => a.localDate.localeCompare(b.localDate))
      .flatMap((g) => g.previewMediaUrls);
    return { ...w, start, end, month, daysLogged: days.length, length: end - start + 1, thumbs };
  });
}

function MonthView({
  stats,
  onOpenSheet,
  onSelectWeek,
}: {
  stats: MealStatsResponse;
  onOpenSheet: () => void;
  onSelectWeek: (startDay: number) => void;
}) {
  const weeks = monthWeeks(stats);
  return (
    <View>
      <PeriodSummary stats={stats} onPress={onOpenSheet} />
      <ChartCard title="Năng lượng theo tuần">
        <BarChart
          data={weeks.map((w) => ({
            key: w.key,
            label: w.label,
            subLabel: `${w.start}–${w.end}/${w.month}`,
            value: w.mealCount > 0 ? w.consumedKcal : null,
          }))}
          showValues
          barWidth={44}
          onPressItem={(d) => onSelectWeek(weeks.find((w) => w.key === d.key)?.start ?? 1)}
        />
      </ChartCard>
      <SectionHeading>Các tuần trong tháng</SectionHeading>
      <View style={{ gap: 10 }}>
        {weeks.map((w) => (
          <ListRow
            key={w.key}
            title={`${w.label} (${w.start} – ${w.end}/${w.month})`}
            subtitle={
              w.daysLogged > 0
                ? `${w.daysLogged}/${w.length} ngày có nhật ký · ${fmtNum(w.consumedKcal)} kcal`
                : 'Chưa có nhật ký'
            }
            muted={w.daysLogged === 0}
            right={w.daysLogged > 0 ? <ThumbRow urls={w.thumbs} size={36} /> : <EmptyThumb size={36} />}
            onPress={() => onSelectWeek(w.start)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Year (09) ───────────────────────────────────────────────────────────────

function yearBars(stats: MealStatsResponse, metric: Metric): BarDatum[] {
  return stats.series.map((it) => ({
    key: it.key,
    label: it.label,
    value: it.mealCount > 0 ? (metric === 'energy' ? it.consumedKcal ?? it.kcal : it.mealCount) : null,
  }));
}

function YearView({
  stats,
  onOpenSheet,
  onSelectMonth,
}: {
  stats: MealStatsResponse;
  onOpenSheet: () => void;
  onSelectMonth: (key: string) => void;
}) {
  const withData = stats.monthGroups.filter((m) => m.hasData);
  return (
    <View>
      <PeriodSummary stats={stats} onPress={onOpenSheet} showAvg={false} />
      <ChartCard title="Năng lượng theo tháng">
        <BarChart data={yearBars(stats, 'energy')} showValues emptyStyle="dash" barWidth={16} onPressItem={(d) => onSelectMonth(d.key)} />
      </ChartCard>
      <SectionHeading>Các tháng có dữ liệu</SectionHeading>
      {withData.length === 0 ? (
        <HCard style={{ alignItems: 'center', paddingVertical: 24 }}>
          <EmptyThumb size={44} />
          <Text style={{ fontSize: 14, color: HC.sub, marginTop: 10 }}>Chưa có nhật ký trong năm này</Text>
        </HCard>
      ) : (
        <View style={{ gap: 10 }}>
          {withData.map((m) => (
            <ListRow
              key={m.monthKey}
              title={m.label}
              subtitle={`${m.mealCount} bữa đã ghi · ${fmtNum(m.consumedKcal)} kcal`}
              right={<ThumbRow urls={m.previewMediaUrls} size={36} />}
              onPress={() => onSelectMonth(m.monthKey)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Trends (10, 11) ─────────────────────────────────────────────────────────

function CoverageCard({ main, sub: subText }: { main: React.ReactNode; sub?: string }) {
  return (
    <HCard style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: HC.yellowSoft, alignItems: 'center', justifyContent: 'center' }}>
        <CalendarDays size={22} color={HC.ink} />
      </View>
      <View style={{ flex: 1 }}>
        {main}
        {subText ? <Text style={{ fontSize: 13, color: HC.sub, marginTop: 2 }}>{subText}</Text> : null}
      </View>
    </HCard>
  );
}

function WeekTrend({ stats, onSelectDay }: { stats: MealStatsResponse; onSelectDay: (iso: string) => void }) {
  const [metric, setMetric] = useState<Metric>('energy');
  return (
    <View>
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      <HCard style={{ marginTop: 14 }}>
        <BarChart
          data={weekBars(stats, metric)}
          yAxis
          unitLabel={metric === 'energy' ? '(kcal)' : '(bữa)'}
          emptyStyle="dash"
          height={170}
          onPressItem={(d) => onSelectDay(d.key)}
        />
      </HCard>
      <CoverageCard
        main={
          <Text style={{ fontSize: 15, color: HC.sub }}>
            Ngày có nhật ký: <Text style={{ fontSize: 18, fontWeight: '800', color: HC.ink }}>{stats.daysLogged}/{stats.totalDays}</Text>
          </Text>
        }
      />
      <SectionHeading>Thống kê từ các bữa đã ghi</SectionHeading>
      <DayRows stats={stats} onSelectDay={onSelectDay} labelStyle="date-first" />
    </View>
  );
}

function MonthTrend({ stats, onSelectDay }: { stats: MealStatsResponse; onSelectDay: (iso: string) => void }) {
  const [metric, setMetric] = useState<Metric>('energy');
  const weeks = monthWeeks(stats);
  const days = [...stats.dayGroups].sort((a, b) => a.localDate.localeCompare(b.localDate));
  return (
    <View>
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      <HCard style={{ marginTop: 14 }}>
        <BarChart
          data={weeks.map((w) => ({
            key: w.key,
            label: w.label,
            subLabel: `${w.start}–${w.end}/${w.month}`,
            value: w.mealCount > 0 ? (metric === 'energy' ? w.consumedKcal : w.mealCount) : null,
          }))}
          yAxis
          unitLabel={metric === 'energy' ? '(kcal)' : '(bữa)'}
          emptyStyle="dash"
          height={170}
          barWidth={40}
        />
      </HCard>
      <CoverageCard
        main={
          <Text style={{ fontSize: 15, color: HC.sub }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: HC.ink }}>{stats.daysLogged}/{stats.totalDays}</Text> ngày có nhật ký
          </Text>
        }
        sub={stats.daysLogged > 0 ? `TB ngày có ghi · ${fmtNum(stats.avgKcalPerActiveDay)} kcal` : 'Chưa có ngày nào được ghi'}
      />
      <SectionHeading>Nhật ký theo ngày</SectionHeading>
      {days.length === 0 ? (
        <HCard style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 14, color: HC.sub }}>Chưa có nhật ký trong tháng này</Text>
        </HCard>
      ) : (
        <View style={{ gap: 10 }}>
          {days.map((g) => (
            <ListRow
              key={g.localDate}
              title={`${shortDate(g.localDate)}, ${weekdayFull(g.localDate)}`}
              subtitle={`${fmtNum(g.consumedKcal)} kcal`}
              right={<ThumbRow urls={g.previewMediaUrls} />}
              onPress={() => onSelectDay(g.localDate)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── All months (12) ─────────────────────────────────────────────────────────

function AllMonths({ stats, onSelectMonth }: { stats: MealStatsResponse; onSelectMonth: (key: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'data'>('all');
  const list = filter === 'all' ? stats.monthGroups : stats.monthGroups.filter((m) => m.hasData);
  return (
    <View>
      <Segmented
        options={[
          { id: 'all', label: 'Tất cả' },
          { id: 'data', label: 'Có dữ liệu' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <View style={{ gap: 10, marginTop: 14 }}>
        {list.length === 0 ? (
          <HCard style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={{ fontSize: 14, color: HC.sub }}>Chưa có tháng nào có nhật ký</Text>
          </HCard>
        ) : (
          list.map((m) => (
            <ListRow
              key={m.monthKey}
              title={`Tháng ${m.monthNumber}`}
              subtitle={m.hasData ? `${m.mealCount} bữa đã ghi` : 'Chưa có nhật ký'}
              right={
                m.hasData ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: HC.ink }}>{fmtNum(m.consumedKcal)} kcal</Text>
                    <ThumbRow urls={m.previewMediaUrls} max={2} size={34} />
                  </View>
                ) : (
                  <Text style={{ fontSize: 15, color: HC.sub }}>–</Text>
                )
              }
              onPress={() => onSelectMonth(m.monthKey)}
            />
          ))
        )}
      </View>
    </View>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────

function JournalSkeleton() {
  return (
    <View accessibilityLabel="Đang tải nhật ký">
      <HCard style={{ gap: 12 }}>
        <Bone w="45%" h={26} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Bone w="31%" h={46} r={14} />
          <Bone w="31%" h={46} r={14} />
          <Bone w="31%" h={46} r={14} />
        </View>
      </HCard>
      {[0, 1, 2].map((i) => (
        <HCard key={i} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bone w={64} h={52} r={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone w="60%" h={14} />
            <Bone w="35%" h={12} />
          </View>
        </HCard>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}>
        <ActivityIndicator size="small" color={HC.sub} />
        <Text style={{ fontSize: 14, color: HC.sub }}>Đang tải nhật ký…</Text>
      </View>
    </View>
  );
}

export function JournalError({ onRetry }: { onRetry: () => void }) {
  return (
    <HCard style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, marginTop: 12 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: HC.yellowSoft, alignItems: 'center', justifyContent: 'center' }}>
        <CloudOff size={44} color={HC.ink} />
      </View>
      <Text style={{ fontSize: 19, fontWeight: '800', color: HC.ink, marginTop: 18 }}>Chưa tải được nhật ký</Text>
      <Text style={{ fontSize: 14, color: HC.sub, marginTop: 6, textAlign: 'center' }}>Kiểm tra kết nối và thử lại nhé</Text>
      <PrimaryButton
        label="Thử lại"
        icon={<RefreshCw size={20} color={HC.ink} />}
        onPress={onRetry}
        style={{ alignSelf: 'stretch', marginTop: 20 }}
      />
    </HCard>
  );
}
