import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BarChart2, ChevronRight, ChevronDown, Utensils, Plus } from 'lucide-react-native';
import { MealStatsResponse, FormattedMealLog } from '../../services/api/health';
import { JournalSummaryStrip } from './JournalSummaryStrip';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { AppImage } from '../../components/ui/app-image';

interface MealJournalWeekViewProps {
  stats: MealStatsResponse | null;
  onOpenNutritionSheet: () => void;
  onOpenWeekTrend: () => void;
  onSelectDay: (dateStr: string) => void;
  onOpenDish?: (dishId: string, title?: string) => void;
  onLogMeal?: () => void;
  className?: string;
}

const SLOT_LABELS: Record<string, string> = {
  BREAKFAST: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Bữa phụ',
};

export function MealJournalWeekView({
  stats,
  onOpenNutritionSheet,
  onOpenWeekTrend,
  onSelectDay,
  onOpenDish,
  onLogMeal,
  className = '',
}: MealJournalWeekViewProps) {
  const totals = stats?.totals ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const daysLogged = stats?.daysLogged ?? 0;
  const totalMeals = stats?.totalMeals ?? 0;

  // 7-day strip data from stats.series
  const series = stats?.series ?? [];

  // Default selected date: first day with data or the first day of the week
  const firstDayWithData = series.find((s) => (s.mealCount ?? 0) > 0)?.date;
  const initialDate = firstDayWithData ?? series[0]?.date ?? stats?.date ?? '';

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [isGroupExpanded, setIsGroupExpanded] = useState<boolean>(true);

  // Synchronize when stats change if selectedDate is not in series
  const activeSelectedDate =
    series.some((s) => s.date === selectedDate) ? selectedDate : (initialDate || series[0]?.date || '');

  // Get meals for selected date from stats.dayGroups or stats.items
  const currentDayGroup = stats?.dayGroups?.find((g) => g.localDate === activeSelectedDate);
  const currentDayMeals: FormattedMealLog[] =
    currentDayGroup?.meals ??
    stats?.items?.filter((m) => m.localDate === activeSelectedDate) ??
    [];

  const handleDayPress = (dateStr?: string) => {
    if (!dateStr) return;
    if (dateStr === activeSelectedDate) {
      // Tap again on already selected day: drill down to Day view
      onSelectDay(dateStr);
    } else {
      setSelectedDate(dateStr);
    }
  };

  const selectedSeriesItem = series.find((s) => s.date === activeSelectedDate);
  const dayKcal = currentDayGroup?.consumedKcal ?? selectedSeriesItem?.consumedKcal ?? 0;
  const dayMealCount = currentDayGroup?.mealCount ?? currentDayMeals.length;

  return (
    <View className={`gap-4 ${className}`}>
      {/* 1. Summary Strip */}
      <JournalSummaryStrip
        kcal={totals.kcal}
        daysLogged={daysLogged}
        totalMeals={totalMeals}
        onPress={onOpenNutritionSheet}
        accessibilityLabel="Mở sheet dinh dưỡng tuần"
      />

      {/* 2. 7-Day Day Selector Strip */}
      <Card className="bg-white rounded-2xl p-2.5 border border-[#EFEAE2] shadow-xs gap-0">
        <View className="flex-row items-center justify-between">
          {series.map((item) => {
            const isSelected = item.date === activeSelectedDate;
            const hasData = (item.mealCount ?? 0) > 0 || item.consumedKcal != null;
            const dateNum = item.subLabel ? item.subLabel.split('/')[0] : '';

            return (
              <Pressable
                key={item.key}
                onPress={() => handleDayPress(item.date)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label} ngày ${item.subLabel}, ${
                  hasData ? `${item.consumedKcal ?? 0} kcal` : 'Chưa có bữa ăn'
                }`}
                className={`flex-1 items-center py-2.5 px-1 rounded-xl mx-0.5 ${
                  isSelected
                    ? 'bg-primary/20 border border-primary/40'
                    : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-[12px] font-semibold ${
                    isSelected ? 'text-foreground font-bold' : 'text-[#78716C]'
                  }`}
                >
                  {item.label}
                </Text>

                <Text
                  className={`text-[15px] font-bold mt-1 ${
                    isSelected ? 'text-[#1C1917]' : 'text-[#44403C]'
                  }`}
                >
                  {dateNum}
                </Text>

                {/* Dot indicator */}
                <View className="h-2 items-center justify-center mt-1">
                  {hasData ? (
                    <View
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-primary' : 'bg-primary/50'
                      }`}
                    />
                  ) : (
                    <View className="w-1.5 h-1.5" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* 3. Link: Xem biểu đồ tuần */}
      <Card className="bg-white rounded-2xl p-0 border border-[#EFEAE2] shadow-xs overflow-hidden gap-0">
        <Pressable
          onPress={onOpenWeekTrend}
          accessibilityRole="button"
          accessibilityLabel="Xem biểu đồ tuần"
          className="p-4 flex-row items-center justify-between active:bg-[#FAF8F5]"
        >
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
              <BarChart2 size={18} color="#B45309" />
            </View>
            <View>
              <Text className="text-[15px] font-bold text-[#1C1917]">
                Xem biểu đồ tuần
              </Text>
              <Text className="text-[12px] text-[#78716C]">
                Phân tích năng lượng và số bữa trong 7 ngày
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#78716C" />
        </Pressable>
      </Card>

      {/* 4. Meal Group Section for Selected Day */}
      <Card className="bg-white rounded-3xl p-4 border border-[#EFEAE2] shadow-xs gap-0">
        {/* Group Header */}
        <View className="flex-row items-center justify-between pb-3">
          <Pressable
            onPress={() => activeSelectedDate && onSelectDay(activeSelectedDate)}
            className="flex-1"
          >
            <View className="flex-row items-center">
              <Text className="text-[16px] font-bold text-[#1C1917]">
                {currentDayGroup?.label ?? (selectedSeriesItem ? `${selectedSeriesItem.label}, ${selectedSeriesItem.subLabel}` : 'Bữa ăn trong ngày')}
              </Text>
              <ChevronRight size={16} color="#A8A29E" className="ml-1" />
            </View>
            <Text className="text-[12px] text-[#78716C] mt-0.5">
              {dayMealCount > 0
                ? `${(dayKcal ?? 0).toLocaleString('vi-VN')} kcal · ${dayMealCount} bữa`
                : 'Chưa có bữa ăn'}
            </Text>
          </Pressable>

          <Button
            size="icon"
            variant="ghost"
            onPress={() => setIsGroupExpanded(!isGroupExpanded)}
            accessibilityLabel={isGroupExpanded ? 'Thu gọn nhóm bữa ăn' : 'Mở rộng nhóm bữa ăn'}
            className="w-8 h-8 items-center justify-center rounded-full bg-[#FAF7F2] border border-[#EFEAE2]"
          >
            {isGroupExpanded ? (
              <ChevronDown size={16} color="#78716C" />
            ) : (
              <ChevronRight size={16} color="#78716C" />
            )}
          </Button>
        </View>

        <Separator className="bg-[#F5F2EB]" />

        {/* Meal Items */}
        {isGroupExpanded && (
          <View className="mt-3 gap-2.5">
            {currentDayMeals.length === 0 ? (
              <View className="py-6 items-center justify-center">
                <View className="w-12 h-12 rounded-full bg-[#FAF7F2] items-center justify-center border border-[#EFEAE2] mb-2">
                  <Utensils size={20} color="#A8A29E" />
                </View>
                <Text className="text-[14px] font-bold text-[#1C1917]">
                  Chưa ghi bữa ngày này
                </Text>
                <Button
                  onPress={onLogMeal}
                  className="mt-3 px-4 py-2 bg-primary active:bg-primary/90 rounded-full flex-row items-center border-0"
                >
                  <Plus size={16} color="#1C1917" strokeWidth={2.5} />
                  <Text className="text-[13px] font-bold text-primary-foreground ml-1.5">
                    Ghi bữa ăn
                  </Text>
                </Button>
              </View>
            ) : (
              currentDayMeals.map((meal, idx) => {
                const first = meal.items?.[0];
                const dishId = first?.referenceId;
                const dishName =
                  first?.displayName ?? SLOT_LABELS[meal.mealSlot] ?? 'Bữa ăn';
                const kcal = meal.totals?.kcal;
                const thumb = first?.thumbnailUrl;

                return (
                  <Card
                    key={meal.id || idx}
                    className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
                  >
                    <Pressable
                      onPress={() => dishId && onOpenDish?.(dishId, dishName)}
                      className="p-2.5 flex-row items-center active:bg-[#F5F0E6]"
                    >
                      <View className="w-12 h-12 rounded-xl bg-white border border-[#E8E0D2] overflow-hidden items-center justify-center mr-3">
                        {thumb ? (
                          <AppImage
                            uri={thumb}
                            className="w-full h-full"
                            contentFit="cover"
                          />
                        ) : (
                          <Utensils size={18} color="#A8A29E" />
                        )}
                      </View>

                      <View className="flex-1 justify-center">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[11px] font-bold text-primary uppercase">
                            {SLOT_LABELS[meal.mealSlot] || meal.mealSlot}
                          </Text>
                          {meal.sourceType === 'WEEKLY_PLAN' && (
                            <Badge variant="secondary" className="bg-primary/20 px-1.5 py-0.5 rounded border border-primary/30">
                              <Text className="text-[9px] font-bold text-foreground">
                                Kế hoạch
                              </Text>
                            </Badge>
                          )}
                        </View>
                        <Text
                          numberOfLines={1}
                          className="text-[14px] font-bold text-[#1C1917] mt-0.5"
                        >
                          {dishName}
                        </Text>
                        {kcal != null && (
                          <Text className="text-[12px] font-medium text-[#78716C] mt-0.5">
                            {kcal.toLocaleString('vi-VN')} kcal
                          </Text>
                        )}
                      </View>

                      <ChevronRight size={16} color="#D6D3D1" className="ml-1" />
                    </Pressable>
                  </Card>
                );
              })
            )}
          </View>
        )}
      </Card>
    </View>
  );
}
