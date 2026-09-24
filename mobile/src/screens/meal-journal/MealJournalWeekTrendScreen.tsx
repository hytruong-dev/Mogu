import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Sparkles, ChevronRight, Utensils } from 'lucide-react-native';
import { MealStatsResponse } from '../../services/api/health';
import { ThumbnailStack } from './ThumbnailStack';
import { Card } from '../../components/ui/card';

interface MealJournalWeekTrendScreenProps {
  stats: MealStatsResponse | null;
  onBack: () => void;
  onSelectDay: (dateStr: string) => void;
}

type MetricType = 'energy' | 'meals';

export function MealJournalWeekTrendScreen({
  stats,
  onBack,
  onSelectDay,
}: MealJournalWeekTrendScreenProps) {
  const [metric, setMetric] = useState<MetricType>('energy');

  const series = stats?.series ?? [];
  const dayGroups = stats?.dayGroups ?? [];
  const dayGroupsMap = new Map(dayGroups.map((g) => [g.localDate, g]));

  const maxVal = Math.max(
    ...series.map((s) => (metric === 'energy' ? (s.consumedKcal ?? 0) : s.mealCount)),
    metric === 'energy' ? 500 : 3,
  );

  const highestDay = stats?.insights?.highestDay;
  const insightText =
    stats?.insights?.summary ||
    (highestDay
      ? `${highestDay.label} là ngày nạp nhiều năng lượng nhất với ${highestDay.kcal.toLocaleString('vi-VN')} kcal.`
      : 'Chưa có đủ dữ liệu để phân tích xu hướng tuần.');

  return (
    <View className="flex-1 bg-[#FBF9F5]">
      {/* Header */}
      <View className="h-14 px-4 bg-[#FFF9E8] border-b border-[#EFEAE2] flex-row items-center justify-between">
        <Pressable
          onPress={onBack}
          hitSlop={8}
          className="w-10 h-10 rounded-full items-center justify-center active:bg-primary/20"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color="#1C1917" />
        </Pressable>
        <Text className="text-[17px] font-bold text-[#1C1917]">Xu hướng tuần</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        className="flex-1"
      >
        {/* Period Label */}
        <Text className="text-[14px] font-semibold text-[#78716C] px-1">
          {stats?.label ?? 'Tuần này'}
        </Text>

        {/* 1. Chart Card with Metric Toggle */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[16px] font-bold text-[#1C1917]">
              {metric === 'energy' ? 'Năng lượng 7 ngày' : 'Số bữa 7 ngày'}
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

          {/* 7-day Bar Chart */}
          <View className="h-40 pt-4 flex-row items-end justify-between">
            {series.map((item) => {
              const hasData = (item.consumedKcal != null && item.consumedKcal > 0) || item.mealCount > 0;
              const val = metric === 'energy' ? (item.consumedKcal ?? 0) : item.mealCount;
              const barHeightPct = hasData ? Math.max(12, Math.round((val / maxVal) * 100)) : 0;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => item.date && onSelectDay(item.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} (${item.subLabel}): ${
                    hasData
                      ? metric === 'energy'
                        ? `${val.toLocaleString('vi-VN')} kcal`
                        : `${val} bữa`
                      : 'Không có dữ liệu'
                  }`}
                  className="flex-1 items-center justify-end h-full px-1"
                >
                  {/* Top value indicator if has data */}
                  {hasData && (
                    <Text className="text-[10px] font-bold text-foreground mb-1">
                      {metric === 'energy' ? val : val}
                    </Text>
                  )}

                  {/* Bar or Baseline Dot */}
                  <View className="w-full items-center justify-end flex-1 pb-1">
                    {hasData ? (
                      <View
                        style={{ height: `${barHeightPct}%` }}
                        className="w-5 max-w-[24px] bg-primary rounded-t-lg shadow-xs active:bg-primary/80"
                      />
                    ) : (
                      <View className="w-2 h-2 rounded-full bg-[#D6D3D1] mb-1" />
                    )}
                  </View>

                  {/* Day Label */}
                  <Text className="text-[12px] font-bold text-[#1C1917] mt-1">
                    {item.label}
                  </Text>
                  <Text className="text-[10px] font-medium text-[#78716C]">
                    {item.subLabel ? item.subLabel.split('/')[0] : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 2. Insight Card */}
        <Card className="bg-primary/10 rounded-2xl p-4 border border-primary/25 flex-row items-center gap-0 shadow-none">
          <View className="w-9 h-9 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
            <Sparkles size={18} color="#B45309" />
          </View>
          <Text className="text-[13px] font-medium text-foreground flex-1 leading-5">
            {insightText}
          </Text>
        </Card>

        {/* 3. Section: Chi tiết từng ngày */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
          <Text className="text-[17px] font-bold text-[#1C1917] mb-3">
            Chi tiết từng ngày
          </Text>

          <View className="gap-2.5">
            {series.map((item) => {
              const group = item.date ? dayGroupsMap.get(item.date) : null;
              const hasData = (item.consumedKcal != null && item.consumedKcal > 0) || item.mealCount > 0;
              const kcal = group?.consumedKcal ?? item.consumedKcal ?? 0;
              const mealCount = group?.mealCount ?? item.mealCount ?? 0;

              return (
                <Card
                  key={item.key}
                  className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
                >
                  <Pressable
                    onPress={() => item.date && onSelectDay(item.date)}
                    className="p-3 flex-row items-center justify-between active:bg-[#F5F0E6]"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-[14px] font-bold text-[#1C1917]">
                        {item.label}, {item.subLabel}
                      </Text>
                      <Text className="text-[12px] text-[#78716C] mt-0.5">
                        {hasData
                          ? `${kcal.toLocaleString('vi-VN')} kcal · ${mealCount} bữa`
                          : 'Chưa có bữa ăn'}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      {group?.previewMediaUrls && group.previewMediaUrls.length > 0 && (
                        <ThumbnailStack urls={group.previewMediaUrls} size={30} />
                      )}
                      <ChevronRight size={18} color="#A8A29E" className="ml-2" />
                    </View>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
