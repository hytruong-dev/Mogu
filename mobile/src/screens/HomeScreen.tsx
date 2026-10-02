import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Coins,
  Flame,
  Pencil,
  Sparkles,
  Sun,
  Utensils,
} from '@/components/icons';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { NoanWordmark } from '../components/brand/NoanWordmark';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { getTodayISO, getDeviceTimeZone } from '../lib/dates';
import { computeWeeklyForecast } from '../lib/weekly-forecast';
import { formatWeeklyPlanGenerationError } from '../lib/api-error';
import { homeApi } from '../services/api/home';
import { useProfileDashboard } from '../hooks/useProfileDashboard';
import type { WeatherData, WeeklyPlan, WeeklyPlanSlot } from '../services/api/types';
import { getCurrentWeeklyPlan } from '../services/api/weekly-plan';
import { notificationRealtime } from '../services/notification-realtime';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG = '#F7F2E8';
const INK = '#16130C';
const MUTED = '#8C8472';
const LINE = '#EFE6D2';
const YELLOW = '#FFC51A';
const GOLD = '#B98300';

/** Soft shadow on iOS; hairline border on Android (avoids dark elevation halos). */
const softCard = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: LINE,
  ...(Platform.OS === 'ios'
    ? { shadowColor: '#8A6D2B', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }
    : { elevation: 0 }),
};

const SLOT_LABEL: Record<string, string> = {
  MORNING: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Bữa phụ',
};
const SLOT_ORDER: Record<string, number> = { MORNING: 0, LUNCH: 1, SNACK: 2, DINNER: 3 };

type Props = {
  onRandom: () => void;
  onExplore: () => void;
  onHealth: () => void;
  onProfile: () => void;
  onNotification: () => void;
  onWeeklyPlan?: () => void;
  onEditPlan?: () => void;
};

export function HomeScreen({ onRandom, onExplore, onHealth, onProfile, onNotification, onWeeklyPlan, onEditPlan }: Props) {
  const { dash } = useProfileDashboard();
  const avatarUri = dash?.profile.avatar.url;

  const timezone = getDeviceTimeZone();
  const today = getTodayISO(timezone);

  const {
    data: dashboard = null,
    isLoading,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['home', 'dashboard', today, timezone],
    queryFn: () => homeApi.getDashboard({ localDate: today, timezone }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const {
    data: plan = null,
    isLoading: planLoading,
    refetch: refetchPlan,
  } = useQuery({
    queryKey: ['home', 'weekly-plan-current'],
    queryFn: () => getCurrentWeeklyPlan(),
    staleTime: 15_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refetchDashboard();
      void refetchPlan();
    }, [refetchDashboard, refetchPlan]),
  );

  const loading = isLoading && !dashboard;
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const w = await homeApi.getWeather(loc.coords.latitude, loc.coords.longitude);
        if (!cancelled) setWeather(w);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), refetchPlan(), notificationRealtime.refreshUnreadCount()]);
    setRefreshing(false);
  }, [refetchDashboard, refetchPlan]);

  const [realtimeUnreadCount, setRealtimeUnreadCount] = useState<number | null>(null);
  useEffect(() => notificationRealtime.subscribeToUnreadCount(setRealtimeUnreadCount), []);

  const unreadCount = realtimeUnreadCount ?? dashboard?.unreadCount ?? 0;
  const greeting = dashboard?.greeting?.full ?? null;
  const openPlan = onWeeklyPlan ?? (() => {});
  const editPlan = onEditPlan ?? (() => {});

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} colors={[YELLOW]} />
        }
      >
        <HomeHeader
          unreadCount={unreadCount}
          onNotification={onNotification}
          onProfile={onProfile}
          avatarUri={avatarUri ?? null}
          gender={dash?.profile?.gender}
          seed={dash?.profile?.username ?? dash?.profile?.displayName}
        />

        <GreetingRow greeting={greeting} loading={loading} weather={weather} />

        <Animated.View entering={FadeInDown.duration(380).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}>
          <RandomHero onPress={onRandom} />
        </Animated.View>

        {planLoading && !plan ? (
          <PlanSkeleton />
        ) : (
          <Animated.View entering={FadeInDown.delay(120).duration(380).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}>
            <PlanSection plan={plan} onOpenPlan={openPlan} onEdit={editPlan} />
          </Animated.View>
        )}
      </ScrollView>
      <LiquidGlassBottomNav
        active="home"
        onRandom={onRandom}
        onExplore={onExplore}
        onHealth={onHealth}
        onProfile={onProfile}
      />
    </SafeAreaView>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function usePulse() {
  const v = useSharedValue(0.55);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}

