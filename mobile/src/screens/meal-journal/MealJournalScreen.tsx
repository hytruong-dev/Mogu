import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../../services/api/health';
import { getDeviceTimeZone } from '../../lib/dates';
import { DateNavigator } from '../../components/molecules/DateNavigator';
import { HealthDatePickerSheet } from '../../components/organisms/HealthDatePickerSheet';
import { PeriodSegmentedControl, JournalPeriod } from './PeriodSegmentedControl';
import { MealJournalDayView } from './MealJournalDayView';
import { MealJournalWeekView } from './MealJournalWeekView';
import { MealJournalMonthView } from './MealJournalMonthView';
import { MealJournalYearView } from './MealJournalYearView';
import { MealJournalNutritionSheet } from './MealJournalNutritionSheet';
import { MealJournalWeekTrendScreen } from './MealJournalWeekTrendScreen';
import { MealJournalMonthTrendScreen } from './MealJournalMonthTrendScreen';
import { MealJournalYearAllMonthsScreen } from './MealJournalYearAllMonthsScreen';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface MealJournalScreenProps {
  onBack: () => void;
  onOpenDish?: (dishId: string, title?: string) => void;
  initialPeriod?: JournalPeriod;
  initialDate?: Date;
}

type SubScreenType = 'WEEK_TREND' | 'MONTH_TREND' | 'YEAR_ALL_MONTHS' | null;

interface NavigationHistoryItem {
  period: JournalPeriod;
  date: Date;
}

