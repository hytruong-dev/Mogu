import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Sparkles, ChevronRight, Calendar, Flame, Award } from 'lucide-react-native';
import { MealStatsResponse } from '../../services/api/health';
import { ThumbnailStack } from './ThumbnailStack';
import { Card } from '../../components/ui/card';

interface MealJournalMonthTrendScreenProps {
  stats: MealStatsResponse | null;
  onBack: () => void;
  onSelectDay: (dateStr: string) => void;
}

type MetricType = 'energy' | 'meals';

export function MealJournalMonthTrendScreen({
  stats,
  onBack,
  onSelectDay,
}: MealJournalMonthTrendScreenProps) {
  const [metric, setMetric] = useState<MetricType>('energy');

  const weeklySeries = stats?.weeklySeries ?? [];
  const dayGroups = stats?.dayGroups ?? [];

  const maxVal = Math.max(
    ...weeklySeries.map((s) => (metric === 'energy' ? (s.consumedKcal ?? 0) : s.mealCount)),
    metric === 'energy' ? 1000 : 5,
  );

  const daysLogged = stats?.daysLogged ?? 0;
  const totalDays = stats?.totalDays ?? 30;
  const coveragePercent = stats?.coveragePercent ?? Math.round((daysLogged / (totalDays || 1)) * 100);
  const avgKcal = stats?.avgKcalPerActiveDay ?? 0;
  const highestDay = stats?.insights?.highestDay;

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
        <Text className="text-[17px] font-bold text-[#1C1917]">Xu hướng tháng</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        className="flex-1"
      >
        {/* Period Label */}
        <Text className="text-[14px] font-semibold text-[#78716C] px-1">
          {stats?.label ?? 'Tháng này'}
        </Text>

        {/* 1. Chart Card with Metric Toggle */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[16px] font-bold text-[#1C1917]">
              {metric === 'energy' ? 'Năng lượng theo tuần' : 'Số bữa theo tuần'}
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

          {/* Weekly Bar Chart */}
          <View className="h-40 pt-4 flex-row items-end justify-between">
            {weeklySeries.map((item) => {
              const hasData = (item.consumedKcal != null && item.consumedKcal > 0) || item.mealCount > 0;
              const val = metric === 'energy' ? (item.consumedKcal ?? 0) : item.mealCount;
              const barHeightPct = hasData ? Math.max(12, Math.round((val / maxVal) * 100)) : 0;

              return (
                <View
                  key={item.key}
                  className="flex-1 items-center justify-end h-full px-1"
                >
                  {/* Top value indicator if has data */}
                  {hasData && (
                    <Text className="text-[10px] font-bold text-foreground mb-1">
                      {metric === 'energy' ? `${Math.round(val / 1000)}k` : val}
                    </Text>
                  )}

                  {/* Bar or Baseline Dot */}
                  <View className="w-full items-center justify-end flex-1 pb-1">
                    {hasData ? (
                      <View
                        style={{ height: `${barHeightPct}%` }}
                        className="w-7 max-w-[32px] bg-primary rounded-t-lg shadow-xs"
                      />
                    ) : (
                      <View className="w-2 h-2 rounded-full bg-[#D6D3D1] mb-1" />
                    )}
                  </View>

                  {/* Week Label */}
                  <Text className="text-[12px] font-bold text-[#1C1917] mt-1">
                    {item.label}
                  </Text>
                  <Text className="text-[10px] font-medium text-[#78716C]">
                    {item.subLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* 2. 3 Short Insights Card */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-3">
          <Text className="text-[16px] font-bold text-[#1C1917] mb-1">
            Tổng kết tháng
          </Text>

          {/* Insight 1: Coverage */}
          <View className="flex-row items-center p-3 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0]">
            <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
              <Calendar size={16} color="#B45309" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-[#1C1917]">
                Độ bao phủ ngày ghi
              </Text>
              <Text className="text-[12px] text-[#78716C] mt-0.5">
                Bạn đã ghi {daysLogged}/{totalDays} ngày ({coveragePercent}%)
              </Text>
            </View>
          </View>

          {/* Insight 2: Average */}
          <View className="flex-row items-center p-3 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0]">
            <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
              <Flame size={16} color="#B45309" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-bold text-[#1C1917]">
                Năng lượng trung bình
              </Text>
              <Text className="text-[12px] text-[#78716C] mt-0.5">
                {avgKcal > 0
                  ? `${avgKcal.toLocaleString('vi-VN')} kcal/ngày có ghi`
                  : 'Chưa có ngày ghi nhận'}
              </Text>
            </View>
          </View>

          {/* Insight 3: Highest Day */}
          {highestDay ? (
            <Pressable
              onPress={() => onSelectDay(highestDay.date)}
              className="flex-row items-center p-3 rounded-2xl bg-primary/10 border border-primary/25 active:bg-primary/20"
            >
              <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3 border border-primary/30">
                <Award size={16} color="#B45309" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-foreground">
                  Ngày nạp nhiều năng lượng nhất
                </Text>
                <Text className="text-[12px] text-[#78716C] mt-0.5">
                  {highestDay.label} · {highestDay.kcal.toLocaleString('vi-VN')} kcal ({highestDay.mealCount} bữa)
                </Text>
              </View>
              <ChevronRight size={16} color="#78716C" className="ml-1" />
            </Pressable>
          ) : null}
        </Card>

        {/* 3. Section: Ngày có dữ liệu trong tháng */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
          <Text className="text-[17px] font-bold text-[#1C1917] mb-3">
            Ngày có dữ liệu ({dayGroups.length})
          </Text>

          {dayGroups.length === 0 ? (
            <Text className="text-[14px] text-[#78716C] py-4 text-center">
              Chưa có dữ liệu bữa ăn trong tháng này.
            </Text>
          ) : (
            <View className="gap-2.5">
              {dayGroups.map((day) => (
                <Card
                  key={day.localDate}
                  className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
                >
                  <Pressable
                    onPress={() => onSelectDay(day.localDate)}
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
                      <ThumbnailStack urls={day.previewMediaUrls} size={30} />
                      <ChevronRight size={18} color="#A8A29E" className="ml-2" />
                    </View>
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
