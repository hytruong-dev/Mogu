import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from '@/components/icons';
import { Card } from '../../components/ui/card';

interface JournalSummaryStripProps {
  kcal: number;
  daysLogged: number;
  totalMeals: number;
  onPress: () => void;
  className?: string;
  accessibilityLabel?: string;
}

export function JournalSummaryStrip({
  kcal,
  daysLogged,
  totalMeals,
  onPress,
  className = '',
  accessibilityLabel = 'Mở chi tiết dinh dưỡng',
}: JournalSummaryStripProps) {
  const formattedKcal = (kcal || 0).toLocaleString('vi-VN');

  return (
    <Card className={`bg-card rounded-2xl p-0 border border-border shadow-xs overflow-hidden gap-0 ${className}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="p-4 flex-row items-center justify-between active:bg-muted"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <Text className="text-[17px] font-bold text-foreground tracking-tight">
            {formattedKcal} kcal
          </Text>
          <Text className="text-[14px] text-muted-foreground mx-1.5 font-medium">·</Text>
          <Text className="text-[14px] font-medium text-foreground/80">
            {daysLogged} ngày
          </Text>
          <Text className="text-[14px] text-muted-foreground mx-1.5 font-medium">·</Text>
          <Text className="text-[14px] font-medium text-foreground/80">
            {totalMeals} bữa
          </Text>
        </View>
        <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center border border-border">
          <ChevronRight size={18} color="#78716C" />
        </View>
      </Pressable>
    </Card>
  );
}
