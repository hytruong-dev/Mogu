import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  CalendarDays,
  Droplets,
  Footprints,
  Plus,
  Utensils,
} from 'lucide-react-native';
import { cn } from '../lib/utils';
import { ExploreDetailScreen } from './ExploreDetailScreen';
import { HealthOverviewScreen, LogMealScreen, MealsScreen } from './HealthDetailScreens';
import { DateNavigator } from '../components/molecules/DateNavigator';
import { HealthDatePickerSheet } from '../components/organisms/HealthDatePickerSheet';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { healthApi, type HealthDayResponse } from '../services/api/health';
import { getDeviceTimeZone } from '../lib/dates';
import { dishesApi } from '../services/api/dishes';

const mascot = require('../assets/images/random/thumb.png');

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onProfile: () => void;
};

function toLocalDateISO(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function HealthScreen({ onHome, onExplore, onRandom, onProfile }: Props) {
  const timezone = getDeviceTimeZone();
  const [page, setPage] = useState<'main' | 'overview' | 'meals' | 'log' | 'food'>('main');
  const [foodDishId, setFoodDishId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<HealthDayResponse | null>(null);
  const [addingWater, setAddingWater] = useState(false);

  const localDate = toLocalDateISO(selectedDate, timezone);

  const loadDay = useCallback(async () => {
    setError(null);
    try {
      const data = await healthApi.getDay(localDate, timezone);
      setDay(data);
    } catch (e: any) {
      setError(e?.message || 'Không tải được dữ liệu sức khỏe');
      setDay(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [localDate, timezone]);

  useEffect(() => {
    setLoading(true);
    loadDay();
  }, [loadDay]);

  const addWater = async () => {
    if (addingWater) return;
    setAddingWater(true);
    try {
      await healthApi.addWater(
        250,
        localDate,
        timezone,
        `water-250-${localDate}-${Date.now()}`,
      );
      await loadDay();
    } catch (e: any) {
      setError(e?.message || 'Không ghi được nước');
    } finally {
      setAddingWater(false);
    }
  };

  const consumed = day?.energy.consumedKcal;
  const target = day?.energy.targetKcal;
  const remaining = day?.energy.remainingKcal;
  const waterMl = day?.water.consumedMl;
  const noData = !day || day.dataStatus === 'no_data';

  if (page === 'overview') {
    return (
      <HealthOverviewScreen
        total={consumed ?? 0}
        onBack={() => setPage('main')}
      />
    );
  }
  if (page === 'meals') {
    return (
      <MealsScreen
        total={consumed ?? 0}
        onBack={() => setPage('main')}
        onLog={() => setPage('log')}
        onFood={(dishId?: string) => {
          setFoodDishId(dishId ?? null);
          setPage('food');
        }}
        mealGroups={day?.mealGroups}
      />
    );
  }
  if (page === 'log') {
    return (
      <LogMealScreen
        onClose={() => setPage('main')}
        onSave={async (payload) => {
          if (!payload?.dishId) {
            setPage('main');
            return;
          }
          try {
            await healthApi.createMealLog({
              mealSlot: payload.mealSlot || 'LUNCH',
              timezone,
              items: [
                {
                  referenceType: 'DISH',
                  referenceId: payload.dishId,
                  quantity: 1,
                  unitCode: 'SERVING',
                },
              ],
            });
            await loadDay();
          } catch (e: any) {
            setError(e?.message || 'Không lưu được bữa');
          }
          setPage('main');
        }}
        searchDishes={async (q: string) => {
          const res = await dishesApi.search({ q, limit: 20 });
          return res.data ?? [];
        }}
      />
    );
  }
  if (page === 'food') {
    return (
      <ExploreDetailScreen
        type="food"
        resourceId={foodDishId}
        onBack={() => setPage('meals')}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-mogu-cream" edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDay();
            }}
          />
        }
      >
        <View className="h-[74px] flex-row items-center justify-between">
          <Text className="text-[32px] font-bold text-[#161616]">Sức khỏe</Text>
          <Pressable className="w-11 h-11 rounded-full bg-white items-center justify-center" style={shadow}>
            <Bell size={22} color="#161616" />
          </Pressable>
        </View>

        <DateNavigator
          date={selectedDate}
          onPrevious={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - 1);
            setSelectedDate(d);
          }}
          onNext={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + 1);
            setSelectedDate(d);
          }}
          onPress={() => setDatePickerVisible(true)}
        />

        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color="#F5B900" />
          </View>
        ) : error ? (
          <View className="py-10 items-center px-4">
            <Text className="text-[#161616] font-semibold text-center">{error}</Text>
            <Pressable onPress={loadDay} className="mt-4 bg-mogu-yellow px-5 py-3 rounded-full">
              <Text className="font-bold">Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => setPage('overview')}
              className="mt-4 bg-white rounded-[24px] p-5"
              style={shadow}
            >
              <Text className="text-[#7E7E7E] text-sm">Năng lượng hôm nay</Text>
              {noData || consumed == null ? (
                <Text className="text-[22px] font-bold text-[#161616] mt-2">Chưa có dữ liệu</Text>
              ) : (
                <>
                  <Text className="text-[40px] font-bold text-[#161616] mt-1">
                    {consumed}
                    <Text className="text-[18px] font-semibold text-[#7E7E7E]">
                      {target != null ? ` / ${target} kcal` : ' kcal'}
                    </Text>
                  </Text>
                  {remaining != null && target != null ? (
                    <Text className="text-[#4F4F4F] mt-1">Còn lại {remaining} kcal</Text>
                  ) : null}
                </>
              )}
            </Pressable>

            <View className="flex-row gap-3 mt-3">
              <View className="flex-1 bg-white rounded-[20px] p-4" style={shadow}>
                <View className="flex-row items-center gap-2">
                  <Droplets size={18} color="#4F8CFF" />
                  <Text className="font-semibold text-[#161616]">Nước</Text>
                </View>
                <Text className="text-[22px] font-bold mt-2 text-[#161616]">
                  {waterMl == null ? '—' : `${waterMl} ml`}
                </Text>
                <Pressable
                  onPress={addWater}
                  disabled={addingWater}
                  className={cn(
                    'mt-3 h-10 rounded-full items-center justify-center',
                    addingWater ? 'bg-[#EEE]' : 'bg-mogu-yellow',
                  )}
                >
                  <Text className="font-bold text-[#161616]">+250 ml</Text>
                </Pressable>
              </View>

              <View className="flex-1 bg-white rounded-[20px] p-4" style={shadow}>
                <View className="flex-row items-center gap-2">
                  <Footprints size={18} color="#2F9E6A" />
                  <Text className="font-semibold text-[#161616]">Bước chân</Text>
                </View>
                <Text className="text-[22px] font-bold mt-2 text-[#161616]">—</Text>
                <Text className="text-xs text-[#7E7E7E] mt-2">Chưa kết nối thiết bị</Text>
              </View>
            </View>

            <Pressable
              onPress={() => setPage('meals')}
              className="mt-3 bg-white rounded-[20px] p-4 flex-row items-center justify-between"
              style={shadow}
            >
              <View className="flex-row items-center gap-3">
                <Utensils size={20} color="#161616" />
                <View>
                  <Text className="font-bold text-[#161616]">Nhật ký bữa ăn</Text>
                  <Text className="text-sm text-[#7E7E7E]">
                    {noData
                      ? 'Chưa ghi bữa nào'
                      : `${day?.mealGroups?.reduce((s, g) => s + g.meals.length, 0) ?? 0} bữa đã ghi`}
                  </Text>
                </View>
              </View>
              <CalendarDays size={20} color="#7E7E7E" />
            </Pressable>

            <Pressable
              onPress={() => setPage('log')}
              className="mt-4 h-14 rounded-full bg-mogu-yellow items-center justify-center flex-row gap-2"
            >
              <Plus size={20} />
              <Text className="font-bold text-[#161616]">Ghi bữa ăn</Text>
            </Pressable>

            <View className="items-center mt-6 mb-4">
              <Image source={mascot} style={{ width: 72, height: 72 }} resizeMode="contain" />
            </View>
          </>
        )}
      </ScrollView>

      <HealthDatePickerSheet
        visible={datePickerVisible}
        value={selectedDate}
        onCancel={() => setDatePickerVisible(false)}
        onConfirm={(d) => {
          setSelectedDate(d);
          setDatePickerVisible(false);
        }}
      />

      <LiquidGlassBottomNav
        active="health"
        onHome={onHome}
        onExplore={onExplore}
        onRandom={onRandom}
        onProfile={onProfile}
      />
    </SafeAreaView>
  );
}
