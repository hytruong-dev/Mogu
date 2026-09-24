import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sparkles, ChevronRight, Utensils, Calendar } from 'lucide-react-native';
import { MealStatsResponse } from '../../services/api/health';
import { JournalSummaryStrip } from './JournalSummaryStrip';
import { ThumbnailStack } from './ThumbnailStack';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface MealJournalYearViewProps {
  stats: MealStatsResponse | null;
  onOpenNutritionSheet: () => void;
  onOpenAllMonths: () => void;
  onSelectMonth: (monthKey: string) => void;
  className?: string;
}

type MetricType = 'energy' | 'meals';

export function MealJournalYearView({
  stats,
  onOpenNutritionSheet,
  onOpenAllMonths,
  onSelectMonth,
  className = '',
}: MealJournalYearViewProps) {
  const [metric, setMetric] = useState<MetricType>('energy');

  const totals = stats?.totals ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const daysLogged = stats?.daysLogged ?? 0;
  const totalMeals = stats?.totalMeals ?? 0;

  // 12 months data
  const series = stats?.series ?? [];
  const monthGroups = stats?.monthGroups ?? [];

  // Filter months that have data for the list below
  const monthsWithData = monthGroups.filter((m) => m.hasData || m.mealCount > 0);

  // Calculate max for chart
  const maxVal = Math.max(
    ...series.map((s) => (metric === 'energy' ? (s.consumedKcal ?? 0) : s.mealCount)),
    metric === 'energy' ? 1000 : 10,
  );

  const highestMonth = stats?.insights?.highestMonth;
  const insightText =
    stats?.insights?.summary ||
    (highestMonth
      ? `${highestMonth.label} là tháng hoạt động tích cực nhất với ${highestMonth.mealCount} bữa ăn.`
      : 'Chưa có đủ dữ liệu để tạo insight năm.');

  return (
    <View className={`gap-4 ${className}`}>
      {/* 1. Summary Strip */}
      <JournalSummaryStrip
        kcal={totals.kcal}
        daysLogged={daysLogged}
        totalMeals={totalMeals}
        onPress={onOpenNutritionSheet}
        accessibilityLabel="Mở sheet dinh dưỡng năm"
      />

      {/* 2. Chart Section with Metric Toggle */}
      <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[17px] font-bold text-[#1C1917]">
            {metric === 'energy' ? 'Năng lượng cả năm' : 'Số bữa cả năm'}
          </Text>

          {/* Metric Toggle */}
          <View className="flex-row bg-[#F5F2EB] p-1 rounded-full border border-[#EAE3D5]">
            <Pressable
              onPress={() => setMetric('energy')}
              className={`px-3 py-1 rounded-full ${
                metric === 'energy' ? 'bg-primary' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[12px] font-bold ${
                  metric === 'energy' ? 'text-primary-foreground' : 'text-[#78716C]'
                }`}
              >
                Năng lượng
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMetric('meals')}
              className={`px-3 py-1 rounded-full ${
                metric === 'meals' ? 'bg-primary' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[12px] font-bold ${
                  metric === 'meals' ? 'text-primary-foreground' : 'text-[#78716C]'
                }`}
              >
                Số bữa
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 12 Months Bar Chart */}
        <View className="h-36 pt-4 flex-row items-end justify-between">
          {series.map((item) => {
            const hasData = (item.consumedKcal != null && item.consumedKcal > 0) || item.mealCount > 0;
            const val = metric === 'energy' ? (item.consumedKcal ?? 0) : item.mealCount;
            const barHeightPct = hasData ? Math.max(12, Math.round((val / maxVal) * 100)) : 0;

            return (
              <Pressable
                key={item.key}
                disabled={!hasData}
                onPress={() => onSelectMonth(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${
                  hasData
                    ? metric === 'energy'
                      ? `${val.toLocaleString('vi-VN')} kcal`
                      : `${val} bữa`
                    : 'Không có dữ liệu'
                }`}
                className="flex-1 items-center justify-end h-full px-0.5"
              >
                {/* Bar or Baseline Dot */}
                <View className="w-full items-center justify-end flex-1 pb-1">
                  {hasData ? (
                    <View
                      style={{ height: `${barHeightPct}%` }}
                      className="w-3 max-w-[14px] bg-primary rounded-t-full shadow-xs active:bg-primary/80"
                    />
                  ) : (
                    <View className="w-1.5 h-1.5 rounded-full bg-[#D6D3D1] mb-0.5" />
                  )}
                </View>

                {/* Month Label */}
                <Text className="text-[11px] font-semibold text-[#78716C] mt-1">
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* 3. Insight Card */}
      <Card className="bg-primary/10 rounded-2xl p-4 border border-primary/25 flex-row items-center gap-0 shadow-none">
        <View className="w-9 h-9 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
          <Sparkles size={18} color="#B45309" />
        </View>
        <Text className="text-[13px] font-medium text-foreground flex-1 leading-5">
          {insightText}
        </Text>
      </Card>

      {/* 4. Section: Theo tháng */}
      <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[17px] font-bold text-[#1C1917]">
            Theo tháng
          </Text>
          <Text className="text-[13px] font-semibold text-[#78716C]">
            {monthsWithData.length} tháng có dữ liệu
          </Text>
        </View>

        {monthsWithData.length === 0 ? (
          <View className="py-6 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-[#FAF7F2] items-center justify-center border border-[#EFEAE2] mb-2">
              <Utensils size={20} color="#A8A29E" />
            </View>
            <Text className="text-[14px] font-medium text-[#78716C] text-center">
              Chưa có nhật ký bữa ăn nào trong năm nay.
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {monthsWithData.map((m) => (
              <Card
                key={m.monthKey}
                className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
              >
                <Pressable
                  onPress={() => onSelectMonth(m.monthKey)}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.label}: ${m.consumedKcal} kcal, ${m.mealCount} bữa`}
                  className="p-3 flex-row items-center justify-between active:bg-[#F5F0E6]"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-[15px] font-bold text-[#1C1917]">
                      {m.label}
                    </Text>
                    <Text className="text-[12px] text-[#78716C] mt-0.5">
                      {m.consumedKcal.toLocaleString('vi-VN')} kcal · {m.mealCount} bữa
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <ThumbnailStack urls={m.previewMediaUrls} size={32} />
                    <ChevronRight size={18} color="#A8A29E" className="ml-2" />
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        {/* Action: Xem đủ 12 tháng */}
        <Button
          variant="outline"
          onPress={onOpenAllMonths}
          accessibilityLabel="Xem đủ 12 tháng"
          className="mt-4 py-3 bg-[#FAF7F2] border border-[#EFEAE2] rounded-2xl flex-row items-center justify-center active:bg-[#F5F0E6] shadow-none"
        >
          <Calendar size={16} color="#78716C" className="mr-2" />
          <Text className="text-[14px] font-bold text-[#44403C]">
            Xem đủ 12 tháng
          </Text>
        </Button>
      </Card>
    </View>
  );
}
