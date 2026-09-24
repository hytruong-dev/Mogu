import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, Utensils, ChevronRight } from 'lucide-react-native';
import { FormattedMealLog, MealStatsResponse } from '../../services/api/health';
import { Card } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { AppImage } from '../../components/ui/app-image';

interface MealJournalDayViewProps {
  stats: MealStatsResponse | null;
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

const ALL_SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export function MealJournalDayView({
  stats,
  onOpenDish,
  onLogMeal,
  className = '',
}: MealJournalDayViewProps) {
  const consumedKcal = stats?.totals.kcal ?? 0;
  const targetKcal = stats?.targets.dailyKcalTarget;
  const percent = targetKcal && targetKcal > 0 ? Math.round((consumedKcal / targetKcal) * 100) : null;
  const progressPercent = percent != null ? Math.min(100, Math.max(0, percent)) : 0;

  const proteinG = stats?.totals.proteinG ?? 0;
  const carbsG = stats?.totals.carbsG ?? 0;
  const fatG = stats?.totals.fatG ?? 0;

  const targetProteinG = stats?.targets.dailyProteinG;
  const targetCarbsG = stats?.targets.dailyCarbsG;
  const targetFatG = stats?.targets.dailyFatG;

  const meals = stats?.items ?? [];

  // Group logged meal slots
  const loggedSlots = new Set(meals.map((m) => m.mealSlot));
  const unloggedSlots = ALL_SLOTS.filter((s) => !loggedSlots.has(s));

  const formatTime = (occurredAt?: string) => {
    if (!occurredAt) return '';
    try {
      const d = new Date(occurredAt);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <View className={`gap-4 ${className}`}>
      {/* 1. Summary Card */}
      <Card className="bg-white rounded-3xl p-5 border border-[#EFEAE2] shadow-xs gap-0">
        <View className="flex-row items-baseline justify-between">
          <View className="flex-row items-baseline">
            <Text className="text-[28px] font-black text-[#1C1917] tracking-tight">
              {consumedKcal.toLocaleString('vi-VN')}
            </Text>
            <Text className="text-[16px] font-medium text-[#78716C] ml-1.5">
              kcal
            </Text>
            {targetKcal != null ? (
              <Text className="text-[15px] font-semibold text-[#A8A29E] ml-2">
                / {targetKcal.toLocaleString('vi-VN')} kcal
              </Text>
            ) : (
              <Text className="text-[13px] font-medium text-[#A8A29E] ml-2">
                / Chưa đặt mục tiêu
              </Text>
            )}
          </View>

          {percent != null && (
            <Badge variant="secondary" className="bg-primary/20 px-2.5 py-1 rounded-full border border-primary/30">
              <Text className="text-[13px] font-bold text-foreground">
                {percent}%
              </Text>
            </Badge>
          )}
        </View>

        {/* Progress Bar */}
        {targetKcal != null && (
          <Progress
            value={progressPercent}
            className="h-2.5 bg-[#F5F2EB] rounded-full mt-3"
            indicatorClassName="bg-primary"
          />
        )}

        {/* Macro Columns */}
        <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-[#F5F2EB]">
          <View className="items-center flex-1">
            <Text className="text-[12px] font-medium text-[#78716C] mb-1">
              Đạm (Protein)
            </Text>
            <Text className="text-[16px] font-bold text-[#1C1917]">
              {proteinG.toLocaleString('vi-VN')}g
            </Text>
            {targetProteinG != null && (
              <Text className="text-[11px] text-[#A8A29E] mt-0.5">
                / {targetProteinG}g
              </Text>
            )}
          </View>

          <Separator orientation="vertical" className="h-8 bg-[#EFEAE2]" />

          <View className="items-center flex-1">
            <Text className="text-[12px] font-medium text-[#78716C] mb-1">
              Tinh bột (Carbs)
            </Text>
            <Text className="text-[16px] font-bold text-[#1C1917]">
              {carbsG.toLocaleString('vi-VN')}g
            </Text>
            {targetCarbsG != null && (
              <Text className="text-[11px] text-[#A8A29E] mt-0.5">
                / {targetCarbsG}g
              </Text>
            )}
          </View>

          <Separator orientation="vertical" className="h-8 bg-[#EFEAE2]" />

          <View className="items-center flex-1">
            <Text className="text-[12px] font-medium text-[#78716C] mb-1">
              Chất béo (Fat)
            </Text>
            <Text className="text-[16px] font-bold text-[#1C1917]">
              {fatG.toLocaleString('vi-VN')}g
            </Text>
            {targetFatG != null && (
              <Text className="text-[11px] text-[#A8A29E] mt-0.5">
                / {targetFatG}g
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* 2. Action: + Ghi bữa ăn button */}
      <Button
        onPress={onLogMeal}
        accessibilityLabel="Ghi bữa ăn mới"
        className="w-full h-12 bg-primary active:bg-primary/90 rounded-full flex-row items-center justify-center shadow-xs border-0"
      >
        <Plus size={20} color="#1C1917" strokeWidth={2.5} />
        <Text className="text-[16px] font-bold text-primary-foreground ml-2">
          Ghi bữa ăn
        </Text>
      </Button>

      {/* 3. Section: Bữa ăn trong ngày */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[18px] font-bold text-[#1C1917]">
            Bữa ăn trong ngày
          </Text>
          <Text className="text-[13px] font-semibold text-[#78716C]">
            {meals.length} bữa đã ghi
          </Text>
        </View>

        {meals.length === 0 ? (
          <Card className="bg-white rounded-3xl p-6 border border-[#EFEAE2] items-center justify-center py-8 gap-0 shadow-xs">
            <View className="w-14 h-14 rounded-full bg-[#FAF7F2] items-center justify-center border border-[#EFEAE2] mb-3">
              <Utensils size={24} color="#A8A29E" />
            </View>
            <Text className="text-[16px] font-bold text-[#1C1917] text-center">
              Chưa ghi bữa ăn nào hôm nay
            </Text>
            <Text className="text-[13px] text-[#78716C] text-center mt-1 px-4">
              Ghi lại món bạn đã ăn để theo dõi năng lượng và dinh dưỡng trong ngày.
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {meals.map((meal, index) => {
              const firstItem = meal.items?.[0];
              const dishId = firstItem?.referenceId;
              const dishName =
                firstItem?.displayName ?? SLOT_LABELS[meal.mealSlot] ?? 'Bữa ăn';
              const mealKcal = meal.totals?.kcal;
              const timeStr = formatTime(meal.occurredAt);
              const thumb = firstItem?.thumbnailUrl;

              return (
                <Card
                  key={meal.id || index}
                  className="bg-white rounded-2xl p-0 border border-[#EFEAE2] shadow-xs overflow-hidden gap-0"
                >
                  <Pressable
                    onPress={() => dishId && onOpenDish?.(dishId, dishName)}
                    accessibilityRole="button"
                    accessibilityLabel={`${SLOT_LABELS[meal.mealSlot]}: ${dishName}, ${mealKcal ?? 0} kcal`}
                    className="p-3.5 flex-row items-center active:bg-[#FAF8F5]"
                  >
                    {/* Thumbnail */}
                    <View className="w-14 h-14 rounded-xl bg-[#F5F2EB] border border-[#EFEAE2] overflow-hidden items-center justify-center mr-3.5">
                      {thumb ? (
                        <AppImage
                          uri={thumb}
                          className="w-full h-full"
                          contentFit="cover"
                        />
                      ) : (
                        <Utensils size={22} color="#A8A29E" />
                      )}
                    </View>

                    {/* Meal Info */}
                    <View className="flex-1 justify-center">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Text className="text-[12px] font-bold text-primary uppercase tracking-wide mr-1.5">
                            {SLOT_LABELS[meal.mealSlot] || meal.mealSlot}
                          </Text>
                          {timeStr ? (
                            <Text className="text-[12px] text-[#A8A29E] font-medium">
                              · {timeStr}
                            </Text>
                          ) : null}
                        </View>

                        {meal.sourceType === 'RANDOM' ? (
                          <Badge variant="secondary" className="bg-[#DCFCE7] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                            <Text className="text-[10px] font-bold text-[#166534]">
                              Random
                            </Text>
                          </Badge>
                        ) : meal.sourceType === 'WEEKLY_PLAN' ? (
                          <Badge variant="secondary" className="bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">
                            <Text className="text-[10px] font-bold text-foreground">
                              Kế hoạch
                            </Text>
                          </Badge>
                        ) : null}
                      </View>

                      <Text
                        numberOfLines={1}
                        className="text-[15px] font-bold text-[#1C1917] mt-0.5"
                      >
                        {dishName}
                      </Text>

                      <View className="flex-row items-center mt-1">
                        {mealKcal != null && (
                          <Text className="text-[13px] font-semibold text-[#78716C]">
                            {mealKcal.toLocaleString('vi-VN')} kcal
                          </Text>
                        )}
                        {meal.items && meal.items.length > 1 && (
                          <Text className="text-[12px] text-[#A8A29E] ml-2">
                            +{meal.items.length - 1} món khác
                          </Text>
                        )}
                      </View>
                    </View>

                    <ChevronRight size={18} color="#D6D3D1" className="ml-1" />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        {/* Unlogged Slots */}
        {unloggedSlots.length > 0 && (
          <View className="gap-2.5">
            {unloggedSlots.map((slot) => (
              <Card
                key={slot}
                className="bg-[#FAF7F2] rounded-2xl px-4 py-3 border border-dashed border-[#E5DECF] flex-row items-center justify-between gap-0 shadow-none"
              >
                <View>
                  <Text className="text-[14px] font-bold text-[#57534E]">
                    {SLOT_LABELS[slot]}
                  </Text>
                  <Text className="text-[12px] text-[#A8A29E] mt-0.5">
                    Chưa ghi lại
                  </Text>
                </View>
                <Button
                  size="icon"
                  variant="outline"
                  onPress={onLogMeal}
                  className="w-8 h-8 rounded-full bg-white border border-[#E7DFD3] items-center justify-center active:bg-primary/10 shadow-none"
                  accessibilityLabel={`Ghi ${SLOT_LABELS[slot]}`}
                >
                  <Plus size={16} color="#78716C" />
                </Button>
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
