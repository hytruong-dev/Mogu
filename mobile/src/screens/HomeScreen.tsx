import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  Bell,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Edit3,
  Flame,
  Sparkles,
  Sun,
} from 'lucide-react-native';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { Progress } from '../components/ui/progress';
import { getTodayISO, getDeviceTimeZone } from '../lib/dates';
import { computeWeeklyForecast } from '../lib/weekly-forecast';
import { formatWeeklyPlanGenerationError } from '../lib/api-error';
import { homeApi } from '../services/api/home';
import { profileApi } from '../services/api/profile';
import { useProfileDashboard } from '../hooks/useProfileDashboard';
import type { HomeDashboard, WeatherData } from '../services/api/types';
import { getCurrentWeeklyPlan } from '../services/api/weekly-plan';
import type { WeeklyPlan } from '../services/api/types';

const cardShadow = {
  shadowColor: '#B19B66',
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

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
    staleTime: 1000 * 60 * 5,
  });

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
    await refetchDashboard();
    setRefreshing(false);
  }, [refetchDashboard]);

  const unreadCount = dashboard?.unreadCount ?? 0;
  const greeting = dashboard?.greeting?.full ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F2E8' }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFC51A" colors={['#FFC51A']} />
        }
      >
        <HomeHeader unreadCount={unreadCount} onNotification={onNotification}
          onProfile={onProfile} avatarUri={avatarUri ?? null} />
        <GreetingRow greeting={greeting} loading={loading} weather={weather} />
        <RandomHero onPress={onRandom} />
        <WeeklyPlanCard onEdit={onEditPlan ?? (() => {})} onOpenPlan={onWeeklyPlan ?? (() => {})} />
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

// HomeHeader
function HomeHeader({ unreadCount, onNotification, onProfile, avatarUri }: {
  unreadCount: number;
  onNotification: () => void;
  onProfile: () => void;
  avatarUri: string | null;
}) {
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 64 }}>
      <Text style={{ fontSize: 32, fontWeight: '900', color: '#111', letterSpacing: -1.5 }}>Mogu</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} onPress={onNotification}>
          <Bell size={26} color="#111" strokeWidth={2} />
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', right: 0, top: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#FF5A42', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badgeText}</Text>
            </View>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân"
          onPress={onProfile} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <AvatarImage uri={avatarUri} size={42} style={{ borderWidth: 2, borderColor: '#fff' }} />
        </Pressable>
      </View>
    </View>
  );
}

// GreetingRow
const WEATHER_ICON_MAP: Record<string, React.ElementType> = {
  sunny: Sun, cloudy: Cloud, rainy: CloudRain, stormy: CloudLightning, foggy: CloudFog,
};
const WEATHER_ICON_COLOR: Record<string, string> = {
  sunny: '#FFC51A', cloudy: '#9BABB8', rainy: '#7BA9EA', stormy: '#7B6FDC', foggy: '#AABBC8',
};