function toLocalDateISO(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function parsePlanDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function MealJournalScreen({
  onBack,
  onOpenDish,
  initialPeriod = 'day',
  initialDate = new Date(),
}: MealJournalScreenProps) {
  const tz = getDeviceTimeZone();

  const [period, setPeriod] = useState<JournalPeriod>(initialPeriod);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [history, setHistory] = useState<NavigationHistoryItem[]>([]);
  const [subScreen, setSubScreen] = useState<SubScreenType>(null);
  const [nutritionSheetVisible, setNutritionSheetVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const localDateStr = toLocalDateISO(selectedDate, tz);
  const currentMonthStr = localDateStr.slice(0, 7);

  // Calendar query for date picker dots
  const { data: calendarData } = useQuery({
    queryKey: ['health', 'calendar', currentMonthStr, tz],
    queryFn: () => healthApi.getCalendar(currentMonthStr, tz),
    staleTime: 60000,
  });

  const datesWithData = useMemo(() => {
    return (calendarData?.days || [])
      .filter((d: any) => d.hasMealLog)
      .map((d: any) => parsePlanDate(d.localDate));
  }, [calendarData]);

  // Main stats query for current period & anchor date
  const {
    data: stats,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['profile', 'meal-journal', period, localDateStr, tz],
    queryFn: () => healthApi.getMealStats(period, localDateStr, tz),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch, period, localDateStr]);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (nutritionSheetVisible) {
        setNutritionSheetVisible(false);
        return true;
      }
      if (subScreen) {
        setSubScreen(null);
        return true;
      }
      if (history.length > 0) {
        const last = history[history.length - 1];
        setHistory((prev) => prev.slice(0, -1));
        setPeriod(last.period);
        setSelectedDate(last.date);
        return true;
      }
      onBack();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [nutritionSheetVisible, subScreen, history, onBack]);

  const handleBack = useCallback(() => {
    if (nutritionSheetVisible) {
      setNutritionSheetVisible(false);
      return;
    }
    if (subScreen) {
      setSubScreen(null);
      return;
    }
    if (history.length > 0) {
      const last = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setPeriod(last.period);
      setSelectedDate(last.date);
      return;
    }
    onBack();
  }, [nutritionSheetVisible, subScreen, history, onBack]);

  // Drill-down handlers
  const handleDrillDownToDay = useCallback(
    (dateStr: string) => {
      setHistory((prev) => [...prev, { period, date: selectedDate }]);
      setSelectedDate(parsePlanDate(dateStr));
      setPeriod('day');
      setSubScreen(null);
    },
    [period, selectedDate],
  );

  const handleDrillDownToMonth = useCallback(
    (monthKey: string) => {
      setHistory((prev) => [...prev, { period, date: selectedDate }]);
      const [y, m] = monthKey.split('-').map(Number);
      setSelectedDate(new Date(y, m - 1, 1));
      setPeriod('month');
      setSubScreen(null);
    },
    [period, selectedDate],
  );

  const handlePeriodChange = useCallback(
    (nextPeriod: JournalPeriod) => {
      if (nextPeriod !== period) {
        setPeriod(nextPeriod);
        setSubScreen(null);
      }
    },
    [period],
  );

  const handlePrevious = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') d.setDate(d.getDate() - 1);
      else if (period === 'week') d.setDate(d.getDate() - 7);
      else if (period === 'month') d.setMonth(d.getMonth() - 1);
      else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  }, [period]);

  const handleNext = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') d.setDate(d.getDate() + 1);
      else if (period === 'week') d.setDate(d.getDate() + 7);
      else if (period === 'month') d.setMonth(d.getMonth() + 1);
      else if (period === 'year') d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  }, [period]);

  // Sub-screens rendering
  if (subScreen === 'WEEK_TREND') {
    return (
      <MealJournalWeekTrendScreen
        stats={stats ?? null}
        onBack={() => setSubScreen(null)}
        onSelectDay={handleDrillDownToDay}
      />
    );
  }

  if (subScreen === 'MONTH_TREND') {
    return (
      <MealJournalMonthTrendScreen
        stats={stats ?? null}
        onBack={() => setSubScreen(null)}
        onSelectDay={handleDrillDownToDay}
      />
    );
  }

  if (subScreen === 'YEAR_ALL_MONTHS') {
    return (
      <MealJournalYearAllMonthsScreen
        stats={stats ?? null}
        onBack={() => setSubScreen(null)}
        onSelectMonth={handleDrillDownToMonth}
      />
    );
  }

  return (
    <View className="flex-1 bg-[#FBF9F5]">
      {/* 1. Header */}
      <View className="h-14 px-4 bg-[#FFF9E8] border-b border-[#EFEAE2] flex-row items-center justify-between">
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          className="w-10 h-10 rounded-full items-center justify-center active:bg-primary/20"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color="#1C1917" />
        </Pressable>

        <Text className="text-[18px] font-bold text-[#1C1917]">
          Nhật ký bữa ăn
        </Text>

        <View className="w-10 items-end justify-center">
          {history.length > 0 && (
            <Pressable
              onPress={() => {
                setHistory([]);
                setSelectedDate(new Date());
                setPeriod('day');
              }}
              hitSlop={8}
              accessibilityLabel="Về hôm nay"
              className="w-8 h-8 rounded-full items-center justify-center bg-[#FAF7F2] border border-[#EFEAE2]"
            >
              <RotateCcw size={15} color="#78716C" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        className="flex-1"
      >
        {/* 2. Period Segmented Control */}
        <PeriodSegmentedControl
          value={period}
          onChange={handlePeriodChange}
        />

        {/* 3. Date Navigator */}
        <DateNavigator
          date={selectedDate}
          label={stats?.label}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onPress={() => setDatePickerVisible(true)}
          className="shadow-xs"
        />

        {/* 4. Content State Handling */}
        {isLoading && !stats ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#FFC51A" />
            <Text className="text-[14px] text-[#78716C] mt-3 font-medium">
              Đang tải dữ liệu nhật ký...
            </Text>
          </View>
        ) : queryError ? (
          <Card className="bg-white rounded-3xl p-6 border border-[#FEE2E2] items-center justify-center py-10 shadow-xs gap-0">
            <Text className="text-[16px] font-bold text-[#DC2626]">
              Không thể tải nhật ký bữa ăn
            </Text>
            <Text className="text-[13px] text-[#78716C] text-center mt-1 px-4 mb-4">
              Vui lòng kiểm tra lại kết nối mạng của bạn.
            </Text>
            <Button
              onPress={() => void refetch()}
              className="px-5 py-2.5 bg-primary active:bg-primary/90 rounded-full border-0"
            >
              <Text className="text-[14px] font-bold text-primary-foreground">
                Thử lại
              </Text>
            </Button>
          </Card>
        ) : (
          <>
            {period === 'day' && (
              <MealJournalDayView
                stats={stats ?? null}
                onOpenDish={onOpenDish}
                onLogMeal={() => {
                  // User clicked Ghi bữa ăn
                }}
              />
            )}

            {period === 'week' && (
              <MealJournalWeekView
                stats={stats ?? null}
                onOpenNutritionSheet={() => setNutritionSheetVisible(true)}
                onOpenWeekTrend={() => setSubScreen('WEEK_TREND')}
                onSelectDay={handleDrillDownToDay}
                onOpenDish={onOpenDish}
                onLogMeal={() => {
                  // User clicked Ghi bữa ăn
                }}
              />
            )}

            {period === 'month' && (
              <MealJournalMonthView
                stats={stats ?? null}
                onOpenNutritionSheet={() => setNutritionSheetVisible(true)}
                onOpenMonthTrend={() => setSubScreen('MONTH_TREND')}
                onSelectDay={handleDrillDownToDay}
              />
            )}

            {period === 'year' && (
              <MealJournalYearView
                stats={stats ?? null}
                onOpenNutritionSheet={() => setNutritionSheetVisible(true)}
                onOpenAllMonths={() => setSubScreen('YEAR_ALL_MONTHS')}
                onSelectMonth={handleDrillDownToMonth}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* 5. Nutrition Bottom Sheet */}
      <MealJournalNutritionSheet
        visible={nutritionSheetVisible}
        onClose={() => setNutritionSheetVisible(false)}
        period={period}
        stats={stats ?? null}
      />

      {/* 6. Date Picker Sheet */}
      <HealthDatePickerSheet
        visible={datePickerVisible}
        value={selectedDate}
        datesWithData={datesWithData}
        onCancel={() => setDatePickerVisible(false)}
        onConfirm={(pickedDate) => {
          setSelectedDate(pickedDate);
          setDatePickerVisible(false);
        }}
      />
    </View>
  );
}
