/**
 * Sức khỏe — redesign 29/09/2026 (màn 01, 02, 14, 15).
 * Chỉ dùng dữ liệu bữa ăn từ /health/days (không nước, bước chân, calo tiêu hao).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronRight, CloudOff, FileText, MoreVertical, Plus, RefreshCw, Utensils } from '@/components/icons';
import { ExploreDetailScreen } from './ExploreDetailScreen';
import { HealthOverviewScreen } from './health/HealthOverviewScreen';
import { LogMealScreen } from './health/LogMealScreen';
import { NutritionSheet } from './health/NutritionSheet';
import { MealJournalScreen } from './meal-journal/MealJournalScreen';
import { HealthDatePickerSheet } from '../components/organisms/HealthDatePickerSheet';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import { healthApi, type HealthDayResponse } from '../services/api/health';
import { recordMealLoggedStore } from '../services/app-store';
import { getDeviceTimeZone } from '../lib/dates';
import {
  Bone,
  DatePill,
  HC,
  HCard,
  MACROS,
  MEAL_SLOTS,
  MacroIcon,
  PrimaryButton,
  ProgressBar,
  SLOT_LABEL,
  Thumb,
  fmtNum,
  formatDayLabel,
  parseISODate,
  s,
  toLocalDateISO,
  type MacroKey,
  type MealSlot,
} from './health/HealthUI';

const mascot = require('../assets/images/noan/noan-mascot-master-v1.png');

type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onProfile: () => void;
  onNotification?: () => void;
};

type DayMeal = HealthDayResponse['mealGroups'][number]['meals'][number];

/** Khoảng trống cho CTA cố định + navbar. */
const CTA_BOTTOM = 116;
const SCROLL_BOTTOM = CTA_BOTTOM + 72;