function GreetingRow({ greeting, loading, weather }: { greeting: string | null; loading: boolean; weather: WeatherData | null }) {
  const WeatherIcon = weather ? (WEATHER_ICON_MAP[weather.iconCode] ?? Sun) : null;
  const iconColor = weather ? (WEATHER_ICON_COLOR[weather.iconCode] ?? '#FFC51A') : '#FFC51A';
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ height: 30, width: 200, borderRadius: 8, backgroundColor: '#EFE6D0' }} />
          ) : (
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#111', letterSpacing: -0.5, lineHeight: 32 }}>
              {greeting ?? 'Chào bạn!'}
            </Text>
          )}
          <Text style={{ marginTop: 4, fontSize: 15, color: '#777', lineHeight: 22 }}>
            Hôm nay bạn muốn ăn gì?
          </Text>
        </View>
        {weather && WeatherIcon && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EDE0C4', marginTop: 4 }}>
            <WeatherIcon size={16} color={iconColor} strokeWidth={1.8} />
            <Text style={{ fontSize: 12, color: '#333', fontWeight: '500' }}>
              {weather.tempC}° · {weather.description}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// RandomHero
function RandomHero({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ marginHorizontal: 20, marginTop: 16 }}>
      <LinearGradient
        colors={['#FFD43E', '#FFC82A', '#FFBC1A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, overflow: 'hidden', height: 190, ...cardShadow }}
      >
        <View style={{ position: 'absolute', width: 10, height: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2, right: 148, top: 28, transform: [{ rotate: '45deg' }] }} />
        <View style={{ position: 'absolute', width: 7, height: 7, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 1.5, right: 160, bottom: 52, transform: [{ rotate: '45deg' }] }} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '60%', paddingLeft: 22, paddingTop: 24, justifyContent: 'flex-start' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111', lineHeight: 29, letterSpacing: -0.3 }}>
            Để Mogu chọn{'\n'}món cho bạn
          </Text>
          <Text style={{ marginTop: 8, fontSize: 11, color: '#6B5A1E', lineHeight: 16 }}>
            Phù hợp với mục tiêu, tâm trạng{'\n'}và ngân sách hôm nay.
          </Text>
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{ marginTop: 14, width: 158, height: 42, borderRadius: 21, backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Sparkles size={18} color="#FFC51A" fill="#FFC51A" />
            <Text style={{ color: '#FFC51A', fontSize: 15, fontWeight: '700' }}>Random ngay</Text>
          </TouchableOpacity>
        </View>
        <Image
          source={require('../assets/images/home/mogu-serving.png')}
          resizeMode="contain"
          style={{ position: 'absolute', right: -10, bottom: -4, width: 178, height: 190 }}
        />
      </LinearGradient>
    </View>
  );
}

// WeeklyPlanCard
function WeeklyPlanCard({ onEdit, onOpenPlan }: { onEdit: () => void; onOpenPlan: () => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  useEffect(() => {
    getCurrentWeeklyPlan()
      .then((p) => setPlan(p))
      .catch(() => {});
  }, []);

  const hasPlan = plan && plan.status !== 'GENERATING' && plan.status !== 'FAILED';
  const budget = plan?.budgetLimitVnd ?? 500000;
  const { forecastSpent: spent, forecastKcal: calConsumed } = computeWeeklyForecast(plan ?? {});
  const calTotal = plan?.targetKcal ?? 14000;
  const budgetPercent = Math.min((spent / budget) * 100, 100);
  const calPercent = Math.min((calConsumed / calTotal) * 100, 100);
  const budgetLeft = Math.round((budget - spent) / 1000);
  const calPctRounded = Math.round(calPercent);
  const durationDays = plan
    ? Math.max(1, Math.round((new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / 86400000))
    : 7;
  const mealsPerDay = 3;
  const totalMeals = durationDays * mealsPerDay;

  if (plan?.status === 'FAILED') {
    return (
      <View style={{ marginHorizontal: 20, marginTop: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111', letterSpacing: -0.4 }}>Kế hoạch tuần</Text>
        </View>
        <View style={{ borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', ...cardShadow, padding: 16, alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#B91C1C' }}>Tạo kế hoạch thất bại</Text>
          <Text style={{ fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20 }}>
            {formatWeeklyPlanGenerationError(plan.generationErrorCode)}
          </Text>
          <TouchableOpacity
            onPress={onOpenPlan}
            style={{ height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#F0C040', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#C08000' }}>Chỉnh & tạo lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!hasPlan) {
    return (
      <View style={{ marginHorizontal: 20, marginTop: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111', letterSpacing: -0.4 }}>Kế hoạch tuần</Text>
        </View>
        <View style={{ borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', ...cardShadow, padding: 16, alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 14, color: '#999' }}>Chưa có kế hoạch. Nhấn để tạo thực đơn tuần!</Text>
          <TouchableOpacity
            onPress={onOpenPlan}
            style={{ height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#F0C040', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#C08000' }}>Tạo thực đơn</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginHorizontal: 20, marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111', letterSpacing: -0.4 }}>Kế hoạch tuần</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} onPress={onOpenPlan} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#D99E00' }}>Xem chi tiết</Text>
          <ChevronRight size={16} color="#D99E00" />
        </TouchableOpacity>
      </View>
      <View style={{ borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', ...cardShadow }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#111', letterSpacing: -0.3 }}>{durationDays} ngày trong {Math.round(budget / 1000)}K</Text>
              <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{totalMeals} bữa · {mealsPerDay} bữa/ngày</Text>
            </View>
            <TouchableOpacity onPress={onEdit} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
              <Edit3 size={15} color="#888" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#F3EDD8', marginHorizontal: 16 }} />
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 13 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 16 }}>❤️</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>Chi tiêu</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  {Math.round(spent / 1000)}K / {Math.round(budget / 1000)}K
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: budgetLeft >= 0 ? '#DCFCE7' : '#FEE2E2' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: budgetLeft >= 0 ? '#15803D' : '#B91C1C' }}>
                    {budgetLeft >= 0 ? 'Còn ' + budgetLeft + 'K' : 'Vượt ' + Math.abs(budgetLeft) + 'K'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ height: 7, borderRadius: 4, overflow: 'hidden' }}>
              <Progress value={budgetPercent} className="h-[7px] bg-[#F0E9D0]" indicatorClassName="bg-[#FFC01A]" />
            </View>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Flame size={17} color="#FF6030" fill="#FF6030" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>Năng lượng</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  {calConsumed.toLocaleString('vi-VN')} / {calTotal.toLocaleString('vi-VN')} kcal
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: '#FEF9C3' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#854D0E' }}>Đạt {calPctRounded}%</Text>
                </View>
              </View>
            </View>
            <View style={{ height: 7, borderRadius: 4, overflow: 'hidden' }}>
              <Progress value={calPercent} className="h-[7px] bg-[#F0E9D0]" indicatorClassName="bg-[#FF6030]" />
            </View>
          </View>
          <Text style={{ fontSize: 12, color: '#BBB', marginBottom: 4 }}>
            Trung bình {spent > 0 ? Math.round(spent / durationDays / 1000) : Math.round(budget / durationDays / 1000)}K · {calConsumed > 0 ? Math.round(calConsumed / durationDays).toLocaleString('vi-VN') : Math.round(calTotal / durationDays).toLocaleString('vi-VN')} kcal/ngày
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenPlan}
          style={{ marginHorizontal: 16, marginBottom: 14, height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: '#F0C040', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#C08000' }}>Mở thực đơn</Text>
          <ChevronRight size={17} color="#C08000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