function Bone({ w, h, r = 8, style }: { w: number | `${number}%`; h: number; r?: number; style?: object }) {
  const pulse = usePulse();
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#EFE5CF' }, pulse, style]} />;
}

function PlanSkeleton() {
  return (
    <View style={s.section}>
      <Bone w={130} h={20} style={{ marginBottom: 12 }} />
      <View style={[s.card, { padding: 16, gap: 14 }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1 }}>
              <Bone w="100%" h={150} r={18} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Bone w="48%" h={64} r={14} />
          <Bone w="48%" h={64} r={14} />
        </View>
        <Bone w="100%" h={46} r={23} />
      </View>
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function HomeHeader({
  unreadCount, onNotification, onProfile, avatarUri, gender, seed,
}: {
  unreadCount: number;
  onNotification: () => void;
  onProfile: () => void;
  avatarUri: string | null;
  gender?: string | null;
  seed?: string | number | null;
}) {
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <View style={s.header}>
      <NoanWordmark width={108} height={40} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          style={s.bellBtn}
          onPress={onNotification}
          hitSlop={6}
        >
          <Bell size={22} color={INK} strokeWidth={2} />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badgeText}</Text>
            </View>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={onProfile} hitSlop={6}>
          <AvatarImage
            uri={avatarUri}
            size={44}
            gender={gender}
            seed={seed}
            isCurrentUser
            style={{ borderWidth: 2, borderColor: '#fff' }}
          />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
const WEATHER_ICON_MAP: Record<string, React.ElementType> = {
  sunny: Sun, cloudy: Cloud, rainy: CloudRain, stormy: CloudLightning, foggy: CloudFog,
};
const WEATHER_ICON_COLOR: Record<string, string> = {
  sunny: YELLOW, cloudy: '#9BABB8', rainy: '#7BA9EA', stormy: '#7B6FDC', foggy: '#AABBC8',
};

function GreetingRow({ greeting, loading, weather }: { greeting: string | null; loading: boolean; weather: WeatherData | null }) {
  const WeatherIcon = weather ? (WEATHER_ICON_MAP[weather.iconCode] ?? Sun) : null;
  const iconColor = weather ? (WEATHER_ICON_COLOR[weather.iconCode] ?? YELLOW) : YELLOW;
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
      {loading ? (
        <View style={{ gap: 8 }}>
          <Bone w={230} h={28} />
          <Bone w={160} h={16} />
        </View>
      ) : (
        <Animated.View entering={FadeInDown.duration(320).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}>
          <Text style={s.greeting} numberOfLines={2}>{greeting ?? 'Chào bạn!'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Text style={s.subGreeting}>Hôm nay bạn muốn ăn gì?</Text>
            {weather && WeatherIcon ? (
              <View style={s.weatherChip}>
                <WeatherIcon size={14} color={iconColor} strokeWidth={2} />
                <Text style={s.weatherText}>{weather.tempC}° · {weather.description}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function RandomHero({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Để NOAN chọn món cho bạn" style={s.heroWrap}>
      <LinearGradient colors={['#FFDA55', '#FFC82A', '#FFB61A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={[s.heroBlob, { width: 180, height: 180, right: -40, top: -50 }]} />
        <View style={[s.heroBlob, { width: 90, height: 90, right: 120, bottom: -40 }]} />
        <View style={s.heroText}>
          <View style={s.heroTag}>
            <Sparkles size={12} color={GOLD} fill={GOLD} />
            <Text style={s.heroTagText}>Gợi ý thông minh</Text>
          </View>
          <Text style={s.heroTitle}>Để NOAN chọn{'\n'}món cho bạn</Text>
          <Text style={s.heroSub}>Hợp mục tiêu, tâm trạng{'\n'}và ngân sách hôm nay.</Text>
          <View style={s.heroBtn}>
            <Sparkles size={16} color={YELLOW} fill={YELLOW} />
            <Text style={s.heroBtnText}>Chọn món ngay</Text>
          </View>
        </View>
        <Image
          source={require('../assets/images/noan/noan-serving-v1.png')}
          resizeMode="contain"
          style={s.heroImg}
        />
      </LinearGradient>
    </Pressable>
  );
}

// ─── Plan section ─────────────────────────────────────────────────────────────
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={s.sectionAction}>{action}</Text>
          <ChevronRight size={16} color={GOLD} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PlanSection({ plan, onOpenPlan, onEdit }: { plan: WeeklyPlan | null; onOpenPlan: () => void; onEdit: () => void }) {
  const todayIso = getTodayISO();

  if (plan?.status === 'FAILED') {
    return (
      <View style={s.section}>
        <SectionTitle title="Kế hoạch tuần" />
        <View style={[s.card, s.emptyCard]}>
          <Image source={require('../assets/images/noan/noan-thinking-v1.png')} style={s.emptyImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={[s.emptyTitle, { color: '#B91C1C' }]}>Tạo kế hoạch thất bại</Text>
            <Text style={s.emptySub}>{formatWeeklyPlanGenerationError(plan.generationErrorCode)}</Text>
            <Pressable onPress={onOpenPlan} style={s.primaryBtnSm}>
              <Text style={s.primaryBtnSmText}>Chỉnh & tạo lại</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const isPlanExpired = !!plan && (
    plan.status === 'COMPLETED' || plan.status === 'ARCHIVED' ||
    (!!plan.endDate && todayIso >= plan.endDate.split('T')[0]) ||
    (Array.isArray(plan.days) && plan.days.length > 0 && plan.days.every((d) => d.date.split('T')[0] < todayIso))
  );
  const hasPlan = !!plan && plan.status !== 'GENERATING' && !isPlanExpired;

  if (!hasPlan) {
    const generating = plan?.status === 'GENERATING';
    return (
      <View style={s.section}>
        <SectionTitle title="Kế hoạch tuần" />
        <View style={[s.card, s.emptyCard]}>
          <Image source={require('../assets/images/noan/noan-thinking-v1.png')} style={s.emptyImg} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.emptyTitle}>
              {generating ? 'NOAN đang lên thực đơn…' : isPlanExpired ? 'Tuần mới, thực đơn mới!' : 'Chưa có thực đơn tuần'}
            </Text>
            <Text style={s.emptySub}>
              {generating
                ? 'Chờ chút nhé, thực đơn sẽ sẵn sàng ngay.'
                : isPlanExpired
                  ? 'Kế hoạch tuần trước đã xong. Lên kế hoạch cho tuần này nhé.'
                  : 'Để NOAN gợi ý 7 ngày ăn ngon, đúng ngân sách.'}
            </Text>
            <Pressable onPress={generating ? onOpenPlan : onEdit} style={s.primaryBtnSm}>
              <Text style={s.primaryBtnSmText}>{generating ? 'Xem tiến trình' : 'Lên kế hoạch ngay'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const p = plan!;
  const budget = p.budgetLimitVnd || 500000;
  const { forecastSpent: spent, forecastKcal: kcal } = computeWeeklyForecast(p);
  const kcalTarget = p.targetKcal || 14000;
  const budgetPct = Math.min(spent / budget, 1);
  const kcalPct = Math.min(kcal / kcalTarget, 1);

  const start = p.startDate.split('T')[0];
  const end = p.endDate.split('T')[0];
  const [, sm, sd] = start.split('-');
  const [, em, ed] = end.split('-');
  const rangeLabel = `${Number(sd)}/${Number(sm)} – ${Number(ed)}/${Number(em)}`;

  const todayDay = p.days?.find((d) => d.date.split('T')[0] === todayIso);
  const todaySlots = [...(todayDay?.slots ?? [])].sort(
    (a, b) => (SLOT_ORDER[a.mealSlot] ?? 9) - (SLOT_ORDER[b.mealSlot] ?? 9),
  );
  const doneCount = todaySlots.filter((sl) => sl.status === 'COMPLETED').length;

  const statusLabel =
    p.status === 'READY' ? 'Sẵn sàng' :
    p.status === 'ACTIVE' ? 'Đang áp dụng' : 'Kế hoạch';

  return (
    <>
      {todaySlots.length > 0 && (
        <View style={s.section}>
          <SectionTitle title="Bữa ăn hôm nay" action={`${doneCount}/${todaySlots.length} đã ăn`} onAction={onOpenPlan} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {todaySlots.map((slot) => (
              <TodayMealCard key={slot.id} slot={slot} onPress={onOpenPlan} />
            ))}
          </View>
        </View>
      )}

      <View style={s.section}>
        <SectionTitle title="Kế hoạch tuần" action="Xem chi tiết" onAction={onOpenPlan} />
        <Pressable onPress={onOpenPlan} style={[s.card, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.planIcon}>
              <CalendarDays size={22} color={GOLD} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.planRange}>{rangeLabel}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <View style={s.statusDot} />
                <Text style={s.planMeta}>{statusLabel} · {p.days?.length ?? 7} ngày</Text>
              </View>
            </View>
            <Pressable onPress={onEdit} hitSlop={10} style={s.editBtn} accessibilityLabel="Chỉnh kế hoạch">
              <Pencil size={15} color="#6B6352" strokeWidth={2} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <StatTile
              Icon={Coins}
              color={GOLD}
              bg="#FFF7DB"
              label="Ngân sách"
              value={`${Math.round(spent / 1000)}K`}
              total={`/ ${Math.round(budget / 1000)}K`}
              pct={budgetPct}
              barColor={YELLOW}
            />
            <StatTile
              Icon={Flame}
              color="#E0572B"
              bg="#FFF0E8"
              label="Năng lượng"
              value={kcal.toLocaleString('vi-VN')}
              total={`/ ${kcalTarget.toLocaleString('vi-VN')}`}
              pct={kcalPct}
              barColor="#FF7A45"
            />
          </View>

          <View style={s.openBtn}>
            <Text style={s.openBtnText}>Mở thực đơn</Text>
            <ChevronRight size={17} color={INK} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

function TodayMealCard({ slot, onPress }: { slot: WeeklyPlanSlot; onPress: () => void }) {
  const done = slot.status === 'COMPLETED';
  const skipped = slot.status === 'SKIPPED';
  return (
    <Pressable
      onPress={onPress}
      style={[s.mealCard, skipped && { opacity: 0.5 }]}
      accessibilityRole="button"
      accessibilityLabel={`${SLOT_LABEL[slot.mealSlot] ?? 'Bữa ăn'}, ${slot.dish?.name ?? ''}`}
    >
      {slot.dish?.imageUrl ? (
        <Image source={{ uri: slot.dish.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Utensils size={28} color="#D9C79A" />
        </View>
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.78)']}
        locations={[0.35, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.mealTop}>
        <View style={s.mealSlotTag}>
          <Text style={s.mealSlotTagText}>{SLOT_LABEL[slot.mealSlot] ?? 'Bữa ăn'}</Text>
        </View>
        {done && (
          <View style={s.mealDone}>
            <Check size={11} color="#fff" strokeWidth={3.5} />
          </View>
        )}
      </View>
      <View style={s.mealBottom}>
        <Text style={s.mealName} numberOfLines={2}>{slot.dish?.name ?? 'Chưa có món'}</Text>
        <Text style={s.mealMeta} numberOfLines={1}>
          {Math.round((slot.dish?.priceVnd ?? 0) / 1000)}K · {slot.dish?.kcal ?? 0} kcal
        </Text>
      </View>
    </Pressable>
  );
}

function StatTile({ Icon, color, bg, label, value, total, pct, barColor }: {
  Icon: React.ElementType; color: string; bg: string; label: string;
  value: string; total: string; pct: number; barColor: string;
}) {
  return (
    <View style={[s.statTile, { backgroundColor: bg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={color} strokeWidth={2.2} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
      <Text style={s.statValue} numberOfLines={1}>
        {value}<Text style={s.statTotal}> {total}</Text>
      </Text>
      <View style={s.statTrack}>
        <View style={[s.statFill, { width: `${Math.max(pct * 100, 3)}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 62,
  },
  bellBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LINE,
  },
  badge: {
    position: 'absolute', right: 6, top: 6, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF5A42', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  greeting: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5, lineHeight: 32 },
  subGreeting: { fontSize: 15, color: MUTED, lineHeight: 21 },
  weatherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE,
  },
  weatherText: { fontSize: 12, color: '#4A4435', fontWeight: '600' },

  heroWrap: { marginHorizontal: 20, marginTop: 18, borderRadius: 26 },
  hero: { borderRadius: 26, overflow: 'hidden', height: 196 },
  heroBlob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroText: { position: 'absolute', left: 20, top: 18, bottom: 18, width: '58%', justifyContent: 'space-between' },
  heroTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  heroTagText: { fontSize: 11, fontWeight: '700', color: GOLD },
  heroTitle: { fontSize: 22, fontWeight: '800', color: INK, lineHeight: 27, letterSpacing: -0.4 },
  heroSub: { fontSize: 12, color: '#6B5A1E', lineHeight: 17 },
  heroBtn: {
    alignSelf: 'flex-start', height: 42, borderRadius: 21, backgroundColor: INK, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  heroBtnText: { color: YELLOW, fontSize: 14.5, fontWeight: '800' },
  heroImg: { position: 'absolute', right: -8, bottom: -6, width: 170, height: 184 },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  sectionAction: { fontSize: 13.5, fontWeight: '700', color: GOLD },

  card: { ...softCard, borderRadius: 22 },

  emptyCard: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  emptyImg: { width: 92, height: 100 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: INK },
  emptySub: { fontSize: 13, color: MUTED, lineHeight: 19, marginTop: 4 },
  primaryBtnSm: {
    alignSelf: 'flex-start', marginTop: 12, height: 40, borderRadius: 20, paddingHorizontal: 18,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnSmText: { fontSize: 14, fontWeight: '800', color: INK },

  mealCard: {
    flex: 1, height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F6EEDB',
  },
  mealTop: {
    position: 'absolute', left: 7, right: 7, top: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  mealSlotTag: {
    backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  mealSlotTagText: { fontSize: 10.5, fontWeight: '800', color: '#4A4435' },
  mealDone: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#22A45D',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff',
  },
  mealBottom: { position: 'absolute', left: 9, right: 9, bottom: 9, gap: 2 },
  mealName: { fontSize: 13, fontWeight: '800', color: '#fff', lineHeight: 16 },
  mealMeta: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  planIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFF4CC', alignItems: 'center', justifyContent: 'center' },
  planRange: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  planMeta: { fontSize: 13, color: MUTED, fontWeight: '500' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22A45D' },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F0E4', alignItems: 'center', justifyContent: 'center' },

  statTile: { flex: 1, borderRadius: 16, padding: 12, gap: 6 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#6B6352' },
  statValue: { fontSize: 17, fontWeight: '800', color: INK },
  statTotal: { fontSize: 12, fontWeight: '600', color: MUTED },
  statTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' },
  statFill: { height: 6, borderRadius: 3 },

  openBtn: {
    marginTop: 14, height: 48, borderRadius: 24, backgroundColor: YELLOW,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  openBtnText: { fontSize: 15, fontWeight: '800', color: INK },
});
