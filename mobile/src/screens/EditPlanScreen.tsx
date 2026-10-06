/**
 * EditPlanScreen — Lên kế hoạch tuần
 * Khớp 100% mockup mogu-week-plan-config-v2.png + docs MOBILE_WEEK_PLAN_FLOW_UX_REDESIGN_2026
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StyledPressable as Pressable } from '../components/ui/styled-pressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  Info,
  Minus,
  Plus,
  SlidersHorizontal,
  UtensilsCrossed,
  Wallet,
} from '@/components/icons';

import { Button } from '../components/ui/button';
import {
  upsertWeeklyPlanConfig,
  generateWeeklyPlan,
  getWeeklyPlanConfig,
  pollWeeklyPlan,
  getBudgetEstimate,
} from '../services/api/weekly-plan';
import { profileApi } from '../services/api/profile';
import { syncCurrentMealReminders } from '../lib/meal-reminders';
import type {
  WeeklyMealMode,
  WeeklyMealSlot,
  WeeklyPlanBudgetEstimate,
  WeeklyPlanGenerationErrorData,
} from '../services/api/types';
import { getTodayISO } from '../lib/dates';
import { EditPlanSkeleton } from '../components/skeletons/ScreenSkeletons';
import { trackWeeklyPlanEvent } from '../lib/weekly-plan-analytics';

import { BudgetSlider } from '../components/weekly-plan/BudgetSlider';
import {
  MealScheduleSheet,
  defaultScheduleDraft,
  type ScheduleDraft,
} from '../components/weekly-plan/MealScheduleSheet';
import {
  AdvancedOptionsScreen,
  DEFAULT_ADVANCED_OPTIONS,
  advancedOptionsSummary,
  type AdvancedOptions,
} from '../components/weekly-plan/AdvancedOptionsScreen';
import { WeeklyPlanFailureSheet } from '../components/weekly-plan/WeeklyPlanFailureSheet';
import {
  WeeklyPlanSuccessSheet,
  type WeeklyPlanSuccessData,
} from '../components/weekly-plan/WeeklyPlanSuccessSheet';

type Props = {
  onBack: () => void;
  onReset?: () => void;
  onSave?: (plan: PlanConfig) => void;
  onOpenWeeklyPlan?: (planId: string) => void;
  onGoHome?: () => void;
  onViewDishes?: () => void;
};

export type PlanConfig = {
  budget: number;
  kcalPerDay: number;
  kcalMode: 'profile' | 'custom';
  days: number;
  mealsPerDay: number;
  mealSlots: { sang: boolean; trua: boolean; toi: boolean; phu: boolean };
  advanced?: AdvancedOptions;
  startDate?: string;
  schedule?: ScheduleDraft;
};

const BUDGET_MIN = 0;
const BUDGET_MAX = 2000000;
const BUDGET_STEP = 50000;

const MEAL_MODE_OPTIONS: Array<{ value: WeeklyMealMode; label: string; desc: string }> = [
  {
    value: 'HOME_COOK',
    label: 'Tự nấu',
    desc: 'Tính giá nguyên liệu cho 1 khẩu phần khi bạn tự nấu tại nhà.',
  },
  {
    value: 'EAT_OUT',
    label: 'Ăn ngoài',
    desc: 'Tính theo giá ăn ngoài của từng món.',
  },
  {
    value: 'FLEXIBLE',
    label: 'Linh hoạt',
    desc: 'Mỗi bữa lấy mức giá rẻ hơn giữa tự nấu và ăn ngoài — dễ đạt ngân sách nhất.',
  },
];

const MEAL_MODE_LABEL: Record<WeeklyMealMode, string> = {
  HOME_COOK: 'Tự nấu',
  EAT_OUT: 'Ăn ngoài',
  FLEXIBLE: 'Linh hoạt',
};
const KCAL_STEP = 50;
const KCAL_MIN = 1000;
const KCAL_MAX = 5000;

const YELLOW = '#FFC20E';
const INK = '#111111';
const MUTED = '#8A8580';
const CREAM = '#FFFDF7';
const CARD = '#FFFFFF';
const BORDER = '#EAE6DF';

const formatVi = (n: number) => n.toLocaleString('vi-VN');
const formatBudgetK = (n: number) => {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
};

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string) {
  const [, m, day] = iso.split('-');
  return `${day}/${m}`;
}

function slotsToFlags(slots: ScheduleDraft['mealSlots']) {
  return {
    sang: !!slots.find((s) => s.type === 'MORNING' && s.enabled),
    trua: !!slots.find((s) => s.type === 'LUNCH' && s.enabled),
    toi: !!slots.find((s) => s.type === 'DINNER' && s.enabled),
    phu: !!slots.find((s) => s.type === 'SNACK' && s.enabled),
  };
}

export function EditPlanScreen({
  onBack,
  onReset,
  onSave,
  onOpenWeeklyPlan,
  onGoHome,
  onViewDishes,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const requestIdRef = useRef<string | null>(null);

  const [budget, setBudget] = useState(300000);
  const [mealMode, setMealMode] = useState<WeeklyMealMode>('FLEXIBLE');
  const [estimate, setEstimate] = useState<WeeklyPlanBudgetEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [kcalMode, setKcalMode] = useState<'profile' | 'custom'>('profile');
  const [customKcal, setCustomKcal] = useState(2000);
  const [profileKcal, setProfileKcal] = useState(2000);
  const [schedule, setSchedule] = useState<ScheduleDraft>(() =>
    defaultScheduleDraft(getTodayISO()),
  );
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedOptions>(
    DEFAULT_ADVANCED_OPTIONS,
  );

  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [advancedSheetOpen, setAdvancedSheetOpen] = useState(false);
  const [failureSheetOpen, setFailureSheetOpen] = useState(false);
  const [failureErrorData, setFailureErrorData] =
    useState<WeeklyPlanGenerationErrorData | null>(null);
  const [successSheetOpen, setSuccessSheetOpen] = useState(false);
  const [successData, setSuccessData] = useState<WeeklyPlanSuccessData | null>(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [editingKcal, setEditingKcal] = useState<string | null>(null);
  const kcalTimerRef = useRef<{ timeout?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});

  useEffect(() => {
    trackWeeklyPlanEvent({ name: 'weekly_plan_config_viewed' });
    (async () => {
      try {
        const [configRes, profileRes] = await Promise.allSettled([
          getWeeklyPlanConfig(),
          profileApi.getHealthProfile<any>().catch(() => null),
        ]);

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const pk =
            profileRes.value.dailyCaloriesTarget ??
            profileRes.value.tdee ??
            2000;
          setProfileKcal(pk);
        }

        if (configRes.status === 'fulfilled' && configRes.value) {
          const c = configRes.value;
          if (c.budgetVnd != null) setBudget(c.budgetVnd);
          if (c.mealMode) setMealMode(c.mealMode);
          if (c.kcalMode === 'CUSTOM') {
            setKcalMode('custom');
            if (c.kcalPerDay) setCustomKcal(c.kcalPerDay);
          } else {
            setKcalMode('profile');
            if (c.kcalPerDay) setProfileKcal(c.kcalPerDay);
          }

          const start = getTodayISO();
          if (c.mealSlotSchedule?.length) {
            setSchedule({
              startDate: start,
              durationDays: c.durationDays ?? 7,
              mealSlots: c.mealSlotSchedule.map((s) => ({
                type: s.type,
                enabled: s.enabled,
                time: s.time,
              })),
            });
          } else if (c.enabledSlots) {
            const enabled = new Set(c.enabledSlots);
            setSchedule({
              startDate: start,
              durationDays: c.durationDays ?? 7,
              mealSlots: [
                { type: 'MORNING', enabled: enabled.has('MORNING'), time: '07:00' },
                { type: 'LUNCH', enabled: enabled.has('LUNCH'), time: '12:00' },
                { type: 'DINNER', enabled: enabled.has('DINNER'), time: '18:30' },
                {
                  type: 'SNACK',
                  enabled: enabled.has('SNACK'),
                  time: enabled.has('SNACK') ? '15:00' : null,
                },
              ],
            });
          }

          setAdvancedOptions({
            preferSelfCook: c.preferHomeCook ?? true,
            allowOutsideMeals: c.allowOutsideMeals ?? true,
            limitRepeats: c.avoidRepeat ?? true,
            repeatWindowDays: c.repeatWindowDays ?? 7,
            preferNewDishes: c.preferNewDishes ?? true,
            likedDishPreference: c.likedDishPreference ?? 'LIGHT',
            keepLockedMeals: c.keepLockedMeals ?? true,
            preserveLoggedDays: c.preserveLoggedDays ?? true,
            calorieTolerancePercent: ([5, 10, 20, 30].includes(
              c.calorieTolerancePercent as number,
            )
              ? c.calorieTolerancePercent
              : 10) as 5 | 10 | 20 | 30,
          });
        }
      } catch {
        // defaults
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const enabledSlotsList = (): WeeklyMealSlot[] =>
    schedule.mealSlots.filter((s) => s.enabled).map((s) => s.type);

  const mealSlotsFlags = useMemo(
    () => slotsToFlags(schedule.mealSlots),
    [schedule.mealSlots],
  );
  const days = schedule.durationDays;
  const mealsPerDay = enabledSlotsList().length;
  const totalMeals = days * mealsPerDay;
  const currentKcal = kcalMode === 'profile' ? profileKcal : customKcal;
  const perMealBudget = totalMeals > 0 ? Math.round(budget / totalMeals) : 0;
  const advancedSummary = advancedOptionsSummary(advancedOptions);

  // Ước tính ngân sách tối thiểu / thoải mái theo kho món thật (debounce 300ms)
  const slotsKey = enabledSlotsList().join(',');
  useEffect(() => {
    if (!slotsKey) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getBudgetEstimate({
          slots: slotsKey.split(',') as WeeklyMealSlot[],
          days,
        });
        if (!cancelled) setEstimate(res);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slotsKey, days]);

  const modeEstimate = estimate?.byMode[mealMode] ?? null;
  const minBudget = modeEstimate?.feasible ? modeEstimate.minBudgetVnd : null;
  const comfortableBudget = modeEstimate?.feasible ? modeEstimate.comfortableBudgetVnd : null;
  const belowMinBudget = minBudget != null && budget < minBudget;
  // Dưới mức rẻ nhất (cho phép lặp món) thì chắc chắn không tạo được
  const belowHardMin = modeEstimate?.feasible ? budget < modeEstimate.hardMinBudgetVnd : false;
  const cheaperMode = (() => {
    if (!estimate || !belowMinBudget) return null;
    const alt = (['FLEXIBLE', 'EAT_OUT', 'HOME_COOK'] as WeeklyMealMode[])
      .filter((m) => m !== mealMode && estimate.byMode[m].feasible)
      .filter((m) => estimate.byMode[m].minBudgetVnd < (minBudget ?? Infinity))
      .sort((a, b) => estimate.byMode[a].minBudgetVnd - estimate.byMode[b].minBudgetVnd)[0];
    return alt ?? null;
  })();

  const selectMealMode = (m: WeeklyMealMode) => {
    if (generating || m === mealMode) return;
    trackChange('mealMode', mealMode, m);
    setMealMode(m);
  };

  const trackChange = (field: string, oldValue: unknown, newValue: unknown) => {
    trackWeeklyPlanEvent({
      name: 'weekly_plan_value_changed',
      payload: { field, oldValue, newValue },
    });
  };

  const handleReset = () => {
    setBudget(300000);
    setMealMode('FLEXIBLE');
    setKcalMode('profile');
    setCustomKcal(2000);
    setSchedule(defaultScheduleDraft(getTodayISO()));
    setAdvancedOptions({ ...DEFAULT_ADVANCED_OPTIONS });
    trackChange('reset', null, 'defaults');
    onReset?.();
  };

  const toggleSlot = (key: keyof typeof mealSlotsFlags) => {
    const typeMap = {
      sang: 'MORNING',
      trua: 'LUNCH',
      toi: 'DINNER',
      phu: 'SNACK',
    } as const;
    const type = typeMap[key];
    setSchedule((prev) => {
      const nextSlots = prev.mealSlots.map((s) => {
        if (s.type !== type) return s;
        if (s.enabled) return { ...s, enabled: false };
        return {
          ...s,
          enabled: true,
          time: s.time ?? (type === 'SNACK' ? '15:00' : s.time),
        };
      });
      if (!nextSlots.some((s) => s.enabled)) {
        Alert.alert('Lưu ý', 'Bạn cần chọn ít nhất một bữa ăn trong ngày.');
        return prev;
      }
      trackChange(`mealSlot_${key}`, mealSlotsFlags[key], !mealSlotsFlags[key]);
      return { ...prev, mealSlots: nextSlots };
    });
  };

  const adjustKcal = (delta: number) => {
    if (kcalMode === 'profile') {
      setKcalMode('custom');
      const next = Math.min(KCAL_MAX, Math.max(KCAL_MIN, profileKcal + delta));
      setCustomKcal(next);
      trackChange('kcalMode', 'profile', 'custom');
      return;
    }
    setCustomKcal((prev) => {
      const next = Math.min(KCAL_MAX, Math.max(KCAL_MIN, prev + delta));
      trackChange('customKcal', prev, next);
      return next;
    });
  };

  const stopKcalRepeat = () => {
    if (kcalTimerRef.current.timeout) clearTimeout(kcalTimerRef.current.timeout);
    if (kcalTimerRef.current.interval) clearInterval(kcalTimerRef.current.interval);
    kcalTimerRef.current = {};
  };

  const handleKcalPressIn = (delta: number) => {
    stopKcalRepeat();
    kcalTimerRef.current.timeout = setTimeout(() => {
      kcalTimerRef.current.interval = setInterval(() => {
        adjustKcal(delta);
      }, 100);
    }, 350);
  };

  const handleKcalTextChange = (t: string) => {
    if (kcalMode === 'profile') {
      setKcalMode('custom');
      trackChange('kcalMode', 'profile', 'custom');
    }
    const digits = t.replace(/\D/g, '');
    setEditingKcal(digits);
    const num = parseInt(digits, 10);
    if (Number.isFinite(num)) {
      setCustomKcal(Math.min(KCAL_MAX, Math.max(KCAL_MIN, num)));
    }
  };

  const handleKcalBlur = () => {
    if (editingKcal !== null) {
      const num = parseInt(editingKcal, 10);
      if (!Number.isFinite(num) || num < KCAL_MIN) {
        setCustomKcal(KCAL_MIN);
      } else if (num > KCAL_MAX) {
        setCustomKcal(KCAL_MAX);
      }
      setEditingKcal(null);
    }
  };

  const buildDto = () => {
    const slots = enabledSlotsList();
    if (slots.length === 0) throw new Error('Vui lòng chọn ít nhất một bữa ăn.');
    return {
      budgetVnd: budget,
      kcalPerDay: currentKcal,
      kcalMode: kcalMode === 'custom' ? ('CUSTOM' as const) : ('PROFILE' as const),
      mealMode,
      durationDays: days,
      enabledSlots: slots,
      mealSlotSchedule: schedule.mealSlots,
      avoidRepeat: advancedOptions.limitRepeats,
      // Tương thích ngược: suy từ hình thức ăn
      preferHomeCook: mealMode === 'HOME_COOK' ? true : advancedOptions.preferSelfCook,
      allowOutsideMeals: mealMode !== 'HOME_COOK',
      repeatWindowDays: advancedOptions.repeatWindowDays,
      preferNewDishes: advancedOptions.preferNewDishes,
      likedDishPreference: advancedOptions.likedDishPreference,
      keepLockedMeals: advancedOptions.keepLockedMeals,
      preserveLoggedDays: advancedOptions.preserveLoggedDays,
      calorieTolerancePercent: advancedOptions.calorieTolerancePercent,
      advanced: {
        mealMode,
        preferSelfCook: mealMode === 'HOME_COOK' ? true : advancedOptions.preferSelfCook,
        allowOutsideMeals: mealMode !== 'HOME_COOK',
        limitRepeats: advancedOptions.limitRepeats,
        repeatWindowDays: advancedOptions.repeatWindowDays,
        preferNewDishes: advancedOptions.preferNewDishes,
        likedDishPreference: advancedOptions.likedDishPreference,
        keepLockedMeals: advancedOptions.keepLockedMeals,
        preserveLoggedDays: advancedOptions.preserveLoggedDays,
      },
    };
  };

  const handleSaveDefault = async () => {
    setSavingConfig(true);
    try {
      const dto = buildDto();
      await upsertWeeklyPlanConfig(dto);
      onSave?.({
        budget,
        kcalPerDay: currentKcal,
        kcalMode,
        days,
        mealsPerDay,
        mealSlots: mealSlotsFlags,
        advanced: advancedOptions,
        startDate: schedule.startDate,
        schedule,
      });
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 2500);
    } catch (err: any) {
      Alert.alert('Không thể lưu', err?.message || 'Có lỗi khi lưu cấu hình.');
    } finally {
      setSavingConfig(false);
    }
  };

  const runGenerate = async () => {
    if (enabledSlotsList().length === 0) {
      Alert.alert('Lưu ý', 'Vui lòng chọn ít nhất một bữa ăn.');
      return;
    }
    if (budget < BUDGET_MIN || budget > BUDGET_MAX) return;
    if (currentKcal < KCAL_MIN || currentKcal > KCAL_MAX) return;

    setGenerating(true);
    setTimedOut(false);
    const idempotencyKey =
      requestIdRef.current ??
      `gen-plan-${schedule.startDate}-${Date.now()}`;
    requestIdRef.current = idempotencyKey;

    trackWeeklyPlanEvent({
      name: 'weekly_plan_create_requested',
      payload: {
        durationDays: days,
        budget,
        dailyCalories: currentKcal,
        mealSlots: enabledSlotsList(),
      },
    });

    try {
      const dto = buildDto();
      await upsertWeeklyPlanConfig(dto);
      const genRes = await generateWeeklyPlan(schedule.startDate, {
        idempotencyKey,
        durationDays: days,
        budget,
        dailyCalories: currentKcal,
        calorieSource: kcalMode === 'custom' ? 'CUSTOM' : 'PROFILE',
        mealMode,
        mealSlots: enabledSlotsList(),
        advanced: dto.advanced,
      });
      const finalPlan = await pollWeeklyPlan(genRes.planId, {
        maxAttempts: 45,
        intervalMs: 2000,
      });

      if (finalPlan.status === 'FAILED') {
        const errData = finalPlan.generationErrorData ?? {
          status: 'INSUFFICIENT_CANDIDATES',
          message: 'Kho món hiện chưa đủ lựa chọn phù hợp với cấu hình này.',
          suggestions: [
            ...(minBudget != null ? [{ type: 'MIN_BUDGET', value: minBudget }] : []),
            { type: 'REVIEW_AVOIDED_INGREDIENTS' },
          ],
          approvedDishCount: 0,
        };
        trackWeeklyPlanEvent({
          name: 'weekly_plan_create_failed',
          payload: {
            reason: finalPlan.generationErrorCode || 'INSUFFICIENT_CANDIDATES',
            suggestionCount: errData.suggestions?.length ?? 3,
          },
        });
        setFailureErrorData(errData);
        setFailureSheetOpen(true);
        return;
      }

      if (finalPlan.status === 'GENERATING') {
        setTimedOut(true);
        return;
      }

      trackWeeklyPlanEvent({
        name: 'weekly_plan_created',
        payload: {
          planId: finalPlan.id,
          durationDays: days,
          mealCount: totalMeals,
        },
      });

      // Trích xuất dữ liệu thực tế 100% từ API finalPlan
      const actualMealCount = Array.isArray(finalPlan.days)
        ? finalPlan.days.reduce((acc, d) => acc + (d.slots?.length ?? 0), 0)
        : totalMeals;

      const actualDurationDays =
        Array.isArray(finalPlan.days) && finalPlan.days.length > 0
          ? finalPlan.days.length
          : days;

      setSuccessData({
        planId: finalPlan.id,
        startDate: finalPlan.startDate ?? schedule.startDate,
        endDate: finalPlan.endDate,
        durationDays: actualDurationDays,
        mealCount: actualMealCount,
        estimatedBudget: finalPlan.projectedCostVnd || budget,
        targetKcalPerDay: currentKcal,
      });
      void syncCurrentMealReminders();
      setSuccessSheetOpen(true);
      requestIdRef.current = null;
    } catch (err: any) {
      setFailureErrorData({
        status: 'ERROR',
        message: err?.message || 'Có lỗi xảy ra khi tạo kế hoạch.',
        suggestions: [],
        approvedDishCount: 0,
      });
      setFailureSheetOpen(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleAdjustFromFailure = (
    focus?: 'budget' | 'mealSlot' | 'avoided' | 'mealMode',
  ) => {
    setFailureSheetOpen(false);
    const budgetSug = failureErrorData?.suggestions?.find((s) => s.type === 'MIN_BUDGET');
    if (focus === 'budget' && budgetSug && typeof budgetSug.value === 'number') {
      setBudget(Math.min(BUDGET_MAX, budgetSug.value));
    }
    if (focus === 'mealMode') {
      const sug = failureErrorData?.suggestions?.find((s) => s.type === 'SWITCH_MEAL_MODE');
      const target = sug?.value?.mealMode as WeeklyMealMode | undefined;
      if (target) setMealMode(target);
    }
    if (focus === 'mealSlot') {
      setSchedule((prev) => ({
        ...prev,
        mealSlots: prev.mealSlots.map((s) =>
          s.type === 'SNACK'
            ? { ...s, enabled: true, time: s.time ?? '15:00' }
            : s,
        ),
      }));
    }
    scrollViewRef.current?.scrollTo({ y: focus === 'mealSlot' ? 420 : 0, animated: true });
  };

  const fieldsLocked = generating;
  const ctaDisabled = generating || mealsPerDay === 0 || belowHardMin;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backHit} hitSlop={10}>
          <ArrowLeft size={22} color={INK} strokeWidth={2.2} />
        </Pressable>
        <Text style={s.headerTitle}>Lên kế hoạch tuần</Text>
        <Pressable onPress={handleReset} hitSlop={10} disabled={fieldsLocked}>
          <Text style={s.resetText}>Đặt lại</Text>
        </Pressable>
      </View>

      {saveSuccessToast && (
        <View style={s.toast}>
          <Check size={14} color="#16A34A" strokeWidth={2.5} />
          <Text style={s.toastText}>Đã lưu cấu hình làm mặc định</Text>
        </View>
      )}

      {loadingConfig ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <EditPlanSkeleton />
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.scroll,
              { paddingBottom: Math.max(insets.bottom, 16) + 120 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero summary */}
            <View style={s.hero}>
              <Text style={s.heroEyebrow}>KẾ HOẠCH CỦA BẠN</Text>
              <Text style={s.heroTitle}>
                {totalMeals} bữa <Text style={s.heroTitleMuted}>trong {days} ngày</Text>
              </Text>
              <Text style={s.heroSub}>
                {formatShort(schedule.startDate)} – {formatShort(addDaysISO(schedule.startDate, days - 1))}
              </Text>
              <View style={s.heroChips}>
                <View style={s.heroChip}>
                  <Wallet size={14} color="#92400E" strokeWidth={2.2} />
                  <Text style={s.heroChipText}>{formatBudgetK(budget)}</Text>
                </View>
                <View style={s.heroChip}>
                  <Flame size={14} color="#C2410C" strokeWidth={2.2} />
                  <Text style={s.heroChipText}>{formatVi(currentKcal)} kcal/ngày</Text>
                </View>
                <View style={s.heroChip}>
                  <UtensilsCrossed size={14} color="#3F3B35" strokeWidth={2.2} />
                  <Text style={s.heroChipText}>{mealsPerDay} bữa/ngày</Text>
                </View>
              </View>
            </View>

            {/* Hình thức ăn */}
            <View style={s.card}>
              <SectionHeader
                icon={<UtensilsCrossed size={18} color="#3F3B35" strokeWidth={2.2} />}
                tint="#F3EFE6"
                title="Hình thức ăn"
                subtitle="Chọn cách tính giá cho từng bữa"
              />
              <View style={s.segment}>
                {MEAL_MODE_OPTIONS.map((opt) => {
                  const active = opt.value === mealMode;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => selectMealMode(opt.value)}
                      disabled={fieldsLocked}
                      style={[s.segmentItem, active && s.segmentItemActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.segmentText, active && s.segmentTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.modeDesc}>
                {MEAL_MODE_OPTIONS.find((o) => o.value === mealMode)?.desc}
              </Text>
            </View>

            {/* Ngân sách */}
            <View style={s.card}>
              <SectionHeader
                icon={<Wallet size={18} color="#B45309" strokeWidth={2.2} />}
                tint="#FFF4D6"
                title="Ngân sách"
                subtitle={`Tổng cho ${days} ngày`}
                right={
                  totalMeals > 0 ? (
                    <View style={s.pill}>
                      <Text style={s.pillText}>≈ {formatBudgetK(perMealBudget)}/bữa</Text>
                    </View>
                  ) : null
                }
              />
              <BudgetSlider
                value={budget}
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={BUDGET_STEP}
                onChange={(val) => {
                  if (fieldsLocked) return;
                  trackChange('budget', budget, val);
                  setBudget(val);
                }}
              />
              {minBudget != null && comfortableBudget != null ? (
                <Text style={s.estimateText}>
                  Tối thiểu ≈ {formatVi(minBudget)}đ · Thoải mái ≈ {formatVi(comfortableBudget)}đ
                </Text>
              ) : estimating ? (
                <Text style={s.estimateText}>Đang ước tính ngân sách...</Text>
              ) : modeEstimate && !modeEstimate.feasible ? (
                <Text style={s.estimateText}>
                  Kho món chưa có món phù hợp cho hình thức "{MEAL_MODE_LABEL[mealMode]}".
                </Text>
              ) : null}
              {belowMinBudget && minBudget != null ? (
                <View style={s.warnBox}>
                  <Info size={16} color="#92400E" strokeWidth={2.2} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={s.warnText}>
                      {belowHardMin
                        ? `Ngân sách này chưa đủ cho ${totalMeals} bữa ở hình thức "${MEAL_MODE_LABEL[mealMode]}".`
                        : 'Ngân sách hơi sát, kế hoạch có thể ít lựa chọn món.'}{' '}
                      Mức tối thiểu đề xuất là {formatVi(minBudget)}đ.
                    </Text>
                    <View style={s.warnActions}>
                      <Pressable
                        onPress={() => {
                          if (fieldsLocked) return;
                          trackChange('budget', budget, minBudget);
                          setBudget(Math.min(BUDGET_MAX, minBudget));
                        }}
                        style={s.warnBtn}
                      >
                        <Text style={s.warnBtnText}>Đặt về mức tối thiểu</Text>
                      </Pressable>
                      {cheaperMode ? (
                        <Pressable onPress={() => selectMealMode(cheaperMode)} style={s.warnBtn}>
                          <Text style={s.warnBtnText}>
                            Chuyển sang {MEAL_MODE_LABEL[cheaperMode]}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Năng lượng mỗi ngày */}
            <View style={s.card}>
              <SectionHeader
                icon={<Flame size={18} color="#C2410C" strokeWidth={2.2} />}
                tint="#FFEDE3"
                title="Năng lượng mỗi ngày"
                subtitle={
                  kcalMode === 'profile'
                    ? 'Theo mục tiêu sức khỏe hiện tại'
                    : 'Bạn đang tự đặt mức năng lượng'
                }
              />
              <View style={s.kcalStepper}>
                <Pressable
                  onPress={() => !fieldsLocked && adjustKcal(-KCAL_STEP)}
                  onPressIn={() => !fieldsLocked && handleKcalPressIn(-KCAL_STEP)}
                  onPressOut={stopKcalRepeat}
                  style={({ pressed }) => [
                    s.circleBtn,
                    pressed && s.circleBtnPressed,
                    (fieldsLocked || currentKcal <= KCAL_MIN) && s.circleBtnDisabled,
                  ]}
                  disabled={fieldsLocked || currentKcal <= KCAL_MIN}
                  hitSlop={8}
                >
                  <Minus size={20} color={fieldsLocked || currentKcal <= KCAL_MIN ? '#C8C3B8' : INK} strokeWidth={2.5} />
                </Pressable>

                <View style={s.kcalInputWrap}>
                  <TextInput
                    value={editingKcal !== null ? editingKcal : formatVi(currentKcal)}
                    onChangeText={handleKcalTextChange}
                    onBlur={handleKcalBlur}
                    onFocus={() => {
                      if (kcalMode === 'profile') {
                        setKcalMode('custom');
                        trackChange('kcalMode', 'profile', 'custom');
                      }
                      setEditingKcal(String(currentKcal));
                    }}
                    keyboardType="number-pad"
                    editable={!fieldsLocked}
                    style={s.kcalInput}
                    selectTextOnFocus
                  />
                  <Text style={s.kcalUnit}> kcal</Text>
                </View>

                <Pressable
                  onPress={() => !fieldsLocked && adjustKcal(KCAL_STEP)}
                  onPressIn={() => !fieldsLocked && handleKcalPressIn(KCAL_STEP)}
                  onPressOut={stopKcalRepeat}
                  style={({ pressed }) => [
                    s.circleBtn,
                    pressed && s.circleBtnPressed,
                    (fieldsLocked || currentKcal >= KCAL_MAX) && s.circleBtnDisabled,
                  ]}
                  disabled={fieldsLocked || currentKcal >= KCAL_MAX}
                  hitSlop={8}
                >
                  <Plus size={20} color={fieldsLocked || currentKcal >= KCAL_MAX ? '#C8C3B8' : INK} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={s.segment}>
                {(
                  [
                    { key: 'profile' as const, label: 'Theo hồ sơ' },
                    { key: 'custom' as const, label: 'Tự đặt' },
                  ] as const
                ).map((opt) => {
                  const active = kcalMode === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        if (fieldsLocked || active) return;
                        setKcalMode(opt.key);
                        trackChange('kcalMode', kcalMode, opt.key);
                      }}
                      style={[s.segmentItem, active && s.segmentItemActive]}
                    >
                      <Text style={[s.segmentText, active && s.segmentTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Lịch ăn */}
            <View style={s.card}>
              <SectionHeader
                icon={<Calendar size={18} color="#1D4ED8" strokeWidth={2.2} />}
                tint="#E8F0FF"
                title="Lịch ăn"
                subtitle="Chọn các bữa NOAN sẽ lên món"
                right={
                  <View style={s.pill}>
                    <Text style={s.pillText}>{totalMeals} bữa</Text>
                  </View>
                }
              />

              <Pressable
                onPress={() => !fieldsLocked && setScheduleSheetOpen(true)}
                style={s.scheduleRow}
              >
                <View style={s.scheduleIcon}>
                  <Calendar size={18} color="#B45309" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.scheduleTitle}>{days} ngày</Text>
                  <Text style={s.scheduleSub}>
                    {formatShort(schedule.startDate)} –{' '}
                    {formatShort(addDaysISO(schedule.startDate, days - 1))}
                  </Text>
                </View>
                <ChevronRight size={18} color={MUTED} strokeWidth={2.2} />
              </Pressable>

              <View style={s.chipsRow}>
                {(
                  [
                    { key: 'sang' as const, label: 'Sáng' },
                    { key: 'trua' as const, label: 'Trưa' },
                    { key: 'toi' as const, label: 'Tối' },
                    { key: 'phu' as const, label: 'Bữa phụ' },
                  ] as const
                ).map((item) => {
                  const on = mealSlotsFlags[item.key];
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => !fieldsLocked && toggleSlot(item.key)}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <View style={[s.chipCheck, on && s.chipCheckOn]}>
                        {on && <Check size={11} color={INK} strokeWidth={3} />}
                      </View>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Tùy chọn tạo món */}
            <Pressable
              onPress={() => !fieldsLocked && setAdvancedSheetOpen(true)}
              style={s.advancedCard}
            >
              <View style={s.advancedIcon}>
                <SlidersHorizontal size={18} color={MUTED} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.advancedTitle}>Tùy chọn tạo món</Text>
                <Text style={s.advancedSub} numberOfLines={1}>
                  {advancedSummary || 'Chưa cấu hình'}
                </Text>
              </View>
              <ChevronRight size={18} color={MUTED} strokeWidth={2} />
            </Pressable>

            <View style={s.infoBanner}>
              <Info size={16} color="#B45309" strokeWidth={2.2} />
              <Text style={s.infoText}>NOAN phân bổ ngân sách và kcal theo từng loại bữa.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={handleSaveDefault}
          disabled={savingConfig || generating}
          style={s.saveBtn}
          accessibilityLabel="Lưu làm mặc định"
        >
          {savingConfig ? (
            <ActivityIndicator size="small" color={INK} />
          ) : (
            <Text style={s.saveBtnText}>Lưu mặc định</Text>
          )}
        </Pressable>

        <Button
          onPress={() => {
            if (timedOut) {
              // Kiểm tra lại với cùng requestId trước khi tạo request mới
              runGenerate();
              return;
            }
            requestIdRef.current = null;
            runGenerate();
          }}
          disabled={ctaDisabled && !timedOut}
          className="h-[52px] flex-1 rounded-2xl bg-primary active:opacity-90"
        >
          {generating ? (
            <View style={s.ctaLoading}>
              <ActivityIndicator size="small" color={INK} />
              <Text style={s.ctaText}>Đang tạo thực đơn…</Text>
            </View>
          ) : timedOut ? (
            <Text style={s.ctaText}>Kiểm tra lại</Text>
          ) : (
            <Text style={s.ctaText}>Tạo thực đơn</Text>
          )}
        </Button>
      </View>

      <MealScheduleSheet
        visible={scheduleSheetOpen}
        value={schedule}
        onApply={(draft) => {
          trackChange('schedule', schedule, draft);
          setSchedule(draft);
        }}
        onDismiss={() => setScheduleSheetOpen(false)}
      />

      <AdvancedOptionsScreen
        visible={advancedSheetOpen}
        options={advancedOptions}
        onSave={(opts) => {
          trackChange('advanced', advancedOptions, opts);
          setAdvancedOptions(opts);
        }}
        onDismiss={() => setAdvancedSheetOpen(false)}
      />

      <WeeklyPlanFailureSheet
        visible={failureSheetOpen}
        errorData={failureErrorData}
        onAdjustConfig={handleAdjustFromFailure}
        onViewApprovedDishes={onViewDishes}
        onDismiss={() => setFailureSheetOpen(false)}
      />

      <WeeklyPlanSuccessSheet
        visible={successSheetOpen}
        data={successData}
        onViewPlan={(planId) => {
          setSuccessSheetOpen(false);
          trackWeeklyPlanEvent({ name: 'weekly_plan_opened', payload: { planId } });
          if (onOpenWeeklyPlan) onOpenWeeklyPlan(planId);
          else onBack();
        }}
        onGoHome={() => {
          setSuccessSheetOpen(false);
          if (onGoHome) onGoHome();
          else onBack();
        }}
        onDismiss={() => setSuccessSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  tint,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={[s.sectionIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        {subtitle ? (
          <Text style={s.sectionSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CREAM,
  },
  backHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  resetText: { fontSize: 15, fontWeight: '700', color: YELLOW },
  toast: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toastText: { fontSize: 12.5, fontWeight: '600', color: '#166534' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  hero: {
    backgroundColor: '#FFF4D0',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FBE3A0',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', color: '#A16207', letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: INK, marginTop: 6, letterSpacing: -0.5 },
  heroTitleMuted: { fontSize: 18, fontWeight: '700', color: '#6B5E45' },
  heroSub: { fontSize: 13, color: '#8A7653', marginTop: 2, fontWeight: '600' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroChipText: { fontSize: 12.5, fontWeight: '700', color: '#3F3B35' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  pill: {
    backgroundColor: '#F5F2EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: '#3F3B35' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE6',
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: CARD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  segmentTextActive: { color: INK, fontWeight: '800' },
  modeDesc: { fontSize: 12.5, color: MUTED, lineHeight: 18 },
  estimateText: { fontSize: 12.5, color: '#3F3B35', fontWeight: '600' },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFF7E0',
    borderColor: '#F5DC95',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  warnText: { fontSize: 12.5, color: '#92400E', lineHeight: 18 },
  warnActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warnBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F5DC95',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  warnBtnText: { fontSize: 12.5, fontWeight: '700', color: '#92400E' },
  saveBtn: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: INK },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  summaryText: { fontSize: 12.5, fontWeight: '600', color: '#3F3B35' },
  summaryDivider: { width: 1, height: 14, backgroundColor: '#D9D3C8' },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: INK },
  kcalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E5E0D6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnPressed: {
    backgroundColor: '#F5F2EB',
  },
  circleBtnDisabled: {
    borderColor: '#EEEAE3',
    backgroundColor: '#FAF8F5',
  },
  kcalValue: {
    fontSize: 26,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  kcalUnit: { fontSize: 15, fontWeight: '600', color: MUTED },
  kcalInputWrap: { flexDirection: 'row', alignItems: 'baseline' },
  kcalInput: {
    fontSize: 26,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  tabsRow: { flexDirection: 'row', gap: 10 },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  tabText: { fontSize: 14, fontWeight: '600', color: MUTED },
  tabTextActive: { color: INK, fontWeight: '800' },
  helperCenter: { textAlign: 'center', fontSize: 13, color: MUTED },
  dropdownRow: { flexDirection: 'row', gap: 10 },
  dropdown: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { fontSize: 14, fontWeight: '600', color: INK },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  chipOn: { backgroundColor: '#FFF8DC', borderColor: YELLOW },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D4CEBF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  chipCheckOn: { borderColor: YELLOW, backgroundColor: YELLOW },
  chipText: { fontSize: 12.5, fontWeight: '600', color: MUTED },
  chipTextOn: { color: INK, fontWeight: '700' },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTitle: { fontSize: 15, fontWeight: '700', color: INK },
  scheduleSub: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  mealCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  mealCountText: { fontSize: 13, color: MUTED, fontWeight: '500' },
  advancedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  advancedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedTitle: { fontSize: 15, fontWeight: '700', color: INK },
  advancedSub: { fontSize: 12.5, color: MUTED, marginTop: 2 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8DC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CREAM,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDE8DE',
  },
  saveLinkHit: { alignItems: 'center', paddingVertical: 4 },
  saveLink: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
    textDecorationLine: 'underline',
  },
  ctaLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '800', color: INK },
});
