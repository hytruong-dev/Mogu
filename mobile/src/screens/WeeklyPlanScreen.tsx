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
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  Flame,
  Leaf,
  Lock,
  LockOpen,
  Moon,
  Pencil,
  RefreshCw,
  ShoppingCart,
  Sun,
  Sunrise,
  Wallet,
} from '@/components/icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
import { cancelMealReminders, syncMealReminders } from '../lib/meal-reminders';

const CREAM = '#F7F2E8';
const WHITE = '#FFFFFF';
const INK = '#111111';
const YELLOW = '#FFC51A';
const YELLOW_D = '#D99A00';
const MUTED = '#8C857A';

const shadow = {
  shadowColor: '#8A6D2B',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
const softShadow = {
  shadowColor: '#8A6D2B',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
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
    return <WeeklyPlanLoadingSkeleton onBack={onBack} />;
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

  const statusTone = (() => {
    if (isPlanExpired) return { bg: '#F1EEE8', fg: '#6B6459', dot: '#A39B8E' };
    switch (planStatus) {
      case 'READY': return { bg: '#E3F8EA', fg: '#15803D', dot: '#22C55E' };
      case 'ACTIVE': return { bg: '#FFF1D6', fg: '#B45309', dot: '#F59E0B' };
      case 'GENERATING': return { bg: '#EEF0FF', fg: '#4F46E5', dot: '#6366F1' };
      case 'FAILED': return { bg: '#FDECEC', fg: '#B91C1C', dot: '#EF4444' };
      default: return { bg: '#F1EEE8', fg: '#6B6459', dot: '#A39B8E' };
    }
  })();
  const statusText = isPlanExpired
    ? 'Đã kết thúc'
    : planStatus
      ? (STATUS_LABEL[planStatus] ?? 'Kế hoạch')
      : 'Chưa có kế hoạch';
  const doneToday = selectedDay?.meals.filter((m) => m.status === 'COMPLETED').length ?? 0;
  const overKcal = calTotal > 0 && calProjected > calTotal;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.headerBtn} hitSlop={8} accessibilityLabel="Quay lại">
          <ArrowLeft size={20} color={INK} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>Thực đơn tuần</Text>
          {hasRealDays && planDateLabel ? (
            <Text style={s.headerSub}>{planDateLabel}</Text>
          ) : null}
        </View>
        {plan?.id && !isPlanExpired ? (
          <Pressable
            onPress={() => onOpenWeeklyGrocery?.(plan.id)}
            style={s.headerBtn}
            hitSlop={8}
            accessibilityLabel="Đi chợ tuần"
          >
            <ShoppingCart size={19} color={INK} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Pressable onPress={onMore} style={s.headerBtn} hitSlop={8}>
            <Text style={{ fontSize: 20, color: INK, marginTop: -4 }}>⋯</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={YELLOW} colors={[YELLOW]} />
        }
      >
        {/* ── Overview card ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(320)} style={s.overview}>
          <View style={s.overviewTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[s.statusPill, { backgroundColor: statusTone.bg }]}>
                <View style={[s.statusDot, { backgroundColor: statusTone.dot }]} />
                <Text style={[s.statusText, { color: statusTone.fg }]}>{statusText}</Text>
              </View>
              <Text style={s.overviewTitle} numberOfLines={1}>
                {hasRealDays ? `${totalSlots} bữa · ${displayDays.length} ngày` : 'Chưa có thực đơn'}
              </Text>
            </View>
            <Pressable
              onPress={onEditPlan}
              style={s.editBtn}
              accessibilityLabel={hasRealDays ? 'Chỉnh kế hoạch' : 'Lên kế hoạch'}
            >
              <Pencil size={14} color={INK} strokeWidth={2.2} />
              <Text style={s.editBtnText}>{hasRealDays ? 'Chỉnh sửa' : 'Lên kế hoạch'}</Text>
            </Pressable>
          </View>

          <View style={s.statGrid}>
            <View style={s.statTile}>
              <View style={s.statHead}>
                <View style={[s.statIcon, { backgroundColor: '#FFF1D6' }]}>
                  <Wallet size={14} color="#B45309" strokeWidth={2.3} />
                </View>
                <Text style={s.statLabel}>Ngân sách</Text>
              </View>
              <Text style={s.statValue}>
                {Math.round(endForecast / 1000)}K
                <Text style={s.statTotal}> / {Math.round(budget / 1000)}K</Text>
              </Text>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${budgetPct}%`, backgroundColor: YELLOW }]} />
              </View>
            </View>
            <View style={s.statTile}>
              <View style={s.statHead}>
                <View style={[s.statIcon, { backgroundColor: '#FFE8E0' }]}>
                  <Flame size={14} color="#EA580C" strokeWidth={2.3} />
                </View>
                <Text style={s.statLabel}>Năng lượng</Text>
              </View>
              <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {calProjected.toLocaleString('vi-VN')}
                <Text style={s.statTotal}> / {calTotal.toLocaleString('vi-VN')}</Text>
              </Text>
              <View style={s.bar}>
                <View
                  style={[
                    s.barFill,
                    { width: `${calPct}%`, backgroundColor: overKcal ? '#EF4444' : '#FB923C' },
                  ]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── GENERATING state notice ─────────────────────────────────────── */}
        {(planStatus === 'GENERATING' || pollingPlanId) && (
          <View style={s.generatingBanner}>
            <ActivityIndicator size="small" color="#B45309" />
            <Text style={s.generatingText}>NOAN đang chọn món cho bạn...</Text>
          </View>
        )}

        {/* ── Calendar strip ──────────────────────────────────────────────── */}
        {hasRealDays && (
          <View style={s.calendarRow}>
            {displayDays.map((day, idx) => {
              const isSelected = idx === safeIdx;
              const isTodayDay = isTodayISO(day.isoDate);
              const allDone =
                day.meals.length > 0 && day.meals.every((m) => m.status === 'COMPLETED');
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedIdx(idx)}
                  style={[s.calDay, isSelected && s.calDaySelected]}
                  accessibilityLabel={`${day.weekdayFull} ${day.date}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[s.calDayLabel, isSelected && s.calDayLabelSelected, isTodayDay && !isSelected && s.calToday]}>
                    {day.weekdayShort}
                  </Text>
                  <Text style={[s.calDayDate, isSelected && s.calDayDateSelected, isTodayDay && !isSelected && s.calToday]}>
                    {day.date}
                  </Text>
                  <View
                    style={[
                      s.calDot,
                      allDone
                        ? { backgroundColor: '#22C55E' }
                        : isTodayDay
                          ? { backgroundColor: isSelected ? INK : YELLOW_D }
                          : { backgroundColor: 'transparent' },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Day header ──────────────────────────────────────────────────── */}
        {hasRealDays && (
          <View style={s.dayHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.dayHeaderTitle}>{dayHeaderLeft}</Text>
              <Text style={s.dayHeaderSub}>{dayHeaderRight}</Text>
            </View>
            <View style={s.dayChips}>
              <View style={s.dayChip}>
                <Text style={s.dayChipText}>{selectedDay.estimatedCost}K</Text>
              </View>
              <View style={s.dayChip}>
                <Text style={s.dayChipText}>
                  {selectedDay.estimatedKcal.toLocaleString('vi-VN')} kcal
                </Text>
              </View>
              {selectedDay.meals.length > 0 ? (
                <View style={[s.dayChip, doneToday > 0 && { backgroundColor: '#E3F8EA' }]}>
                  <Text style={[s.dayChipText, doneToday > 0 && { color: '#15803D' }]}>
                    {doneToday}/{selectedDay.meals.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Meal cards hoặc Empty state ─────────────────────────────────── */}
        <View style={s.mealsSection}>
          {hasRealDays ? (
            <>
              {selectedDay.meals.map((meal, i) => (
                <Animated.View
                  key={`${selectedDay.isoDate}-${meal.slotId}`}
                  entering={FadeInDown.delay(i * 45).duration(260).withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: 10 }],
                  })}
                  style={s.mealSlot}
                >
                  <MealCard
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
                </Animated.View>
              ))}

              <View style={s.toolGrid}>
                <Pressable
                  style={s.toolTile}
                  onPress={() => {
                    if (!plan?.id || !selectedDay.isoDate) return;
                    onOpenIngredients?.(
                      plan.id,
                      selectedDay.isoDate,
                      `Nguyên liệu · ${selectedDay.weekdayFull}`,
                    );
                  }}
                  accessibilityLabel="Nguyên liệu trong ngày"
                >
                  <View style={[s.toolIcon, { backgroundColor: '#E6F7EC' }]}>
                    <Leaf size={20} color="#16A34A" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.toolTitle}>Nguyên liệu</Text>
                  <Text style={s.toolSub} numberOfLines={1}>
                    {isToday ? 'Cho hôm nay' : `Cho ${selectedDay.weekdayFull.toLowerCase()}`}
                  </Text>
                  </View>
                  <View style={s.toolArrow}>
                    <ChevronRight size={16} color={INK} />
                  </View>
                </Pressable>

                <Pressable
                  style={s.toolTile}
                  onPress={() => {
                    if (!plan?.id) return;
                    onOpenWeeklyGrocery?.(plan.id);
                  }}
                  accessibilityLabel="Đi chợ tuần"
                >
                  <View style={[s.toolIcon, { backgroundColor: '#FFF1D6' }]}>
                    <ShoppingCart size={19} color="#B45309" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.toolTitle}>Đi chợ tuần</Text>
                  <Text style={s.toolSub} numberOfLines={1}>Gộp cả tuần</Text>
                  </View>
                  <View style={s.toolArrow}>
                    <ChevronRight size={16} color={INK} />
                  </View>
                </Pressable>
              </View>
            </>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={s.emptyState}>
              <View style={s.emptyIcon}>
                <CalendarDays size={34} color="#B45309" strokeWidth={2} />
              </View>
              <Text style={s.emptyTitle}>
                {isPlanExpired ? 'Kế hoạch tuần trước đã kết thúc' : 'Chưa có thực đơn tuần này'}
              </Text>
              <Text style={s.emptySubtitle}>
                {isPlanExpired
                  ? 'Tuần mới đã bắt đầu. Hãy cấu hình kế hoạch\nđể NOAN gợi ý thực đơn cho tuần này.'
                  : 'Nhấn "Lên kế hoạch" để NOAN gợi ý\nthực đơn tuần phù hợp với bạn.'}
              </Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
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
          <View style={[s.startBtn, s.activeBtn]}>
            <Flame size={18} color="#15803D" strokeWidth={2.3} />
            <Text style={[s.startBtnText, { color: '#15803D' }]}>Đang thực hiện</Text>
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
        >
          {actionLoading === 'regen'
            ? <ActivityIndicator size="small" color={MUTED} />
            : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} color={MUTED} strokeWidth={2.2} />
                <Text style={s.recreateBtnText}>{regenLabel}</Text>
              </View>
            )
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

// ── Skeleton components ───────────────────────────────────────────────────────
function usePulse() {
  const v = useSharedValue(0.55);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}

function PlanBone({
  w,
  h,
  r = 8,
  style,
}: {
  w: number | `${number}%`;
  h: number | `${number}%`;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: '#EDE4D0',
        },
        pulse,
        style,
      ]}
    />
  );
}

function WeeklyPlanLoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.headerBtn} hitSlop={8} accessibilityLabel="Quay lại">
          <ArrowLeft size={20} color={INK} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>Thực đơn tuần</Text>
          <PlanBone w={78} h={11} r={5} style={{ marginTop: 4 }} />
        </View>
        <View style={s.headerBtn}>
          <ShoppingCart size={19} color="#B8AE9C" strokeWidth={2.2} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Overview card */}
        <View style={s.overview}>
          <View style={s.overviewTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[s.statusPill, { backgroundColor: '#E3F8EA' }]}>
                <View style={[s.statusDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[s.statusText, { color: '#15803D' }]}>Sẵn sàng</Text>
              </View>
              <PlanBone w={140} h={20} r={6} style={{ marginTop: 2 }} />
            </View>
            <View style={s.editBtn}>
              <Pencil size={14} color={INK} strokeWidth={2.2} />
              <Text style={s.editBtnText}>Chỉnh sửa</Text>
            </View>
          </View>

          <View style={s.statGrid}>
            <View style={s.statTile}>
              <View style={s.statHead}>
                <View style={[s.statIcon, { backgroundColor: '#FFF1D6' }]}>
                  <Wallet size={14} color="#B45309" strokeWidth={2.3} />
                </View>
                <Text style={s.statLabel}>Ngân sách</Text>
              </View>
              <PlanBone w={92} h={17} r={5} style={{ marginVertical: 3 }} />
              <View style={s.bar}>
                <View style={[s.barFill, { width: '50%', backgroundColor: YELLOW }]} />
              </View>
            </View>

            <View style={s.statTile}>
              <View style={s.statHead}>
                <View style={[s.statIcon, { backgroundColor: '#FFE8E0' }]}>
                  <Flame size={14} color="#EA580C" strokeWidth={2.3} />
                </View>
                <Text style={s.statLabel}>Năng lượng</Text>
              </View>
              <PlanBone w={110} h={17} r={5} style={{ marginVertical: 3 }} />
              <View style={s.bar}>
                <View style={[s.barFill, { width: '65%', backgroundColor: '#FB923C' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Calendar strip */}
        <View style={s.calendarRow}>
          {['T5', 'T6', 'T7', 'CN', 'T2', 'T3', 'T4'].map((dayName, idx) => {
            const isSelected = idx === 6;
            return (
              <View key={idx} style={[s.calDay, isSelected && s.calDaySelected]}>
                <Text style={[s.calDayLabel, isSelected && s.calDayLabelSelected]}>
                  {dayName}
                </Text>
                <PlanBone
                  w={18}
                  h={16}
                  r={4}
                  style={[{ marginTop: 3 }, isSelected && { backgroundColor: 'rgba(0,0,0,0.18)' }]}
                />
                <View
                  style={[
                    s.calDot,
                    isSelected ? { backgroundColor: INK } : { backgroundColor: 'transparent' },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Day header */}
        <View style={s.dayHeader}>
          <View style={{ flex: 1, gap: 5 }}>
            <PlanBone w={88} h={20} r={6} />
            <PlanBone w={125} h={13} r={5} />
          </View>
          <View style={s.dayChips}>
            <View style={s.dayChip}><PlanBone w={30} h={12} r={4} /></View>
            <View style={s.dayChip}><PlanBone w={54} h={12} r={4} /></View>
            <View style={s.dayChip}><PlanBone w={24} h={12} r={4} /></View>
          </View>
        </View>

        {/* Meals section */}
        <View style={s.mealsSection}>
          {[
            { label: 'Bữa sáng', bg: '#FFF1D6', fg: '#C2410C', Icon: Sunrise },
            { label: 'Bữa trưa', bg: '#FFF6C7', fg: '#A16207', Icon: Sun },
            { label: 'Bữa tối', bg: '#ECEBFF', fg: '#4F46E5', Icon: Moon },
          ].map((slot, i) => {
            const Icon = slot.Icon;
            return (
              <View key={i} style={s.mealSlot}>
                <View style={s.mealCard}>
                  <View style={s.mealPressable}>
                    <View style={s.mealImage}>
                      <PlanBone w="100%" h="100%" r={16} />
                    </View>
                    <View style={s.mealInfo}>
                      <View style={s.mealSlotRow}>
                        <View style={[s.slotPill, { backgroundColor: slot.bg }]}>
                          <Icon size={12} color={slot.fg} strokeWidth={2.4} />
                          <Text style={[s.slotPillText, { color: slot.fg }]}>{slot.label}</Text>
                        </View>
                      </View>
                      <PlanBone w={i === 0 ? '82%' : i === 1 ? '70%' : '76%'} h={18} r={6} />
                      <PlanBone w={108} h={13} r={5} />
                    </View>
                  </View>
                  <View style={s.mealActions}>
                    <View style={s.roundBtn}>
                      <RefreshCw size={14} color="#C4BBA8" strokeWidth={2.2} />
                    </View>
                    <View style={[s.roundBtn, s.checkBtn]}>
                      <Check size={14} color="#C4BBA8" strokeWidth={2.4} />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Tool grid */}
          <View style={s.toolGrid}>
            <View style={s.toolTile}>
              <View style={[s.toolIcon, { backgroundColor: '#E6F7EC' }]}>
                <Leaf size={20} color="#16A34A" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={s.toolTitle}>Nguyên liệu</Text>
                <PlanBone w={74} h={12} r={5} />
              </View>
              <View style={s.toolArrow}>
                <ChevronRight size={16} color={INK} />
              </View>
            </View>

            <View style={s.toolTile}>
              <View style={[s.toolIcon, { backgroundColor: '#FFF1D6' }]}>
                <ShoppingCart size={19} color="#B45309" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={s.toolTitle}>Đi chợ tuần</Text>
                <PlanBone w={68} h={12} r={5} />
              </View>
              <View style={s.toolArrow}>
                <ChevronRight size={16} color={INK} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.startBtn}>
          <Text style={s.startBtnText}>Bắt đầu kế hoạch</Text>
        </View>
        <View style={s.recreateBtn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} color={MUTED} strokeWidth={2.2} />
            <Text style={s.recreateBtnText}>Tạo lại thực đơn</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── MealCard ──────────────────────────────────────────────────────────────────
const SLOT_TONE: Record<string, { bg: string; fg: string; Icon: typeof Sun }> = {
  'Bữa sáng': { bg: '#FFF1D6', fg: '#C2410C', Icon: Sunrise },
  'Bữa trưa': { bg: '#FFF6C7', fg: '#A16207', Icon: Sun },
  'Bữa tối': { bg: '#ECEBFF', fg: '#4F46E5', Icon: Moon },
  'Bữa phụ': { bg: '#E6F7EC', fg: '#15803D', Icon: Coffee },
};

function MealCard({
  meal, isReal, busy, swapping, onSwap, onComplete, onSkip: _onSkip, onToggleLock, onOpenDish,
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
  const tone = SLOT_TONE[meal.slot] ?? SLOT_TONE['Bữa trưa'];
  const SlotIcon = tone.Icon;
  const swapDisabled = !isReal || meal.isLocked || swapping || isDone || isSkipped;

  return (
    <View style={[s.mealCard, (isDone || isSkipped) && s.mealCardDone]}>
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
              fallbackIcon={<Text style={{ fontSize: 30 }}>{meal.slotIcon}</Text>}
            />
          ) : (
            <Text style={{ fontSize: 30 }}>{meal.slotIcon}</Text>
          )}
          {isDone ? (
            <View style={s.doneOverlay}>
              <Check size={22} color={WHITE} strokeWidth={3} />
            </View>
          ) : null}
        </View>

        <View style={s.mealInfo}>
          <View style={s.mealSlotRow}>
            <View style={[s.slotPill, { backgroundColor: tone.bg }]}>
              <SlotIcon size={12} color={tone.fg} strokeWidth={2.4} />
              <Text style={[s.slotPillText, { color: tone.fg }]}>{meal.slot}</Text>
            </View>
            <TouchableOpacity
              onPress={onToggleLock}
              disabled={!isReal || busy || isDone || isSkipped}
              hitSlop={10}
              style={[s.lockBtn, meal.isLocked && s.lockBtnOn]}
              accessibilityLabel={meal.isLocked ? 'Bỏ khoá món' : 'Khoá món'}
            >
              {meal.isLocked ? (
                <Lock size={11} color="#B45309" strokeWidth={2.6} />
              ) : (
                <LockOpen size={11} color="#B5AEA2" strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[s.mealName, isSkipped && s.mealNameSkipped]} numberOfLines={2}>
            {meal.dishName}
          </Text>
          <View style={s.metaRow}>
            <Text style={s.mealMeta}>{meal.price > 0 ? `${meal.price}K` : '—'}</Text>
            <View style={s.metaDot} />
            <Text style={s.mealMeta}>
              {meal.kcal > 0 ? `${meal.kcal.toLocaleString('vi-VN')} kcal` : '—'}
            </Text>
            {isDone ? <Text style={s.slotStatusDone}>· Đã ăn</Text> : null}
            {isSkipped ? <Text style={s.slotStatusSkip}>· Đã bỏ</Text> : null}
          </View>
        </View>
      </Pressable>

      <View style={s.mealActions}>
        <TouchableOpacity
          style={[s.roundBtn, swapDisabled && { opacity: 0.35 }]}
          activeOpacity={0.7}
          onPress={onSwap}
          disabled={swapDisabled}
          accessibilityLabel="Đổi món"
        >
          {swapping
            ? <ActivityIndicator size="small" color={INK} />
            : <RefreshCw size={15} color={INK} strokeWidth={2.2} />
          }
        </TouchableOpacity>
        {!isDone && !isSkipped ? (
          <TouchableOpacity
            style={[s.roundBtn, s.checkBtn, busy && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={onComplete}
            disabled={busy}
            accessibilityLabel="Đánh dấu đã ăn"
          >
            <Check size={16} color="#C9C1B2" strokeWidth={2.6} />
          </TouchableOpacity>
        ) : (
          <View
            style={[
              s.roundBtn,
              isDone ? s.checkBtnDone : { backgroundColor: '#F3F1EC', borderColor: '#F3F1EC' },
            ]}
          >
            {isDone
              ? <Check size={16} color={WHITE} strokeWidth={3} />
              : <Text style={{ fontSize: 14, fontWeight: '700', color: MUTED }}>—</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6, gap: 12,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center', ...softShadow,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 1, fontWeight: '500' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  overview: {
    marginHorizontal: 16, marginTop: 4, borderRadius: 24, backgroundColor: WHITE,
    padding: 14, gap: 10, ...shadow,
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  overviewTitle: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFF6D6',
    borderWidth: 1, borderColor: '#F7E3A1',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: INK },

  statGrid: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, backgroundColor: '#FBF8F2', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', color: MUTED },
  statValue: { fontSize: 16, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  statTotal: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EFE8D8', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  generatingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: '#FFF7DB', borderRadius: 14,
  },
  generatingText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },

  calendarRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 10, padding: 4,
    backgroundColor: WHITE, borderRadius: 20, ...softShadow,
  },
  calDay: { flex: 1, borderRadius: 14, alignItems: 'center', paddingTop: 5, paddingBottom: 3 },
  calDaySelected: {
    backgroundColor: YELLOW,
    shadowColor: '#D99A00', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  calDayLabel: { fontSize: 11, fontWeight: '600', color: MUTED },
  calDayLabelSelected: { color: INK },
  calDayDate: { fontSize: 15, fontWeight: '800', color: '#3A3A3A', marginTop: 2 },
  calDayDateSelected: { color: INK },
  calToday: { color: YELLOW_D },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },

  dayHeader: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8,
  },
  dayHeaderTitle: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  dayHeaderSub: { fontSize: 12.5, color: MUTED, marginTop: 1, fontWeight: '500' },
  dayChips: { flexDirection: 'row', gap: 6 },
  dayChip: { backgroundColor: '#EFE9DC', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dayChipText: { fontSize: 11.5, fontWeight: '700', color: '#5C554A' },

  mealsSection: { flex: 1, paddingHorizontal: 16, gap: 10 },
  mealSlot: { flex: 1, minHeight: 78, maxHeight: 150 },

  mealCard: {
    flex: 1, backgroundColor: WHITE, borderRadius: 20, flexDirection: 'row', alignItems: 'center',
    padding: 10, paddingRight: 12, gap: 10,
    borderWidth: 1, borderColor: '#F0E7D4',
    // Android: elevation + animated opacity renders a dark halo → use border only.
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#8A6D2B', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 0 }),
  },
  mealCardDone: { backgroundColor: '#FCFBF8' },
  mealPressable: { flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 14 },
  mealImage: {
    alignSelf: 'stretch', aspectRatio: 1, minWidth: 58, maxWidth: 118, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0, backgroundColor: '#F6F0E2',
  },
  mealImageSource: { width: '100%', height: '100%', borderRadius: 16 },
  doneOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,163,74,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  mealInfo: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 6 },
  mealSlotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  slotPillText: { fontSize: 11.5, fontWeight: '700' },
  lockBtn: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F2EC',
  },
  lockBtnOn: { backgroundColor: '#FFF1D6' },
  mealName: { fontSize: 16.5, fontWeight: '700', color: INK, letterSpacing: -0.2, lineHeight: 21 },
  mealNameSkipped: { color: MUTED, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#C9C1B2' },
  mealMeta: { fontSize: 13.5, color: MUTED, fontWeight: '500' },
  slotStatusDone: { fontSize: 12.5, color: '#15803D', fontWeight: '700' },
  slotStatusSkip: { fontSize: 12.5, color: MUTED, fontWeight: '600' },

  mealActions: { alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0 },
  roundBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F4EE',
    borderWidth: 1, borderColor: '#EFE9DC', alignItems: 'center', justifyContent: 'center',
  },
  checkBtn: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#E4DDCD' },
  checkBtnDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: MUTED, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 12, marginLeft: 4,
  },
  toolGrid: { flexDirection: 'row', gap: 10, marginTop: 2 },
  toolTile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: WHITE, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, ...shadow,
  },
  toolIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 15, fontWeight: '700', color: INK },
  toolSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  toolArrow: { marginLeft: 'auto' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFF1D6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: INK, textAlign: 'center' },
  emptySubtitle: { fontSize: 13.5, color: MUTED, textAlign: 'center', lineHeight: 20 },

  footer: {
    backgroundColor: CREAM, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 0,
  },
  startBtn: {
    height: 50, borderRadius: 999, backgroundColor: YELLOW, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D99A00', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  activeBtn: { backgroundColor: '#DCFCE7', shadowOpacity: 0, elevation: 0 },
  startBtnText: { fontSize: 16, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  recreateBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  recreateBtnText: { fontSize: 13, fontWeight: '600', color: MUTED },
});