export function HealthScreen({ onHome, onExplore, onRandom, onProfile, onNotification }: Props) {
  const timezone = getDeviceTimeZone();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<{ date: Date; slot?: MealSlot } | null>(null);
  const [foodDishId, setFoodDishId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => toLocalDateISO(new Date()).slice(0, 7));
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const localDate = toLocalDateISO(selectedDate);

  const {
    data: day,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['health', 'day', localDate, timezone, 'nutrition-only'],
    queryFn: () => healthApi.getDay(localDate, timezone),
    staleTime: 10_000,
  });

  const { data: calendar } = useQuery({
    queryKey: ['health', 'calendar', pickerMonth, timezone, 'nutrition-only'],
    queryFn: () => healthApi.getCalendar(pickerMonth, timezone),
    enabled: pickerOpen,
    staleTime: 60_000,
  });
  const datesWithData = useMemo(
    () => (calendar?.days ?? []).filter((d: any) => d.hasMealLog).map((d: any) => parseISODate(d.localDate)),
    [calendar],
  );

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toastAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 2200);
    return () => clearTimeout(t);
  }, [toast, toastAnim]);

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['health'] });
  }, [queryClient]);

  const shiftDay = (dir: 1 | -1) =>
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + dir);
      return n;
    });

  const openPicker = () => {
    setPickerMonth(localDate.slice(0, 7));
    setPickerOpen(true);
  };

  const mealCount = day?.mealGroups.reduce((acc, g) => acc + g.meals.length, 0) ?? 0;
  const hasMeals = mealCount > 0;
  const loading = isLoading && !day;
  const failed = !!error && !day;

  const handleMealMenu = (meal: DayMeal) => {
    const dishId = meal.items.find((i) => i.referenceId)?.referenceId;
    Alert.alert(SLOT_LABEL[meal.mealSlot] ?? 'Bữa ăn', meal.items.map((i) => i.displayName).join(', '), [
      ...(dishId ? [{ text: 'Xem món', onPress: () => setFoodDishId(dishId) }] : []),
      {
        text: 'Xoá bữa này',
        style: 'destructive' as const,
        onPress: async () => {
          try {
            await healthApi.deleteMealLog(meal.id, meal.version ?? 1);
            await refreshAll();
            setToast('Đã xoá bữa ăn');
          } catch (e: any) {
            Alert.alert('Không xoá được', e?.message || 'Vui lòng thử lại.');
          }
        },
      },
      { text: 'Huỷ', style: 'cancel' as const },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: HC.ink }}>Sức khỏe</Text>
          <Pressable
            onPress={onNotification}
            disabled={!onNotification}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 }}
          >
            <Bell size={24} color={HC.ink} />
          </Pressable>
        </View>
        <DatePill
          label={formatDayLabel(selectedDate)}
          onPrev={() => shiftDay(-1)}
          onNext={() => shiftDay(1)}
          onPress={openPicker}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: failed ? 140 : SCROLL_BOTTOM }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={HC.yellowDeep}
            colors={[HC.yellowDeep]}
            onRefresh={() => {
              setRefreshing(true);
              void refetch().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {loading ? (
          <HealthLoading />
        ) : failed ? (
          <HealthError onRetry={() => void refetch()} />
        ) : (
          <>
            <EnergyCard day={day} hasMeals={hasMeals} onPress={() => setOverviewOpen(true)} />
            <MacroRow day={day} hasMeals={hasMeals} onPress={() => setSheetOpen(true)} />
            {hasMeals ? (
              <JournalCard
                day={day!}
                mealCount={mealCount}
                onOpenJournal={() => setJournalOpen(true)}
                onOpenMeal={(meal) => {
                  const dishId = meal.items.find((i) => i.referenceId)?.referenceId;
                  if (dishId) setFoodDishId(dishId);
                  else setJournalOpen(true);
                }}
                onMealMenu={handleMealMenu}
              />
            ) : (
              <>
                <HCard
                  onPress={() => setJournalOpen(true)}
                  accessibilityLabel="Nhật ký bữa ăn, chưa ghi bữa nào"
                  style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <JournalIcon />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>Nhật ký bữa ăn</Text>
                    <Text style={{ fontSize: 13, color: HC.sub, marginTop: 2 }}>Chưa ghi bữa nào</Text>
                  </View>
                  <ChevronRight size={20} color={HC.ink} />
                </HCard>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, minHeight: 140 }}>
                  <Image source={mascot} style={{ width: 150, height: 140 }} resizeMode="contain" />
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: HC.ink, textAlign: 'center', marginBottom: 44 }}>
                    Bắt đầu từ bữa ăn{'\n'}của bạn nhé
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Fixed CTA */}
      {!failed ? (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: CTA_BOTTOM }}>
          <PrimaryButton
            label={loading ? 'Đang tải…' : 'Ghi bữa ăn'}
            icon={loading ? undefined : <Plus size={22} color={HC.ink} strokeWidth={2.6} />}
            disabled={loading}
            onPress={() => setLogTarget({ date: selectedDate })}
          />
        </View>
      ) : null}

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: HC.ink,
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{toast}</Text>
        </Animated.View>
      ) : null}

      <LiquidGlassBottomNav active="health" onHome={onHome} onExplore={onExplore} onRandom={onRandom} onProfile={onProfile} />

      <NutritionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        period="day"
        subtitle={`${selectedDate.getDate()} tháng ${selectedDate.getMonth() + 1}, ${selectedDate.getFullYear()}`}
        kcal={hasMeals ? day?.energy.consumedKcal ?? null : null}
        dailyKcalTarget={day?.energy.targetKcal ?? null}
        macros={{
          protein: hasMeals ? day?.macros.protein.consumedG ?? null : null,
          carbs: hasMeals ? day?.macros.carbs.consumedG ?? null : null,
          fat: hasMeals ? day?.macros.fat.consumedG ?? null : null,
        }}
        macroTargets={{
          protein: day?.macros.protein.targetG ?? null,
          carbs: day?.macros.carbs.targetG ?? null,
          fat: day?.macros.fat.targetG ?? null,
        }}
      />

      <HealthDatePickerSheet
        visible={pickerOpen}
        value={selectedDate}
        datesWithData={datesWithData}
        onMonthChange={(m) => setPickerMonth(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setPickerOpen(false);
          setSelectedDate(d);
        }}
      />

      {/* ── Sub screens ── */}
      <ScreenSlideTransition visible={overviewOpen} direction="right" onBack={() => setOverviewOpen(false)}>
        {overviewOpen ? (
          <HealthOverviewScreen
            day={day}
            date={selectedDate}
            onBack={() => setOverviewOpen(false)}
            onPrev={() => shiftDay(-1)}
            onNext={() => shiftDay(1)}
            onPickDate={openPicker}
            onOpenNutrition={() => setSheetOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
          />
        ) : null}
      </ScreenSlideTransition>

      {/* Journal tự xử lý nút back phần cứng (lịch sử drill-down) */}
      <ScreenSlideTransition visible={journalOpen} direction="right">
        {journalOpen ? (
          <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
            <MealJournalScreen
              initialDate={selectedDate}
              onBack={() => setJournalOpen(false)}
              onOpenDish={(id) => setFoodDishId(id)}
              onLogMeal={(date, slot) => setLogTarget({ date, slot })}
            />
          </SafeAreaView>
        ) : null}
      </ScreenSlideTransition>

      <ScreenSlideTransition visible={!!logTarget} direction="bottom" onBack={() => setLogTarget(null)}>
        {logTarget ? (
          <LogMealScreen
            date={logTarget.date}
            initialSlot={logTarget.slot ?? guessSlot()}
            onClose={() => setLogTarget(null)}
            onSaved={() => {
              recordMealLoggedStore();
              setLogTarget(null);
              setToast('Đã lưu bữa ăn');
              void refreshAll();
            }}
          />
        ) : null}
      </ScreenSlideTransition>

      <ScreenSlideTransition visible={!!foodDishId} direction="right" onBack={() => setFoodDishId(null)}>
        {foodDishId ? <ExploreDetailScreen type="food" resourceId={foodDishId} onBack={() => setFoodDishId(null)} /> : null}
      </ScreenSlideTransition>
    </SafeAreaView>
  );
}

