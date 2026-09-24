import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
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
    <Card className={`bg-white rounded-2xl p-0 border border-[#EFEAE2] shadow-xs overflow-hidden gap-0 ${className}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="p-4 flex-row items-center justify-between active:bg-[#FAF8F5]"
      >
        <View className="flex-row items-center flex-1 pr-2">
          <Text className="text-[17px] font-bold text-[#1C1917] tracking-tight">
            {formattedKcal} kcal
          </Text>
          <Text className="text-[14px] text-[#A8A29E] mx-1.5 font-medium">·</Text>
          <Text className="text-[14px] font-medium text-[#44403C]">
            {daysLogged} ngày
          </Text>
          <Text className="text-[14px] text-[#A8A29E] mx-1.5 font-medium">·</Text>
          <Text className="text-[14px] font-medium text-[#44403C]">
            {totalMeals} bữa
          </Text>
        </View>
        <View className="w-8 h-8 rounded-full bg-[#FAF7F2] items-center justify-center border border-[#EFEAE2]">
          <ChevronRight size={18} color="#78716C" />
        </View>
      </Pressable>
    </Card>
  );
}
