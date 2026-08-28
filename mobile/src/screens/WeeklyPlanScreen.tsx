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
import {
  getCurrentWeeklyPlan,
  startWeeklyPlan,
  regenerateWeeklyPlan,
  swapSlot,
  generateWeeklyPlan,
  getWeeklyPlanConfig,
  type SwapSlotResult,
} from '../services/api/weekly-plan';
import type { WeeklyPlan, WeeklyPlanDay, WeeklyPlanStatus } from '../services/api/types';

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

const VN_SHORTS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VN_FULLS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const parseDayPlan = (day: WeeklyPlanDay): DayPlan => {
  const d = new Date(day.date + 'T00:00:00');
  const dow = d.getDay();
  const meals: Meal[] = day.slots.map(sl => ({
    slotId: sl.id,
    slot: SLOT_LABELS[sl.mealSlot] ?? sl.mealSlot,
    slotIcon: SLOT_ICONS[sl.mealSlot] ?? '🍽️',
    dishName: sl.dish.name,
    imageUrl: sl.dish.imageUrl,
    price: Math.round(sl.dish.priceVnd / 1000),
    kcal: sl.dish.kcal,
    version: sl.version,
    status: sl.status,
    isLocked: sl.isLocked,
  }));
  return {
    weekdayShort: VN_SHORTS[dow],
    weekdayFull: VN_FULLS[dow],
    date: d.getDate(),
    month: d.getMonth() + 1,
    isoDate: day.date,
    meals,
    estimatedCost: meals.reduce((s, m) => s + m.price, 0),
    estimatedKcal: meals.reduce((s, m) => s + m.kcal, 0),
  };
}

// ── Week skeleton — chỉ tạo khung ngày, KHÔNG có meals (dùng khi chưa có plan) ──
const buildWeekSkeleton = (): DayPlan[] => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const shorts = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fulls = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      weekdayShort: shorts[i], weekdayFull: fulls[i],
      date: d.getDate(), month: d.getMonth() + 1,
      isoDate: d.toISOString().split('T')[0],
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
};

