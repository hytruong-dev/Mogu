import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { MealStatsResponse, MonthGroupItem } from '../../services/api/health';
import { ThumbnailStack } from './ThumbnailStack';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card } from '../../components/ui/card';

interface MealJournalYearAllMonthsScreenProps {
  stats: MealStatsResponse | null;
  onBack: () => void;
  onSelectMonth: (monthKey: string) => void;
}

type FilterType = 'all' | 'with_data';

export function MealJournalYearAllMonthsScreen({
  stats,
  onBack,
  onSelectMonth,
}: MealJournalYearAllMonthsScreenProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const monthGroups: MonthGroupItem[] = stats?.monthGroups ?? [];
  const year = stats?.date ? stats.date.slice(0, 4) : '2026';

  const displayedMonths =
    filter === 'with_data'
      ? monthGroups.filter((m) => m.hasData || m.mealCount > 0)
      : monthGroups;

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
        <Text className="text-[17px] font-bold text-[#1C1917]">
          Các tháng năm {year}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        className="flex-1"
      >
        {/* Segmented Filter with Tabs */}
        <Tabs
          value={filter}
          onValueChange={(val) => setFilter(val as FilterType)}
          className="w-full"
        >
          <TabsList className="h-auto w-full flex-row rounded-full bg-[#EBE5DA] p-1 border-0 shadow-none">
            <TabsTrigger
              value="all"
              accessibilityLabel="Tất cả các tháng"
              className={`flex-1 py-2 rounded-full items-center justify-center border-0 shadow-none ${
                filter === 'all' ? 'bg-primary shadow-xs' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[13px] ${
                  filter === 'all' ? 'text-primary-foreground font-bold' : 'text-[#78716C] font-semibold'
                }`}
              >
                Tất cả các tháng
              </Text>
            </TabsTrigger>

            <TabsTrigger
              value="with_data"
              accessibilityLabel="Chỉ tháng có dữ liệu"
              className={`flex-1 py-2 rounded-full items-center justify-center border-0 shadow-none ${
                filter === 'with_data' ? 'bg-primary shadow-xs' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[13px] ${
                  filter === 'with_data' ? 'text-primary-foreground font-bold' : 'text-[#78716C] font-semibold'
                }`}
              >
                Chỉ tháng có dữ liệu
              </Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Months List */}
        <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-2.5">
          {displayedMonths.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Calendar size={28} color="#A8A29E" className="mb-2" />
              <Text className="text-[14px] text-[#78716C] text-center">
                Không có tháng nào có dữ liệu trong năm {year}.
              </Text>
            </View>
          ) : (
            displayedMonths.map((m) => {
              const hasData = m.hasData || m.mealCount > 0;

              if (!hasData) {
                return (
                  <View
                    key={m.monthKey}
                    className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#F5F2EB] flex-row items-center justify-between opacity-60"
                  >
                    <View>
                      <Text className="text-[15px] font-semibold text-[#78716C]">
                        {m.label}
                      </Text>
                      <Text className="text-[12px] text-[#A8A29E] mt-0.5">
                        Chưa có dữ liệu
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <Card
                  key={m.monthKey}
                  className="p-0 rounded-2xl bg-[#FAF7F2] border border-[#F0EAE0] overflow-hidden gap-0 shadow-none"
                >
                  <Pressable
                    onPress={() => onSelectMonth(m.monthKey)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label}: ${m.consumedKcal} kcal, ${m.mealCount} bữa`}
                    className="p-3.5 flex-row items-center justify-between active:bg-[#F5F0E6]"
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
              );
            })
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
