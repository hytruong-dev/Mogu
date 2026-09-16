/**
 * WeeklyPlanScreen — Thực đơn tuần (BA-005)
 * Dữ liệu từ API: getCurrentWeeklyPlan, startPlan, regeneratePlan, swapSlot
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react-native';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Text as UiText } from '../components/ui/text';
import { AppImage } from '../components/ui/app-image';
import { computeWeeklyForecast } from '../lib/weekly-forecast';
import {
  getCurrentWeeklyPlan,
  getWeeklyPlanConfig,
  startWeeklyPlan,
  regenerateWeeklyPlan,
  swapSlot,
  generateWeeklyPlan,
  completeSlot,
  skipSlot,
  lockSlot,
  pollWeeklyPlan,
  type SwapSlotResult,
} from '../services/api/weekly-plan';
import type { WeeklyPlan, WeeklyPlanConfig, WeeklyPlanDay, WeeklyPlanStatus } from '../services/api/types';
import { formatApiErrorWithCode, formatWeeklyPlanGenerationError } from '../lib/api-error';
import { normalizeImageUrl } from '../services/api/randomization';
import {
  formatPlanWeekdayFull,
  formatPlanWeekdayShort,
  getTodayISO,
  isTodayISO,
} from '../lib/dates';
import { WeeklyPlanSkeleton } from '../components/skeletons/ScreenSkeletons';

const CREAM = '#F7F2E8';
const WHITE = '#FFFFFF';
const INK = '#111111';
const YELLOW = '#FFC51A';
const MUTED = '#999';
const BORDER = '#EDE5D2';

const shadow = {
  shadowColor: '#B19B66',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

type Meal = {
  slotId: string;
  dishId: string;
  slot: string;
  slotIcon: string;
  dishName: string;
  price: number;
  kcal: number;
  imageUrl?: string | null;
  version: number;
  status: string;
  isLocked: boolean;
};

type DayPlan = {
  weekdayShort: string;
  weekdayFull: string;
  date: number;
  month: number;
  isoDate: string;
  meals: Meal[];
  estimatedCost: number;
  estimatedKcal: number;
};

const SLOT_LABELS: Record<string, string> = {
  MORNING: 'Bữa sáng', LUNCH: 'Bữa trưa', DINNER: 'Bữa tối', SNACK: 'Bữa phụ',
};
const SLOT_ICONS: Record<string, string> = {
  MORNING: '☀️', LUNCH: '🌤️', DINNER: '🌙', SNACK: '🍎',
};

const parseDayPlan = (day: WeeklyPlanDay): DayPlan => {
  const meals: Meal[] = day.slots.map(sl => ({
    slotId: sl.id,
    dishId: sl.dish.id,
    slot: SLOT_LABELS[sl.mealSlot] ?? sl.mealSlot,
    slotIcon: SLOT_ICONS[sl.mealSlot] ?? '🍽️',
    dishName: sl.dish.name,
    imageUrl: normalizeImageUrl(sl.dish.imageUrl),
    price: Math.round(sl.dish.priceVnd / 1000),
    kcal: sl.dish.kcal,
    version: sl.version,
    status: sl.status,
    isLocked: sl.isLocked,
  }));
  const [_, monthStr, dayStr] = day.date.split('-');
  return {
    weekdayShort: formatPlanWeekdayShort(day.date),
    weekdayFull: formatPlanWeekdayFull(day.date),
    date: Number(dayStr),
    month: Number(monthStr),
    isoDate: day.date,
    meals,
    estimatedCost: meals.reduce((s, m) => s + m.price, 0),
    estimatedKcal: meals.reduce((s, m) => s + (m.kcal ?? 0), 0),
  };
}

// ── Week skeleton — chỉ tạo khung ngày, KHÔNG có meals (dùng khi chưa có plan) ──
const buildWeekSkeleton = (): DayPlan[] => {
  const todayIso = getTodayISO();
  const [y, m, d] = todayIso.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const dow = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return {
      weekdayShort: formatPlanWeekdayShort(iso),
      weekdayFull: formatPlanWeekdayFull(iso),
      date: day.getDate(),
      month: day.getMonth() + 1,
      isoDate: iso,
      meals: [],
      estimatedCost: 0,
      estimatedKcal: 0,
    };
  });
};

type Props = {
  onBack: () => void;
  onEditPlan: () => void;
  onMore?: () => void;
  onOpenDish?: (dishId: string, title?: string, mealLabel?: string) => void;
  onOpenIngredients?: (planId: string, date: string, title?: string) => void;
};

export function WeeklyPlanScreen({ onBack, onEditPlan, onMore, onOpenDish, onOpenIngredients }: Props) {
  const todayIso = getTodayISO();

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [config, setConfig] = useState<WeeklyPlanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pollingPlanId, setPollingPlanId] = useState<string | null>(null);
  const [regenConfirmVisible, setRegenConfirmVisible] = useState(false);
  const pollRef = useRef<string | null>(null);

  // ── Fetch plan + config ─────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [p, cfg] = await Promise.all([
        getCurrentWeeklyPlan(),
        getWeeklyPlanConfig().catch(() => null),
      ]);
      setPlan(p);
      if (cfg) setConfig(cfg);
      if (p && Array.isArray(p.days) && p.days.length > 0) {
        const idx = p.days.findIndex((d) => d.date === todayIso);
        if (idx >= 0) setSelectedIdx(idx);
      }
    } catch (err: any) {
      console.log('[WeeklyPlan] API error:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  }, [todayIso]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPlan(true);
    setRefreshing(false);
  };

  // ── Derived display days — CHỈ dùng dữ liệu thật từ API, không mock ────────
  const hasRealDays = plan && Array.isArray(plan.days) && plan.days.length > 0;
  const displayDays: DayPlan[] = hasRealDays
    ? plan!.days.map(parseDayPlan)
    : buildWeekSkeleton(); // skeleton chỉ chứa ngày, không có meals

  const safeIdx = Math.min(selectedIdx, Math.max(displayDays.length - 1, 0));
  const selectedDay = displayDays[safeIdx] ?? displayDays[0];
  const isToday = selectedDay ? isTodayISO(selectedDay.isoDate) : false;

  const planStatus: WeeklyPlanStatus | null = plan?.status ?? null;
  // Config = ngân sách hiện tại; plan.budgetLimitVnd = snapshot lúc tạo plan.
  // Khi FAILED / chưa có slot → ưu tiên config (user vừa chỉnh 1.3M).
  const budget =
    planStatus === 'FAILED' || !hasRealDays
      ? (config?.budgetVnd ?? plan?.budgetLimitVnd ?? 500000)
      : (plan?.budgetLimitVnd ?? config?.budgetVnd ?? 500000);
  const calTotal =
    plan?.targetKcal ??
    (config?.kcalPerDay ? config.kcalPerDay * (config.durationDays ?? 7) : 14000);
  const {
    actualCompleted: spent,
    actualKcalCompleted: calConsumed,
    forecastSpent: endForecast,
    forecastKcal: calProjected,
  } = computeWeeklyForecast(plan ?? {});
  const remainingProjected = Math.max(0, budget - endForecast);
  const budgetPct = budget > 0 ? Math.min((endForecast / budget) * 100, 100) : 0;
  const calPct = calTotal > 0 ? Math.min((calProjected / calTotal) * 100, 100) : 0;

  const waitForPlan = async (planId: string) => {
    pollRef.current = planId;
    setPollingPlanId(planId);
    try {
      const finalPlan = await pollWeeklyPlan(planId, {
        onTick: (p) => {
          if (pollRef.current === planId) setPlan(p);
        },
      });
      setPlan(finalPlan);
      if (finalPlan.status === 'FAILED') {
        Alert.alert(
          'Tạo thất bại',
          formatWeeklyPlanGenerationError(finalPlan.generationErrorCode),
        );
      }
    } catch (err) {
      Alert.alert('Lỗi', formatApiErrorWithCode(err));
    } finally {
      if (pollRef.current === planId) {
        pollRef.current = null;
        setPollingPlanId(null);
      }
    }
  };

  // ── Plan info text ───────────────────────────────────────────────────────────
  const durationDays = plan
    ? Math.round((new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / 86400000)
    : 7;
  const totalSlots = displayDays.reduce((s, d) => s + d.meals.length, 0);
  const mealsPerDay = hasRealDays ? Math.round(totalSlots / durationDays) : 3;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleStartPlan = async () => {
    if (!plan) return;
    setActionLoading('start');
    try {
      // Refresh version trước khi start để tránh conflict do dữ liệu cũ trên client
      const latest = (await getCurrentWeeklyPlan().catch(() => null)) ?? plan;
      await startWeeklyPlan(latest.id, latest.version);
      await fetchPlan(true);
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  const requestRegenerate = () => {
    if (plan) {
      setRegenConfirmVisible(true);
      return;
    }
    void runRegenerate();
  };

  const runRegenerate = async () => {
    setRegenConfirmVisible(false);
    setActionLoading('regen');
    try {
      const { planId } = plan
        ? await regenerateWeeklyPlan(plan.id)
        : await generateWeeklyPlan(getTodayISO());
      await waitForPlan(planId);
      const cfg = await getWeeklyPlanConfig().catch(() => null);
      if (cfg) setConfig(cfg);
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSwap = async (meal: Meal) => {
    if (!plan || !hasRealDays) return;
    if (meal.isLocked) {
      Alert.alert('Món đã khóa', 'Mở khóa món trước khi đổi.');
      return;
    }
    setActionLoading(meal.slotId);
    try {
      // Gọi API swap — response trả về slot mới với đầy đủ thông tin
      const result: SwapSlotResult = await swapSlot(plan.id, meal.slotId, { version: meal.version });

      // Chỉ update local state thay vì gọi lại toàn bộ getCurrentWeeklyPlan
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(result.summary
            ? {
              projectedCostVnd: result.summary.projectedCostVnd,
              projectedKcal: result.summary.projectedKcal,
              budgetLimitVnd: result.summary.budgetLimitVnd,
            }
            : {}),
          days: prev.days.map((day) => ({
            ...day,
            slots: day.slots.map((sl) => {
              if (sl.id !== meal.slotId) return sl;
              return {
                ...sl,
                id: result.id ?? sl.id,
                version: result.version ?? sl.version + 1,
                swapCount: result.swapCount ?? (sl.swapCount ?? 0) + 1,
                dish: {
                  ...sl.dish,
                  id: result.dishId ?? sl.dish.id,
                  name: result.dishNameSnapshot ?? sl.dish.name,
                  imageUrl: normalizeImageUrl(result.imageUrlSnapshot ?? sl.dish.imageUrl),
                  priceVnd: result.priceSnapshotVnd ?? sl.dish.priceVnd,
                  kcal: result.kcalSnapshot ?? sl.dish.kcal,
                  proteinG: result.proteinGSnapshot ?? sl.dish.proteinG,
                  carbsG: result.carbsGSnapshot ?? sl.dish.carbsG,
                  fatG: result.fatGSnapshot ?? sl.dish.fatG,
                },
              };
            }),
          })),
        };
      });

      if (!result.summary) {
        await fetchPlan(true);
      }

      if (result.budgetWarning) {
        Alert.alert('Cảnh báo ngân sách', 'Món mới có thể làm tăng dự toán chi tiêu.');
      }
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (meal: Meal) => {
    if (!plan) return;
    setActionLoading(`complete-${meal.slotId}`);
    try {
      await completeSlot(plan.id, meal.slotId, { version: meal.version });
      await fetchPlan(true);
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async (meal: Meal) => {
    if (!plan) return;
    setActionLoading(`skip-${meal.slotId}`);
    try {
      await skipSlot(plan.id, meal.slotId, meal.version);
      await fetchPlan(true);
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockToggle = async (meal: Meal) => {
    if (!plan) return;
    setActionLoading(`lock-${meal.slotId}`);
    try {
      await lockSlot(plan.id, meal.slotId, !meal.isLocked, meal.version);
      await fetchPlan(true);
    } catch (e) {
      Alert.alert('Lỗi', formatApiErrorWithCode(e));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
            <ArrowLeft size={22} color={INK} strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle}>Thực đơn tuần</Text>
          <View style={s.iconBtn} />
        </View>
        <WeeklyPlanSkeleton />
      </SafeAreaView>
    );
  }

  // ── Status badge ─────────────────────────────────────────────────────────────
  const STATUS_LABEL: Record<string, string> = {
    GENERATING: '⏳ Đang tạo...', READY: '✅ Sẵn sàng', ACTIVE: '🔥 Đang thực hiện',
    COMPLETED: '🎉 Hoàn thành', FAILED: '❌ Tạo thất bại', ARCHIVED: '📦 Đã lưu trữ',
  };

  const dayHeaderLeft = isToday ? 'Hôm nay' : selectedDay.weekdayFull;
  const dayHeaderRight = `${selectedDay.weekdayFull}, ${selectedDay.date}/${selectedDay.month}`;

  // Footer button logic
  const showStartBtn = planStatus === 'READY';
  const showActiveBtn = planStatus === 'ACTIVE';
  const regenLabel = plan ? 'Tạo lại thực đơn' : 'Tạo thực đơn mới';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Thực đơn tuần</Text>
        <Pressable onPress={onMore} style={s.iconBtn} hitSlop={8}>
          <Text style={{ fontSize: 22, color: INK }}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={YELLOW} colors={[YELLOW]} />
        }
      >
        {/* ── Summary card ─────────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryTop}>
            <Image
              source={require('../assets/images/home/mogu-budget.png')}
              resizeMode="contain"
              style={s.summaryMascot}
            />
            <View style={s.summaryInfo}>
              <View style={s.summaryTitleRow}>
                <Sparkles size={13} color="#F0A500" fill="#F0A500" />
                <Text style={s.summaryTitle} numberOfLines={1}>
                  {planStatus ? (STATUS_LABEL[planStatus] ?? 'Kế hoạch của bạn') : 'Chưa có kế hoạch'}
                </Text>
              </View>
              <Text style={s.summarySubtitle} numberOfLines={1}>
                {plan
                  ? `${durationDays} ngày · ${totalSlots} bữa · ${mealsPerDay} bữa/ngày`
                  : 'Nhấn "Tạo thực đơn" để bắt đầu'}
              </Text>

              <View style={s.statRow}>
                <Text style={s.statIcon}>❤️</Text>
                <Text style={s.statValue} numberOfLines={1}>
                  {Math.round(spent / 1000)}K đã chi · ~{Math.round(endForecast / 1000)}K cuối kỳ
                </Text>
                <Badge
                  className={
                    remainingProjected >= 0
                      ? 'border-transparent bg-[#DCFCE7]'
                      : 'border-transparent bg-[#FEE2E2]'
                  }
                >
                  <UiText
                    className={
                      remainingProjected >= 0
                        ? 'text-[10px] font-bold text-[#15803D]'
                        : 'text-[10px] font-bold text-[#B91C1C]'
                    }
                  >
                    Còn {Math.round(remainingProjected / 1000)}K
                  </UiText>
                </Badge>
              </View>
              <Progress
                value={budgetPct}
                className="h-1 bg-[#F0E9D0]"
                indicatorClassName="bg-primary"
              />

              <View style={[s.statRow, { marginTop: 1 }]}>
                <Text style={s.statIcon}>🔥</Text>
                <Text style={s.statValue} numberOfLines={1}>
                  {calConsumed.toLocaleString('vi-VN')} đã nạp · ~{calProjected.toLocaleString('vi-VN')} dự toán
                </Text>
                <Badge className="border-transparent bg-[#FEE2E2]">
                  <UiText className="text-[10px] font-bold text-[#B91C1C]">
                    Đạt {Math.round(calPct)}%
                  </UiText>
                </Badge>
              </View>
              <Progress
                value={calPct}
                className="h-1 bg-[#F0E9D0]"
                indicatorClassName="bg-[#FF6030]"
              />
            </View>
          </View>

          <TouchableOpacity onPress={onEditPlan} activeOpacity={0.8} style={s.editPlanBtn}>
            <Text style={{ fontSize: 12 }}>✏️</Text>
            <Text style={s.editPlanText}>Chỉnh kế hoạch</Text>
          </TouchableOpacity>
        </View>

        {/* ── GENERATING state notice ───────────────────────────────────────── */}
        {(planStatus === 'GENERATING' || pollingPlanId) && (
          <View style={s.generatingBanner}>
            <ActivityIndicator size="small" color={YELLOW} />
            <Text style={s.generatingText}>Mogu đang chọn món cho bạn...</Text>
          </View>
        )}

        {/* ── Calendar row — chỉ hiện khi có plan ─────────────────────────── */}
        {hasRealDays && (
          <View style={s.calendarRow}>
            {displayDays.map((day, idx) => {
              const isSelected = idx === safeIdx;
              const isTodayDay = isTodayISO(day.isoDate);
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedIdx(idx)}
                  style={[s.calDay, isSelected && s.calDaySelected]}
                >
                  <Text className={
                    isTodayDay && !isSelected
                      ? 'text-primary'
                      : isSelected
                        ? 'text-black'
                        : ''
                  } style={[s.calDayLabel, isSelected && s.calDayLabelSelected]}>{day.weekdayShort}</Text>
                  <Text className={
                    isTodayDay && !isSelected
                      ? 'text-primary'
                      : isSelected
                        ? 'text-black'
                        : ''
                  } style={[s.calDayDate, isSelected && s.calDayDateSelected]}>{day.date}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Day header — chỉ hiện khi có plan ───────────────────────────── */}
        {hasRealDays && (
          <View style={s.dayHeader}>
            <Text style={s.dayHeaderTitle}>{dayHeaderLeft} · {dayHeaderRight}</Text>
            <Text style={s.dayHeaderSub}>
              Dự kiến {selectedDay.estimatedCost}K · {selectedDay.estimatedKcal.toLocaleString('vi-VN')} kcal
            </Text>
          </View>
        )}

        {/* ── Meal cards hoặc Empty state ───────────────────────────────────── */}
        <View style={s.mealsSection}>
          {hasRealDays ? (
            <>
              {selectedDay.meals.map((meal) => (
                <MealCard
                  key={meal.slotId}
                  meal={meal}
                  isReal={true}
                  busy={!!actionLoading && actionLoading.includes(meal.slotId)}
                  swapping={actionLoading === meal.slotId}
                  onSwap={() => handleSwap(meal)}
                  onComplete={() => handleComplete(meal)}
                  onSkip={() => handleSkip(meal)}
                  onToggleLock={() => handleLockToggle(meal)}
                  onOpenDish={
                    meal.dishId
                      ? () => onOpenDish?.(meal.dishId, meal.dishName, meal.slot)
                      : undefined
                  }
                />
              ))}

              {/* Nguyên liệu — chỉ hiện khi có plan */}
              <Pressable
                style={s.ingredientsRow}
                onPress={() => {
                  if (!plan?.id || !selectedDay.isoDate) return;
                  onOpenIngredients?.(
                    plan.id,
                    selectedDay.isoDate,
                    `Nguyên liệu · ${selectedDay.weekdayFull}`,
                  );
                }}
              >
                <View style={s.ingredientIcon}>
                  <Text style={{ fontSize: 22 }}>🥬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ingredientTitle}>Nguyên liệu hôm nay</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' }}>
                    <Text style={s.ingredientCount}>
                      Xem danh sách nguyên liệu
                    </Text>
                    <Text style={{ fontSize: 12, color: MUTED }}>·</Text>
                    <Text style={s.ingredientLink}>Xem danh sách</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={MUTED} />
              </Pressable>
            </>
          ) : (
            /* Empty state — chưa có plan */
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>📋</Text>
              <Text style={s.emptyTitle}>Chưa có thực đơn</Text>
              <Text style={s.emptySubtitle}>
                Nhấn "Tạo thực đơn" bên dưới để Mogu{'\n'}gợi ý thực đơn tuần phù hợp với bạn.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        {showStartBtn && (
          <TouchableOpacity
            activeOpacity={0.87}
            style={s.startBtn}
            onPress={handleStartPlan}
            disabled={actionLoading === 'start'}
          >
            {actionLoading === 'start'
              ? <ActivityIndicator size="small" color={INK} />
              : <Text style={s.startBtnText}>Bắt đầu kế hoạch</Text>
            }
          </TouchableOpacity>
        )}
        {showActiveBtn && (
          <View style={[s.startBtn, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[s.startBtnText, { color: '#15803D' }]}>🔥 Đang thực hiện</Text>
          </View>
        )}
        {!showStartBtn && !showActiveBtn && !plan && (
          <TouchableOpacity
            activeOpacity={0.87}
            style={s.startBtn}
            onPress={requestRegenerate}
            disabled={actionLoading === 'regen'}
          >
            {actionLoading === 'regen'
              ? <ActivityIndicator size="small" color={INK} />
              : <Text style={s.startBtnText}>Tạo thực đơn</Text>
            }
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.recreateBtn}
          onPress={requestRegenerate}
          disabled={!!actionLoading}
          className='group'
        >
          {actionLoading === 'regen'
            ? <ActivityIndicator size="small" color={MUTED} />
            : <Text style={s.recreateBtnText} className='group-hover:text-black duration-200'>{regenLabel}</Text>
          }
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={regenConfirmVisible}
        tone="warning"
        title="Tạo lại thực đơn?"
        description="Kế hoạch hiện tại sẽ bị lưu trữ và tạo mới với cấu hình mới nhất. Tiếp tục?"
        confirmLabel="Tạo lại"
        cancelLabel="Huỷ"
        onConfirm={() => {
          setRegenConfirmVisible(false);
          void runRegenerate();
        }}
        onCancel={() => setRegenConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── MealCard ──────────────────────────────────────────────────────────────────
function MealCard({
  meal, isReal, busy, swapping, onSwap, onComplete, onSkip, onToggleLock, onOpenDish,
}: {
  meal: Meal;
  isReal: boolean;
  busy: boolean;
  swapping: boolean;
  onSwap: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onToggleLock: () => void;
  onOpenDish?: () => void;
}) {
  const isDone = meal.status === 'COMPLETED';
  const isSkipped = meal.status === 'SKIPPED';
  const slotColor: Record<string, string> = {
    'Bữa sáng': '#FFFBEB', 'Bữa trưa': '#FFF7F0', 'Bữa tối': '#EEF4FF', 'Bữa phụ': '#F0FFF4',
  };
  const bg = slotColor[meal.slot] ?? '#F5F0E8';

  return (
    <View style={s.mealCard}>
      {/* Ảnh + info — tap mở chi tiết món */}
      <Pressable
        style={s.mealPressable}
        onPress={onOpenDish}
        disabled={!onOpenDish}
      >
        <View style={[s.mealImage, { backgroundColor: bg }]}>
          {meal.imageUrl ? (
            <AppImage
              uri={meal.imageUrl}
              style={s.mealImageSource}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              showLoader
              fallbackIcon={<Text style={{ fontSize: 32 }}>{meal.slotIcon}</Text>}
            />
          ) : (
            <Text style={{ fontSize: 32 }}>{meal.slotIcon}</Text>
          )}
        </View>

        <View style={s.mealInfo}>
          <View style={s.mealSlotRow}>
            <Text style={{ fontSize: 12 }}>{meal.slotIcon}</Text>
            <Text style={s.mealSlotText}>{meal.slot}</Text>
            <TouchableOpacity
              onPress={onToggleLock}
              disabled={!isReal || busy || isDone || isSkipped}
              hitSlop={8}
              style={s.lockBtn}
            >
              <Text style={{ fontSize: 12 }}>{meal.isLocked ? '🔒' : '🔓'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.mealName} numberOfLines={1}>{meal.dishName}</Text>
          <Text style={s.mealMeta}>
            {meal.price > 0 ? `${meal.price}K` : '—'} · {meal.kcal > 0 ? `${meal.kcal.toLocaleString('vi-VN')} kcal` : '—'}
          </Text>
          {isDone && <Text style={s.slotStatusDone}>Đã ăn</Text>}
          {isSkipped && <Text style={s.slotStatusSkip}>Đã bỏ</Text>}
          {!isDone && !isSkipped && (
            <TouchableOpacity onPress={onSkip} disabled={busy} hitSlop={6} style={s.skipLink}>
              <Text style={s.skipLinkText}>Bỏ qua</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>

      {/* 2 action buttons */}
      <View style={s.mealActions}>
        <TouchableOpacity
          style={[s.changeBtn, (!isReal || meal.isLocked || isDone || isSkipped) && { opacity: 0.4 }]}
          activeOpacity={0.8}
          onPress={onSwap}
          disabled={!isReal || meal.isLocked || swapping || isDone || isSkipped}
        >
          {swapping
            ? <ActivityIndicator size="small" color="#555" />
            : <RefreshCw size={15} color="#555" strokeWidth={2} />
          }
          <Text style={s.changeBtnText}>Đổi</Text>
        </TouchableOpacity>
        {!isDone && !isSkipped ? (
          <TouchableOpacity
            style={[s.completeBtn, busy && { opacity: 0.5 }]}
            onPress={onComplete}
            disabled={busy}
          >
            <Text style={s.completeBtnText}>✓</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.completeBtn, { backgroundColor: isDone ? '#DCFCE7' : '#F3F4F6', borderColor: isDone ? '#86EFAC' : BORDER }]}>
            <Text style={[s.completeBtnText, { color: isDone ? '#15803D' : MUTED }]}>
              {isDone ? '✓' : '—'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },

  header: {
    height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: CREAM,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK, letterSpacing: -0.3 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  summaryCard: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 10, borderRadius: 14, backgroundColor: WHITE,
    padding: 10, gap: 6, ...shadow,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryMascot: { width: 52, height: 60, flexShrink: 0 },
  summaryInfo: { flex: 1, minWidth: 0, gap: 2 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 0 },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: INK, letterSpacing: -0.2, flexShrink: 1 },
  summarySubtitle: { fontSize: 11.5, color: MUTED, marginBottom: 3 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 12, lineHeight: 14 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#444' },
  statValue: { flex: 1, fontSize: 11.5, color: '#555', fontWeight: '500', minWidth: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: '#F0E9D0', overflow: 'hidden', marginTop: 2 },
  progressFill: { height: '100%', borderRadius: 2 },

  editPlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 30, borderRadius: 9, borderWidth: 1.2, borderColor: '#E5E0D4',
    backgroundColor: WHITE,
  },
  editPlanText: { fontSize: 12.5, fontWeight: '600', color: INK },

  generatingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, padding: 10,
    backgroundColor: '#FFFBE6', borderRadius: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  generatingText: { flex: 1, fontSize: 13, color: '#92400E' },

  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  calDay: { flex: 1, borderRadius: 9, alignItems: 'center', paddingVertical: 4, marginHorizontal: 2 },
  calDaySelected: { backgroundColor: YELLOW },
  calDayLabel: { fontSize: 10, fontWeight: '600', color: MUTED },
  calDayLabelSelected: { color: INK },
  calDayDate: { fontSize: 14, fontWeight: '800', color: '#333', marginTop: 0 },
  calDayDateSelected: { color: INK },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: YELLOW, marginTop: 1 },

  dayHeader: { paddingHorizontal: 16, paddingBottom: 6, paddingTop: 4 },
  dayHeaderTitle: { fontSize: 14, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  dayHeaderSub: { fontSize: 11.5, color: MUTED, marginTop: 2 },

  mealsSection: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 6,
    justifyContent: 'flex-start',
  },

  mealCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    ...shadow,
    borderWidth: 1,
    borderColor: BORDER,
  },
  mealPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 10,
  },
  mealImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  mealImageSource: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  mealInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
  mealSlotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  mealSlotText: { fontSize: 12, fontWeight: '700', color: '#C08000' },
  lockBtn: {
    marginLeft: 2,
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealName: { fontSize: 15.5, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  mealMeta: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  skipLink: { marginTop: 2, alignSelf: 'flex-start' },
  skipLinkText: { fontSize: 11, fontWeight: '600', color: MUTED, textDecorationLine: 'underline' },

  mealActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
  },
  changeBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#F8F5EC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  changeBtnText: { fontSize: 9, fontWeight: '700', color: '#666' },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: WHITE,
    borderWidth: 1.2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: { fontSize: 14, fontWeight: '700', color: INK },
  slotStatusDone: { fontSize: 12, color: '#15803D', fontWeight: '700', marginTop: 2 },
  slotStatusSkip: { fontSize: 12, color: MUTED, fontWeight: '600', marginTop: 2 },

  ingredientsRow: {
    backgroundColor: WHITE, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 10, ...shadow,
    borderWidth: 1, borderColor: BORDER,
    marginTop: 2,
  },
  ingredientIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center' },
  ingredientTitle: { fontSize: 14, fontWeight: '600', color: INK },
  ingredientCount: { fontSize: 12, color: MUTED },
  ingredientLink: { fontSize: 12, color: '#F0A500', fontWeight: '600' },

  emptyState: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 28, gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, textAlign: 'center' },
  emptySubtitle: { fontSize: 12.5, color: MUTED, textAlign: 'center', lineHeight: 18 },

  footer: {
    backgroundColor: CREAM,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: BORDER, gap: 2,
  },
  startBtn: { height: 48, borderRadius: 14, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { fontSize: 15, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  recreateBtn: { alignItems: 'center', paddingVertical: 2 },
  recreateBtnText: { fontSize: 12.5, color: MUTED },
});
