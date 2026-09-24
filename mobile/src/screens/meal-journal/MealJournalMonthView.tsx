import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { TrendingUp, ChevronRight, Utensils } from 'lucide-react-native';
import { MealStatsResponse, DayGroupItem, SeriesItem } from '../../services/api/health';
import { JournalSummaryStrip } from './JournalSummaryStrip';
import { ThumbnailStack } from './ThumbnailStack';
import { Card } from '../../components/ui/card';

interface MealJournalMonthViewProps {
  stats: MealStatsResponse | null;
  onOpenNutritionSheet: () => void;
  onOpenMonthTrend: () => void;
  onSelectDay: (dateStr: string) => void;
  className?: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function MealJournalMonthView({
  stats,
  onOpenNutritionSheet,
  onOpenMonthTrend,
  onSelectDay,
  className = '',
}: MealJournalMonthViewProps) {
  const totals = stats?.totals ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const daysLogged = stats?.daysLogged ?? 0;
  const totalMeals = stats?.totalMeals ?? 0;
  const totalDays = stats?.totalDays ?? 30;
  const coveragePercent = stats?.coveragePercent ?? Math.round((daysLogged / (totalDays || 1)) * 100);

  // Parse month date info
  const dateStr = stats?.date ?? stats?.startDate ?? '2026-09-01';
  const [yearStr, monthStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Calendar calculations
  // First day of month
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  // Day of week: 0=Sun, 1=Mon... In VN: Mon=0, Sun=6
  const startDayOfWeek = (firstDate.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Create a map of dateStr -> dayGroup
  const dayGroupsMap = new Map<string, DayGroupItem>();
  for (const group of stats?.dayGroups ?? []) {
    dayGroupsMap.set(group.localDate, group);
  }

  // Also check series if available
  const seriesMap = new Map<string, SeriesItem>();
  for (const item of stats?.series ?? []) {
    if (item.date) seriesMap.set(item.date, item);
  }

  const calendarCells: Array<{
    dayNumber?: number;
    dateStr?: string;
    hasData: boolean;
    mealCount: number;
    kcal: number;
  }> = [];

  // Empty cells before start of month
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push({ hasData: false, mealCount: 0, kcal: 0 });
  }

  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const group = dayGroupsMap.get(curDateStr);
    const sItem = seriesMap.get(curDateStr);
    const mealCount = group?.mealCount ?? sItem?.mealCount ?? 0;
    const kcal = group?.consumedKcal ?? sItem?.consumedKcal ?? 0;
    const hasData = Boolean(mealCount > 0 || (sItem && sItem.consumedKcal != null));

    calendarCells.push({
      dayNumber: d,
      dateStr: curDateStr,
      hasData,
      mealCount,
      kcal,
    });
  }

  const recentDays = stats?.dayGroups ?? [];

  return (
    <View className={`gap-4 ${className}`}>
      {/* 1. Summary Strip */}
      <JournalSummaryStrip
        kcal={totals.kcal}
        daysLogged={daysLogged}
        totalMeals={totalMeals}
        onPress={onOpenNutritionSheet}
        accessibilityLabel="Mở sheet dinh dưỡng tháng"
      />

      {/* 2. Calendar Heatmap Card */}
      <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
        <View className="mb-4">
          <Text className="text-[17px] font-bold text-[#1C1917]">
            Tần suất ghi bữa
          </Text>
          <Text className="text-[13px] text-[#78716C] mt-0.5">
            Bạn đã ghi {daysLogged}/{totalDays} ngày ({coveragePercent}%)
          </Text>
        </View>

        {/* Weekday labels */}
        <View className="flex-row items-center justify-between mb-2">
          {WEEKDAYS.map((wd) => (
            <View key={wd} className="flex-1 items-center justify-center">
              <Text className="text-[12px] font-semibold text-[#A8A29E]">
                {wd}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View className="flex-row flex-wrap">
          {calendarCells.map((cell, index) => {
            if (!cell.dayNumber) {
              return (
                <View
                  key={`empty-${index}`}
                  style={{ width: `${100 / 7}%` }}
                  className="aspect-square items-center justify-center p-1"
                />
              );
            }

            return (
              <View
                key={cell.dateStr || index}
                style={{ width: `${100 / 7}%` }}
                className="aspect-square items-center justify-center p-1"
              >
                <Pressable
                  onPress={() => cell.dateStr && onSelectDay(cell.dateStr)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ngày ${cell.dayNumber} tháng ${month}, ${
                    cell.hasData ? `${cell.mealCount} bữa ăn` : 'Chưa ghi'
                  }`}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    cell.hasData
                      ? 'bg-primary shadow-xs'
                      : 'bg-transparent active:bg-[#F5F2EB]'
                  }`}
                >
                  <Text
                    className={`text-[13px] font-bold ${
                      cell.hasData ? 'text-primary-foreground' : 'text-[#57534E]'
                    }`}
                  >
                    {cell.dayNumber}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>

      {/* 3. Link: Xem xu hướng tháng */}
      <Card className="bg-white rounded-2xl p-0 border border-[#EFEAE2] shadow-xs overflow-hidden gap-0">
        <Pressable
          onPress={onOpenMonthTrend}
          accessibilityRole="button"
          accessibilityLabel="Xem xu hướng tháng"
          className="p-4 flex-row items-center justify-between active:bg-[#FAF8F5]"
        >
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
              <TrendingUp size={18} color="#B45309" />
            </View>
            <View>
              <Text className="text-[15px] font-bold text-[#1C1917]">
                Xem xu hướng tháng
              </Text>
              <Text className="text-[12px] text-[#78716C]">
                Biểu đồ phân tích theo tuần và ngày tiêu biểu
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#78716C" />
        </Pressable>
      </Card>

      {/* 4. Section: Ngày gần đây */}
      <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
        <Text className="text-[17px] font-bold text-[#1C1917] mb-3">
          Ngày gần đây
        </Text>

        {recentDays.length === 0 ? (
          <View className="py-6 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-[#FAF7F2] items-center justify-center border border-[#EFEAE2] mb-2">
              <Utensils size={20} color="#A8A29E" />
            </View>
            <Text className="text-[14px] font-medium text-[#78716C] text-center">
              Chưa có nhật ký bữa ăn nào trong tháng này.
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {recentDays.map((day) => (
              <Card
                key={day.localDate}
                className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
              >
                <Pressable
                  onPress={() => onSelectDay(day.localDate)}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label}: ${day.consumedKcal} kcal, ${day.mealCount} bữa`}
                  className="p-3 flex-row items-center justify-between active:bg-[#F5F0E6]"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-[14px] font-bold text-[#1C1917]">
                      {day.label}
                    </Text>
                    <Text className="text-[12px] text-[#78716C] mt-0.5">
                      {day.consumedKcal.toLocaleString('vi-VN')} kcal · {day.mealCount} bữa
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <ThumbnailStack urls={day.previewMediaUrls} size={32} />
                    <ChevronRight size={18} color="#A8A29E" className="ml-2" />
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}
