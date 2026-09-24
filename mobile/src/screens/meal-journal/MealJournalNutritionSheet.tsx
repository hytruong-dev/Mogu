import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Flame } from 'lucide-react-native';
import { MealStatsResponse } from '../../services/api/health';
import { JournalPeriod } from './PeriodSegmentedControl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '../../components/ui/drawer';
import { Card } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

interface MealJournalNutritionSheetProps {
  visible: boolean;
  onClose: () => void;
  period: JournalPeriod;
  stats: MealStatsResponse | null;
}

export function MealJournalNutritionSheet({
  visible,
  onClose,
  period,
  stats,
}: MealJournalNutritionSheetProps) {
  const title =
    period === 'week'
      ? 'Dinh dưỡng tuần'
      : period === 'month'
        ? 'Dinh dưỡng tháng'
        : period === 'year'
          ? 'Dinh dưỡng năm'
          : 'Dinh dưỡng ngày';

  const totals = stats?.totals ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const targets = stats?.targets;

  const targetKcal = targets?.periodKcalTarget ?? targets?.dailyKcalTarget;
  const targetProtein = targets?.periodProteinG ?? targets?.dailyProteinG;
  const targetCarbs = targets?.periodCarbsG ?? targets?.dailyCarbsG;
  const targetFat = targets?.periodFatG ?? targets?.dailyFatG;

  const kcalPercent =
    targetKcal && targetKcal > 0
      ? Math.round((totals.kcal / targetKcal) * 100)
      : null;
  const proteinPercent =
    targetProtein && targetProtein > 0
      ? Math.round((totals.proteinG / targetProtein) * 100)
      : null;
  const carbsPercent =
    targetCarbs && targetCarbs > 0
      ? Math.round((totals.carbsG / targetCarbs) * 100)
      : null;
  const fatPercent =
    targetFat && targetFat > 0
      ? Math.round((totals.fatG / targetFat) * 100)
      : null;

  const avgKcal = stats?.avgKcalPerActiveDay || stats?.avgKcalPerDay || 0;

  return (
    <Drawer open={visible} onOpenChange={(open) => !open && onClose()} snapHeight={600}>
      <DrawerHeader className="px-5 pt-1 pb-3 border-b border-[#F5F2EB] flex-row items-center justify-between">
        <DrawerTitle className="text-[20px] font-bold text-[#1C1917]">{title}</DrawerTitle>
        <DrawerClose onPress={onClose} />
      </DrawerHeader>

      <DrawerContent className="px-5 pb-6">
        <ScrollView showsVerticalScrollIndicator={false} className="mt-3">
          {/* 1. Năng lượng Block */}
          <Card className="bg-[#FAF7F2] rounded-3xl p-5 border border-[#EFEAE2] gap-0 shadow-none">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-7 h-7 rounded-full bg-primary/20 items-center justify-center mr-2">
                  <Flame size={16} color="#B45309" />
                </View>
                <Text className="text-[15px] font-bold text-[#1C1917]">
                  Năng lượng nạp vào
                </Text>
              </View>

              {kcalPercent != null && (
                <Badge variant="secondary" className="bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">
                  <Text className="text-[12px] font-bold text-foreground">
                    {kcalPercent}%
                  </Text>
                </Badge>
              )}
            </View>

            <View className="flex-row items-baseline mt-1">
              <Text className="text-[24px] font-black text-[#1C1917]">
                {totals.kcal.toLocaleString('vi-VN')}
              </Text>
              <Text className="text-[14px] text-[#78716C] ml-1">kcal</Text>
              {targetKcal != null ? (
                <Text className="text-[14px] font-medium text-[#A8A29E] ml-2">
                  / {targetKcal.toLocaleString('vi-VN')} kcal
                </Text>
              ) : (
                <Text className="text-[13px] text-[#A8A29E] ml-2">
                  / Chưa đặt mục tiêu
                </Text>
              )}
            </View>

            {/* Progress bar */}
            {targetKcal != null && (
              <Progress
                value={Math.min(100, Math.max(0, kcalPercent ?? 0))}
                className="h-2.5 bg-[#EBE5DA] rounded-full mt-3"
                indicatorClassName="bg-primary"
              />
            )}

            {avgKcal > 0 && (
              <Text className="text-[12px] text-[#78716C] mt-2.5">
                Trung bình: {avgKcal.toLocaleString('vi-VN')} kcal/ngày có ghi
              </Text>
            )}
          </Card>

          {/* 2. Macro Nutrients Block */}
          <View className="mt-5 mb-2 gap-3">
            <Text className="text-[16px] font-bold text-[#1C1917]">
              Phân bố dinh dưỡng (Macros)
            </Text>

            {/* Protein */}
            <Card className="bg-white rounded-2xl p-4 border border-[#EFEAE2] gap-0 shadow-none">
              <View className="flex-row items-center justify-between mb-1.5">
                <View>
                  <Text className="text-[14px] font-bold text-[#1C1917]">
                    Đạm (Protein)
                  </Text>
                  <Text className="text-[12px] text-[#78716C] mt-0.5">
                    {totals.proteinG.toLocaleString('vi-VN')}g
                    {targetProtein != null ? ` / ${targetProtein}g` : ' / Chưa đặt'}
                  </Text>
                </View>
                {proteinPercent != null && (
                  <Badge variant="secondary" className="bg-[#E0F2FE] px-2 py-0.5 rounded-full border border-[#BAE6FD]">
                    <Text className="text-[11px] font-bold text-[#0369A1]">
                      {proteinPercent}%
                    </Text>
                  </Badge>
                )}
              </View>
              {targetProtein != null && (
                <Progress
                  value={Math.min(100, Math.max(0, proteinPercent ?? 0))}
                  className="h-2 bg-[#F0EAE0] rounded-full mt-2"
                  indicatorClassName="bg-[#0284C7]"
                />
              )}
            </Card>

            {/* Carbs */}
            <Card className="bg-white rounded-2xl p-4 border border-[#EFEAE2] gap-0 shadow-none">
              <View className="flex-row items-center justify-between mb-1.5">
                <View>
                  <Text className="text-[14px] font-bold text-[#1C1917]">
                    Tinh bột (Carbohydrates)
                  </Text>
                  <Text className="text-[12px] text-[#78716C] mt-0.5">
                    {totals.carbsG.toLocaleString('vi-VN')}g
                    {targetCarbs != null ? ` / ${targetCarbs}g` : ' / Chưa đặt'}
                  </Text>
                </View>
                {carbsPercent != null && (
                  <Badge variant="secondary" className="bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">
                    <Text className="text-[11px] font-bold text-foreground">
                      {carbsPercent}%
                    </Text>
                  </Badge>
                )}
              </View>
              {targetCarbs != null && (
                <Progress
                  value={Math.min(100, Math.max(0, carbsPercent ?? 0))}
                  className="h-2 bg-[#F0EAE0] rounded-full mt-2"
                  indicatorClassName="bg-primary"
                />
              )}
            </Card>

            {/* Fat */}
            <Card className="bg-white rounded-2xl p-4 border border-[#EFEAE2] gap-0 shadow-none">
              <View className="flex-row items-center justify-between mb-1.5">
                <View>
                  <Text className="text-[14px] font-bold text-[#1C1917]">
                    Chất béo (Fat)
                  </Text>
                  <Text className="text-[12px] text-[#78716C] mt-0.5">
                    {totals.fatG.toLocaleString('vi-VN')}g
                    {targetFat != null ? ` / ${targetFat}g` : ' / Chưa đặt'}
                  </Text>
                </View>
                {fatPercent != null && (
                  <Badge variant="secondary" className="bg-[#FCE7F3] px-2 py-0.5 rounded-full border border-[#FBCFE8]">
                    <Text className="text-[11px] font-bold text-[#9D174D]">
                      {fatPercent}%
                    </Text>
                  </Badge>
                )}
              </View>
              {targetFat != null && (
                <Progress
                  value={Math.min(100, Math.max(0, fatPercent ?? 0))}
                  className="h-2 bg-[#F0EAE0] rounded-full mt-2"
                  indicatorClassName="bg-[#EC4899]"
                />
              )}
            </Card>
          </View>
        </ScrollView>

        {/* Bottom Close Button */}
        <Button
          variant="outline"
          onPress={onClose}
          className="w-full py-3.5 bg-[#FAF7F2] border border-[#EFEAE2] active:bg-[#F5F0E6] rounded-full items-center justify-center mt-3 shadow-none"
        >
          <Text className="text-[15px] font-bold text-[#1C1917]">Đóng</Text>
        </Button>
      </DrawerContent>
    </Drawer>
  );
}