function guessSlot(): MealSlot {
  const h = new Date().getHours();
  if (h < 10) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function JournalIcon() {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: HC.chip, alignItems: 'center', justifyContent: 'center' }}>
      <FileText size={22} color={HC.ink} />
    </View>
  );
}

function EnergyCard({ day, hasMeals, onPress }: { day?: HealthDayResponse; hasMeals: boolean; onPress: () => void }) {
  const consumed = day?.energy.consumedKcal ?? 0;
  const target = day?.energy.targetKcal ?? null;

  if (!hasMeals) {
    return (
      <HCard onPress={onPress} accessibilityLabel="Năng lượng đã ghi, chưa ghi bữa ăn" style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Text style={{ alignSelf: 'flex-start', fontSize: 15, fontWeight: '600', color: HC.ink }}>Năng lượng đã ghi</Text>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: HC.chip, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Utensils size={28} color={HC.muted} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: HC.ink, marginTop: 12 }}>Chưa ghi bữa ăn</Text>
        <Text style={{ fontSize: 14, color: HC.sub, marginTop: 4 }}>Ghi bữa đầu tiên để theo dõi dinh dưỡng</Text>
        {target != null ? (
          <Text style={{ fontSize: 14, color: HC.sub, marginTop: 6 }}>Mục tiêu: {fmtNum(target)} kcal</Text>
        ) : null}
      </HCard>
    );
  }

  const pct = target && target > 0 ? Math.round((consumed / target) * 100) : null;
  const over = target != null && consumed > target;
  return (
    <HCard onPress={onPress} accessibilityLabel={`Năng lượng đã ghi ${consumed} kcal`} style={{ paddingVertical: 18 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: HC.ink }}>Năng lượng đã ghi</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
        <Text style={{ flex: 1 }}>
          <Text style={{ fontSize: 34, fontWeight: '800', color: HC.ink }}>{fmtNum(consumed)}</Text>
          <Text style={{ fontSize: 17, color: HC.ink }}>{target != null ? ` / ${fmtNum(target)} kcal` : ' kcal'}</Text>
        </Text>
        {target != null ? (
          <View style={{ alignItems: 'flex-end', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: HC.sub }}>{over ? 'Vượt mục tiêu' : 'Còn lại'}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: HC.ink }}>
              {fmtNum(over ? consumed - target : day?.energy.remainingKcal ?? target - consumed)} kcal
            </Text>
          </View>
        ) : null}
      </View>
      {pct != null ? (
        <>
          <ProgressBar value={pct} height={12} style={{ marginTop: 12 }} />
          <Text style={{ fontSize: 13, color: HC.sub, marginTop: 6 }}>{pct}%</Text>
        </>
      ) : (
        <Text style={{ fontSize: 13, color: HC.sub, marginTop: 6 }}>Chưa đặt mục tiêu năng lượng</Text>
      )}
    </HCard>
  );
}

function MacroRow({ day, hasMeals, onPress }: { day?: HealthDayResponse; hasMeals: boolean; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
      {MACROS.map((m) => {
        const v = hasMeals ? day?.macros[m.key as MacroKey].consumedG ?? null : null;
        return (
          <HCard
            key={m.key}
            onPress={onPress}
            accessibilityLabel={`${m.label} ${v == null ? 'chưa có' : `${Math.round(v)} gam`}`}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, minHeight: 92 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MacroIcon kind={m.key} size={18} />
              <Text numberOfLines={1} style={{ fontSize: 13, color: HC.ink, flexShrink: 1 }}>{m.label}</Text>
            </View>
            <Text style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: HC.ink }}>{v == null ? '—' : fmtNum(v)}</Text>
              <Text style={{ fontSize: 13, color: HC.sub }}> g</Text>
            </Text>
          </HCard>
        );
      })}
    </View>
  );
}