export function WeeklyPlanScreen({ onBack, onEditPlan, onMore }: Props) {
  const today = new Date();
  const todayDate = today.getDate();

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 'start'|'regen'|slotId
  const [selectedIdx, setSelectedIdx] = useState(0);

  // ── Fetch plan ───────────────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      console.log('[WeeklyPlan] Fetching plan from API...');
      const p = await getCurrentWeeklyPlan();
      console.log('[WeeklyPlan] Plan result:', p ? `status=${p.status}, days=${p.days?.length ?? 0}` : 'null');
      setPlan(p);
      // Auto-select today
      if (p && Array.isArray(p.days) && p.days.length > 0) {
        const todayISO = today.toISOString().split('T')[0];
        const idx = p.days.findIndex(d => d.date === todayISO);
        if (idx >= 0) setSelectedIdx(idx);
      }
    } catch (err: any) {
      console.log('[WeeklyPlan] API error:', err?.message ?? err);
      // fallback to mock
    } finally {
      setLoading(false);
    }
  }, []);

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
  const isToday = selectedDay?.date === todayDate;

  // ── Stats ────────────────────────────────────────────────────────────────────
  const planStatus: WeeklyPlanStatus | null = plan?.status ?? null;
  const budget = plan?.budgetLimitVnd ?? 500000;
  const spent = plan?.actualSpentVnd ?? 0;
  const projected = plan?.projectedCostVnd ?? 0;
  const calTotal = plan?.targetKcal ?? 14000;
  const calConsumed = plan?.actualKcal ?? 0;
  const calProjected = plan?.projectedKcal ?? 0;
  const budgetPct = Math.min((Math.max(spent, projected) / budget) * 100, 100);
  const calPct = Math.min(((calConsumed || calProjected) / calTotal) * 100, 100);
  const budgetLeft = Math.round((budget - Math.max(spent, projected)) / 1000);

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
      await startWeeklyPlan(plan.id, plan.version);
      await fetchPlan(true);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? 'Không thể bắt đầu kế hoạch.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async () => {
    if (!plan) {
      // No plan yet → generate new one
      setActionLoading('regen');
      try {
        const iso = today.toISOString().split('T')[0];
        console.log('[WeeklyPlan] Generating plan, startDate=', iso);
        await generateWeeklyPlan(iso);
        console.log('[WeeklyPlan] Generate called, waiting 3s then refresh...');
        Alert.alert('Đang tạo', 'Kế hoạch đang được tạo, vui lòng kéo xuống để làm mới sau vài giây.');
        setTimeout(() => fetchPlan(true), 3000);
      } catch (e: any) {
        Alert.alert('Lỗi', e?.message ?? 'Không thể tạo kế hoạch.');
      } finally {
        setActionLoading(null);
      }
      return;
    }
    Alert.alert(
      'Tạo lại thực đơn',
      'Kế hoạch hiện tại sẽ bị lưu trữ và tạo mới. Tiếp tục?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tạo lại',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('regen');
            try {
              await regenerateWeeklyPlan(plan.id);
              Alert.alert('Đang tạo', 'Kế hoạch mới đang được tạo, kéo xuống để làm mới.');
              setTimeout(() => fetchPlan(true), 3000);
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message ?? 'Không thể tạo lại.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
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
      setPlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map(day => ({
            ...day,
            slots: day.slots.map(sl => {
              if (sl.id !== meal.slotId) return sl;
              // Merge slot mới từ response API
              return {
                ...sl,
                id: result.id ?? sl.id,
                version: result.version ?? sl.version + 1,
                swapCount: result.swapCount ?? (sl.swapCount ?? 0) + 1,
                dish: {
                  ...sl.dish,
                  id: result.dishId ?? sl.dish.id,
                  name: result.dishNameSnapshot ?? sl.dish.name,
                  imageUrl: result.imageUrlSnapshot ?? sl.dish.imageUrl,
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
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? 'Không thể đổi món.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={YELLOW} />
        <Text style={{ color: MUTED, marginTop: 12 }}>Đang tải kế hoạch...</Text>
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
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={YELLOW} colors={[YELLOW]} />
        }
      >
        {/* ── Summary card ─────────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <Image
            source={require('../assets/images/home/mogu-budget.png')}
            resizeMode="contain"
            style={s.summaryMascot}
          />
          <View style={s.summaryInfo}>
            <View style={s.summaryTitleRow}>
              <Sparkles size={14} color="#F0A500" fill="#F0A500" />
              <Text style={s.summaryTitle}>
                {planStatus ? (STATUS_LABEL[planStatus] ?? 'Kế hoạch của bạn') : 'Chưa có kế hoạch'}
              </Text>
            </View>
            <Text style={s.summarySubtitle}>
              {plan
                ? `${durationDays} ngày · ${totalSlots} bữa · ${mealsPerDay} bữa/ngày`
                : 'Nhấn "Tạo thực đơn" để bắt đầu'}
            </Text>

            {/* Chi tiêu */}
            <View style={s.statRow}>
              <Text style={{ fontSize: 14 }}>❤️</Text>
              <Text style={s.statLabel}>Chi tiêu</Text>
              <Text style={s.statValue}>
                {Math.round(Math.max(spent, projected) / 1000)}K / {Math.round(budget / 1000)}K
              </Text>
              <View style={[s.badge, { backgroundColor: budgetLeft >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[s.badgeText, { color: budgetLeft >= 0 ? '#15803D' : '#B91C1C' }]}>
                  {budgetLeft >= 0 ? `Còn ${budgetLeft}K` : `Vượt ${-budgetLeft}K`}
                </Text>
              </View>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${budgetPct}%` as any, backgroundColor: YELLOW }]} />
            </View>

            {/* Năng lượng */}
            <View style={[s.statRow, { marginTop: 7 }]}>
              <Text style={{ fontSize: 14 }}>🔥</Text>
              <Text style={s.statLabel}>Năng lượng</Text>
              <Text style={s.statValue}>
                {(calConsumed || calProjected).toLocaleString('vi-VN')} / {calTotal.toLocaleString('vi-VN')} kcal
              </Text>
              <View style={[s.badge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[s.badgeText, { color: '#B91C1C' }]}>Đạt {Math.round(calPct)}%</Text>
              </View>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${calPct}%` as any, backgroundColor: '#FF6030' }]} />
            </View>

            <TouchableOpacity onPress={onEditPlan} activeOpacity={0.8} style={s.editPlanBtn}>
              <Text style={{ fontSize: 13 }}>✏️</Text>
              <Text style={s.editPlanText}>Chỉnh kế hoạch</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── GENERATING state notice ───────────────────────────────────────── */}
        {planStatus === 'GENERATING' && (
          <View style={s.generatingBanner}>
            <ActivityIndicator size="small" color={YELLOW} />
            <Text style={s.generatingText}>Mogu đang chọn món cho bạn... Kéo xuống để cập nhật.</Text>
          </View>
        )}

        {/* ── Calendar row — chỉ hiện khi có plan ─────────────────────────── */}
        {hasRealDays && (
          <View style={s.calendarRow}>
            {displayDays.map((day, idx) => {
              const isSelected = idx === safeIdx;
              const isTodayDay = day.date === todayDate;
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
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {hasRealDays ? (
            <>
              {selectedDay.meals.map((meal) => (
                <MealCard
                  key={meal.slotId}
                  meal={meal}
                  isReal={true}
                  swapping={actionLoading === meal.slotId}
                  onSwap={() => handleSwap(meal)}
                />
              ))}

              {/* Nguyên liệu — chỉ hiện khi có plan */}
              <Pressable style={s.ingredientsRow}>
                <View style={s.ingredientIcon}>
                  <Text style={{ fontSize: 22 }}>🥬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ingredientTitle}>Nguyên liệu hôm nay</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' }}>
                    <Text style={s.ingredientCount}>
                      {selectedDay.meals.length * 4} nguyên liệu
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
            onPress={handleRegenerate}
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
          onPress={handleRegenerate}
          disabled={!!actionLoading}
          className='group'
        >
          {actionLoading === 'regen'
            ? <ActivityIndicator size="small" color={MUTED} />
            : <Text style={s.recreateBtnText} className='group-hover:text-black duration-200'>{regenLabel}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── MealCard ──────────────────────────────────────────────────────────────────
function MealCard({
  meal, isReal, swapping, onSwap,
}: {
  meal: Meal;
  isReal: boolean;
  swapping: boolean;
  onSwap: () => void;
}) {
  const slotColor: Record<string, string> = {
    'Bữa sáng': '#FFFBEB', 'Bữa trưa': '#FFF7F0', 'Bữa tối': '#EEF4FF', 'Bữa phụ': '#F0FFF4',
  };
  const bg = slotColor[meal.slot] ?? '#F5F0E8';

  return (
    <View style={s.mealCard}>
      {/* Ảnh món ăn */}
      <View style={[s.mealImage, { backgroundColor: bg, overflow: 'hidden' }]}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 30 }}>{meal.slotIcon}</Text>
        )}
      </View>

      {/* Info */}
      <View style={s.mealInfo}>
        <View style={s.mealSlotRow}>
          <Text style={{ fontSize: 12 }}>{meal.slotIcon}</Text>
          <Text style={s.mealSlotText}>{meal.slot}</Text>
          {meal.isLocked && <Text style={{ fontSize: 11, color: '#C08000' }}>🔒</Text>}
        </View>
        <Text style={s.mealName} numberOfLines={1}>{meal.dishName}</Text>
        <Text style={s.mealMeta}>{meal.price}K · {meal.kcal} kcal</Text>
      </View>

      {/* Đổi món button — chỉ khi có plan thật */}
      <TouchableOpacity
        style={[s.changeBtn, (!isReal || meal.isLocked) && { opacity: 0.4 }]}
        activeOpacity={0.8}
        onPress={onSwap}
        disabled={!isReal || meal.isLocked || swapping}
      >
        {swapping
          ? <ActivityIndicator size="small" color="#555" />
          : <RefreshCw size={15} color="#555" strokeWidth={2} />
        }
        <Text style={s.changeBtnText}>Đổi món</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: CREAM,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  summaryCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, backgroundColor: WHITE,
    flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12, ...shadow,
  },
  summaryMascot: { width: 150, height: 170, flexShrink: 0 },
  summaryInfo: { flex: 1, gap: 2 },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  summaryTitle: { fontSize: 13, fontWeight: '800', color: INK, letterSpacing: -0.2, flexShrink: 1 },
  summarySubtitle: { fontSize: 11, color: MUTED, marginBottom: 7 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#444', flex: 1 },
  statValue: { fontSize: 10, color: '#555', fontWeight: '500' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: '#F0E9D0', overflow: 'hidden', marginTop: 3, marginBottom: 1 },
  progressFill: { height: '100%', borderRadius: 3 },

  editPlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E0D4',
    backgroundColor: WHITE, marginTop: 10,
  },
  editPlanText: { fontSize: 13, fontWeight: '600', color: INK },

  generatingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: '#FFFBE6', borderRadius: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  generatingText: { flex: 1, fontSize: 13, color: '#92400E' },

  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  calDay: { flex: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 8, marginHorizontal: 2 },
  calDaySelected: { backgroundColor: YELLOW },
  calDayLabel: { fontSize: 11, fontWeight: '600', color: MUTED },
  calDayLabelSelected: { color: INK },
  calDayDate: { fontSize: 18, fontWeight: '800', color: '#333', marginTop: 2 },
  calDayDateSelected: { color: INK },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: YELLOW, marginTop: 3 },

  dayHeader: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 },
  dayHeaderTitle: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  dayHeaderSub: { fontSize: 13, color: MUTED, marginTop: 2 },

  mealCard: {
    backgroundColor: WHITE, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', ...shadow,
    borderWidth: 1, borderColor: BORDER,
  },
  mealImage: { width: 88, height: 88, borderRadius: 0, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mealInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  mealSlotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  mealSlotText: { fontSize: 12, fontWeight: '600', color: '#C08000' },
  mealName: { fontSize: 15, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  mealMeta: { fontSize: 12, color: MUTED, marginTop: 3 },

  changeBtn: {
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    width: 62, height: 88, backgroundColor: '#FAFAF5',
    borderLeftWidth: 1, borderLeftColor: BORDER, gap: 4,
  },
  changeBtnText: { fontSize: 11, fontWeight: '600', color: '#555' },

  ingredientsRow: {
    backgroundColor: WHITE, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12, ...shadow,
    borderWidth: 1, borderColor: BORDER,
  },
  ingredientIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center' },
  ingredientTitle: { fontSize: 14, fontWeight: '600', color: INK },
  ingredientCount: { fontSize: 12, color: MUTED },
  ingredientLink: { fontSize: 12, color: '#F0A500', fontWeight: '600' },

  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 48, gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: CREAM,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: BORDER, gap: 6,
  },
  startBtn: { height: 52, borderRadius: 16, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { fontSize: 16, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  recreateBtn: { alignItems: 'center', paddingVertical: 4 },
  recreateBtnText: { fontSize: 14, color: MUTED },
});
