/**
 * WeeklyPlanScreen — Thực đơn tuần (BA-005)
 * Dữ liệu từ API: getCurrentWeeklyPlan, startPlan, regeneratePlan, swapSlot
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { ArrowLeft, ChevronRight, RefreshCw, ShoppingCart, Sparkles } from 'lucide-react-native';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Text as UiText } from '../components/ui/text';
import { AppImage } from '../components/ui/app-image';
import { computeWeeklyForecast } from '../lib/weekly-forecast';
import {
  getCurrentWeeklyPlan,
  getWeeklyPlanById,
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
import { cancelMealReminders, syncMealReminders } from '../lib/meal-reminders';

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
  initialPlanId?: string;
  onBack: () => void;
  onEditPlan: () => void;
  onMore?: () => void;
  onOpenDish?: (dishId: string, title?: string, mealLabel?: string) => void;
  onOpenIngredients?: (planId: string, date: string, title?: string) => void;
  onOpenWeeklyGrocery?: (planId: string) => void;
};

export function WeeklyPlanScreen({ initialPlanId, onBack, onEditPlan, onMore, onOpenDish, onOpenIngredients, onOpenWeeklyGrocery }: Props) {
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
  const hasRedirectedRef = useRef(false);

  // ── Fetch plan + config ─────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let p: WeeklyPlan | null = null;
      if (initialPlanId) {
        p = await getWeeklyPlanById(initialPlanId).catch(() => null);
      }
      if (!p) {
        p = await getCurrentWeeklyPlan().catch(() => null);
      }
      const cfg = await getWeeklyPlanConfig().catch(() => null);
      setPlan(p);
      if (cfg) setConfig(cfg);
      if (p && Array.isArray(p.days) && p.days.length > 0) {
        const idx = p.days.findIndex((d) => d.date === todayIso);
        setSelectedIdx(idx >= 0 ? idx : 0);
      }
    } catch (err: any) {
      console.log('[WeeklyPlan] API error:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  }, [initialPlanId, todayIso]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // Luôn làm mới dữ liệu khi màn hình được focus trở lại (ví dụ sau khi tạo plan từ EditPlanScreen)
  useFocusEffect(
    useCallback(() => {
      void fetchPlan(true);
    }, [fetchPlan])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPlan(true);
    setRefreshing(false);
  };

  // ── Kiểm tra kế hoạch đã hết hạn (quá tuần) ──────────────────────────────
  const isPlanExpired = !!plan && (
    (plan.status === 'COMPLETED' || plan.status === 'ARCHIVED') ||
    (plan.endDate && todayIso >= plan.endDate.split('T')[0]) ||
    (Array.isArray(plan.days) && plan.days.length > 0 && plan.days.every((d) => d.date < todayIso))
  );

  // Đồng bộ nhắc giờ ăn khi có plan ACTIVE
  useEffect(() => {
    if (!plan) {
      void cancelMealReminders();
      return;
    }
    if (plan.status === 'ACTIVE' && !isPlanExpired) {
      void syncMealReminders(plan, config);
    } else {
      void cancelMealReminders();
    }
  }, [plan, config, isPlanExpired]);

  // Tự động chuyển về màn cấu hình kế hoạch tuần này nếu chưa có plan hoặc plan tuần cũ đã hết hạn
  useEffect(() => {
    if (!loading && !hasRedirectedRef.current) {
      if (!plan || isPlanExpired) {
        hasRedirectedRef.current = true;
        onEditPlan();
      }
    }
  }, [loading, plan, isPlanExpired, onEditPlan]);

  // ── Derived display days — CHỈ dùng dữ liệu thật từ API, không mock ────────
  const hasRealDays = !isPlanExpired && plan && Array.isArray(plan.days) && plan.days.length > 0;
  const displayDays: DayPlan[] = hasRealDays
    ? plan!.days.map(parseDayPlan)
    : buildWeekSkeleton(); // skeleton chỉ chứa ngày, không có meals

  const safeIdx = Math.min(selectedIdx, Math.max(displayDays.length - 1, 0));
  const selectedDay = displayDays[safeIdx] ?? displayDays[0];
  const isToday = selectedDay ? isTodayISO(selectedDay.isoDate) : false;

  const planStatus: WeeklyPlanStatus | null = isPlanExpired ? null : (plan?.status ?? null);
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
    if (plan && !isPlanExpired) {
      setRegenConfirmVisible(true);
      return;
    }
    onEditPlan();
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
    GENERATING: 'Đang tạo', READY: 'Sẵn sàng', ACTIVE: 'Đang chạy',
    COMPLETED: 'Hoàn thành', FAILED: 'Tạo thất bại', ARCHIVED: 'Đã lưu trữ',
  };

  const planDateLabel = (() => {
    if (!plan?.startDate || !plan?.endDate) return '';
    const s = plan.startDate.split('T')[0].split('-');
    const e = plan.endDate.split('T')[0].split('-');
    if (s[1] === e[1]) return `${Number(s[2])} – ${Number(e[2])} tháng ${Number(s[1])}`;
    return `${Number(s[2])}/${Number(s[1])} – ${Number(e[2])}/${Number(e[1])}`;
  })();

  const dayHeaderLeft = isToday ? 'Hôm nay' : selectedDay.weekdayFull;
  const dayHeaderRight = `${selectedDay.weekdayFull}, ${selectedDay.date}/${String(selectedDay.month).padStart(2, '0')}`;

  // Footer button logic
  const showStartBtn = !isPlanExpired && planStatus === 'READY';
  const showActiveBtn = !isPlanExpired && planStatus === 'ACTIVE';
  const regenLabel = (plan && !isPlanExpired) ? 'Tạo lại thực đơn' : 'Cấu hình thực đơn mới';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Thực đơn tuần</Text>
        {plan?.id && !isPlanExpired ? (
          <Pressable
            onPress={() => onOpenWeeklyGrocery?.(plan.id)}
            style={s.iconBtn}
            hitSlop={8}
            accessibilityLabel="Đi chợ tuần"
          >
            <ShoppingCart size={20} color={INK} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Pressable onPress={onMore} style={s.iconBtn} hitSlop={8}>
            <Text style={{ fontSize: 22, color: INK }}>⋯</Text>
          </Pressable>
        )}
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
          <View style={s.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <View style={s.readyBadge}>
                <Text style={s.readyBadgeText}>
                  ✔ {isPlanExpired
                    ? 'Đã kết thúc'
                    : planStatus
                      ? (STATUS_LABEL[planStatus] ?? 'Kế hoạch')
                      : 'Chưa có kế hoạch'}
                </Text>
              </View>
              <Text style={s.summaryDateLine} numberOfLines={1}>
                {hasRealDays
                  ? `${planDateLabel} • ${totalSlots} bữa`
                  : 'Nhấn chỉnh kế hoạch để bắt đầu'}
              </Text>
            </View>
            <View style={s.summaryStatsCol}>
              <View style={s.summaryStatLine}>
                <Text style={{ fontSize: 13 }}>👛</Text>
                <Text style={s.summaryStatText} numberOfLines={1}>
                  Dự kiến {Math.round(endForecast / 1000)}K / {Math.round(budget / 1000)}K
                </Text>
              </View>
              <View style={s.summaryStatLine}>
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={s.summaryStatText} numberOfLines={1}>
                  {calProjected.toLocaleString('vi-VN')} / {calTotal.toLocaleString('vi-VN')} kcal
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={onEditPlan} activeOpacity={0.8} style={s.editPlanBtn}>
            <Text style={{ fontSize: 13 }}>✏️</Text>
            <Text style={s.editPlanText}>{hasRealDays ? 'Chỉnh kế hoạch' : 'Lên kế hoạch'}</Text>
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

              <Pressable
                style={s.ingredientsRow}
                onPress={() => {
                  if (!plan?.id) return;
                  onOpenWeeklyGrocery?.(plan.id);
                }}
              >
                <View style={[s.ingredientIcon, { backgroundColor: '#FFF4C7' }]}>
                  <ShoppingCart size={20} color="#B45309" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ingredientTitle}>Đi chợ tuần</Text>
                  <Text style={[s.ingredientCount, { marginTop: 2 }]}>
                    Gộp nguyên liệu cả tuần · tick đã mua
                  </Text>
                </View>
                <ChevronRight size={18} color={MUTED} />
              </Pressable>
            </>
          ) : (
            /* Empty state — chưa có plan */
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>{isPlanExpired ? '🗓️' : '📋'}</Text>
              <Text style={s.emptyTitle}>
                {isPlanExpired ? 'Kế hoạch tuần trước đã kết thúc' : 'Chưa có thực đơn tuần này'}
              </Text>
              <Text style={s.emptySubtitle}>
                {isPlanExpired
                  ? 'Tuần mới đã bắt đầu. Hãy cấu hình kế hoạch\nđể Mogu gợi ý thực đơn cho tuần này.'
                  : 'Nhấn "Lên kế hoạch" bên dưới để Mogu\ngợi ý thực đơn tuần phù hợp với bạn.'}
              </Text>
              <TouchableOpacity
                onPress={onEditPlan}
                activeOpacity={0.85}
                style={[s.startBtn, { marginTop: 16, width: 'auto', paddingHorizontal: 32 }]}
              >
                <Text style={s.startBtnText}>Lên kế hoạch tuần này</Text>
              </TouchableOpacity>
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
        {!showStartBtn && !showActiveBtn && (
          <TouchableOpacity
            activeOpacity={0.87}
            style={s.startBtn}
            onPress={onEditPlan}
            disabled={actionLoading === 'regen'}
          >
            {actionLoading === 'regen'
              ? <ActivityIndicator size="small" color={INK} />
              : <Text style={s.startBtnText}>Lên kế hoạch tuần này</Text>
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

  return (
    <View style={s.mealCard}>
      <Pressable
        style={s.mealPressable}
        onPress={onOpenDish}
        disabled={!onOpenDish}
      >
        <View style={s.mealImage}>
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
            <Text style={s.mealSlotText}>{meal.slot}</Text>
            <TouchableOpacity
              onPress={onToggleLock}
              disabled={!isReal || busy || isDone || isSkipped}
              hitSlop={8}
              style={s.lockBtn}
            >
              <Text style={{ fontSize: 12, color: meal.isLocked ? '#D97706' : '#C4BFB5' }}>
                {meal.isLocked ? '🔒' : '🔓'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={s.mealName} numberOfLines={1}>{meal.dishName}</Text>
          <Text style={s.mealMeta}>
            {meal.price > 0 ? `${meal.price}K` : '—'} · {meal.kcal > 0 ? `${meal.kcal.toLocaleString('vi-VN')} kcal` : '—'}
          </Text>
          {isDone && <Text style={s.slotStatusDone}>Đã ăn</Text>}
          {isSkipped && <Text style={s.slotStatusSkip}>Đã bỏ</Text>}
        </View>
      </Pressable>

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
        </TouchableOpacity>
        {!isDone && !isSkipped ? (
          <TouchableOpacity
            style={[s.completeBtn, busy && { opacity: 0.5 }]}
            onPress={onComplete}
            disabled={busy}
          >
            <View style={s.checkEmpty} />
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
    marginHorizontal: 16, marginTop: 8, marginBottom: 10, borderRadius: 18, backgroundColor: WHITE,
    padding: 14, gap: 12, ...shadow,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  readyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  readyBadgeText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  summaryDateLine: { fontSize: 13, color: MUTED, fontWeight: '500' },
  summaryStatsCol: { gap: 6, alignItems: 'flex-end', maxWidth: '48%' },
  summaryStatLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryStatText: { fontSize: 12.5, fontWeight: '600', color: INK },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: 12, borderWidth: 1.2, borderColor: '#E5E0D4',
    backgroundColor: WHITE,
  },
  editPlanText: { fontSize: 14, fontWeight: '600', color: INK },

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
  mealSlotText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
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
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1.2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D4CEBF',
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