function JournalCard({
  day,
  mealCount,
  onOpenJournal,
  onOpenMeal,
  onMealMenu,
}: {
  day: HealthDayResponse;
  mealCount: number;
  onOpenJournal: () => void;
  onOpenMeal: (m: DayMeal) => void;
  onMealMenu: (m: DayMeal) => void;
}) {
  const meals = MEAL_SLOTS.flatMap((slot) => day.mealGroups.find((g) => g.mealSlot === slot)?.meals ?? []);
  return (
    <HCard style={{ marginTop: 12 }}>
      <Pressable
        onPress={onOpenJournal}
        accessibilityRole="button"
        accessibilityLabel="Xem nhật ký"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}
      >
        <JournalIcon />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>Nhật ký bữa ăn</Text>
          <Text style={{ fontSize: 13, color: HC.sub, marginTop: 2 }}>{mealCount} bữa đã ghi</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: HC.yellowDeep }}>Xem nhật ký</Text>
        <ChevronRight size={18} color={HC.ink} />
      </Pressable>
      <View style={{ gap: 10, marginTop: 6 }}>
        {meals.map((meal) => {
          const thumb = meal.items.find((i) => i.thumbnailUrl)?.thumbnailUrl ?? null;
          return (
            <Pressable
              key={meal.id}
              onPress={() => onOpenMeal(meal)}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_LABEL[meal.mealSlot]} ${meal.totals.kcal} kcal`}
              className="active:bg-[#FFFCF4]"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: HC.line,
                backgroundColor: HC.card,
              }}
            >
              <Thumb uri={thumb} width={72} height={56} radius={12} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: HC.ink }}>
                  {SLOT_LABEL[meal.mealSlot] ?? meal.mealSlot} · {fmtNum(meal.totals.kcal)} kcal
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: HC.sub, marginTop: 3 }}>
                  {meal.items.map((i) => i.displayName).join(', ')}
                </Text>
              </View>
              <Pressable
                onPress={() => onMealMenu(meal)}
                hitSlop={8}
                accessibilityLabel="Tuỳ chọn bữa ăn"
                style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <MoreVertical size={18} color={HC.ink} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </HCard>
  );
}

// ─── States (14, 15) ─────────────────────────────────────────────────────────

function HealthLoading() {
  return (
    <View accessibilityLabel="Đang tải dữ liệu sức khỏe">
      <HCard style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bone w={44} h={44} r={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone w="55%" h={14} />
            <Bone w="35%" h={12} />
          </View>
        </View>
        <Bone w="100%" h={14} r={7} />
      </HCard>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <HCard key={i} style={{ flex: 1, alignItems: 'center', gap: 10, minHeight: 92 }}>
            <Bone w={32} h={32} r={16} />
            <Bone w="70%" h={10} />
          </HCard>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: HC.ink }}>Nhật ký ăn uống</Text>
        <Text style={{ fontSize: 13, color: HC.sub }}>Xem tất cả ›</Text>
      </View>
      {[0, 1].map((i) => (
        <HCard key={i} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bone w={56} h={48} r={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone w="55%" h={12} />
            <Bone w="35%" h={10} />
          </View>
          <Bone w={12} h={12} r={6} />
        </HCard>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
        <ActivityIndicator size="small" color={HC.sub} />
        <Text style={{ fontSize: 14, color: HC.sub }}>Đang tải nhật ký…</Text>
      </View>
    </View>
  );
}

function HealthError({ onRetry }: { onRetry: () => void }) {
  return (
    <HCard style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, marginTop: 24 }}>
      <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: HC.yellowSoft, alignItems: 'center', justifyContent: 'center' }}>
        <CloudOff size={48} color={HC.ink} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: HC.ink, marginTop: 18 }}>Chưa tải được nhật ký</Text>
      <Text style={{ fontSize: 14, color: HC.sub, marginTop: 6, textAlign: 'center' }}>Kiểm tra kết nối và thử lại nhé</Text>
      <PrimaryButton
        label="Thử lại"
        icon={<RefreshCw size={20} color={HC.ink} />}
        onPress={onRetry}
        style={{ alignSelf: 'stretch', marginTop: 22 }}
      />
    </HCard>
  );
}
