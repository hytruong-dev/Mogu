/**
 * WeeklyPlanSuccessSheet — Trạng thái tạo thực đơn tuần thành công
 * Khớp 100% với giao diện mockup (Image 2)
 */
import React from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import {
  Calendar,
  Check,
  ChevronRight,
  Coins,
  Share2,
  UtensilsCrossed,
} from 'lucide-react-native';

import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Text } from '../ui/text';
import { trackWeeklyPlanEvent } from '../../lib/weekly-plan-analytics';

export type WeeklyPlanSuccessData = {
  planId: string;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  mealCount: number;
  estimatedBudget: number;
  targetKcalPerDay?: number;
};

type Props = {
  visible: boolean;
  data: WeeklyPlanSuccessData | null;
  onViewPlan: (planId: string) => void;
  onGoHome: () => void;
  onDismiss: () => void;
};

export function WeeklyPlanSuccessSheet({
  visible,
  data,
  onViewPlan,
  onGoHome,
  onDismiss,
}: Props) {
  if (!data) return null;

  const formatDateShort = (iso?: string) => {
    if (!iso) return '';
    const parts = iso.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return iso;
  };

  const startFormatted = formatDateShort(data.startDate);
  const budgetK =
    data.estimatedBudget >= 1000
      ? `≈ ${Math.round(data.estimatedBudget / 1000)}K`
      : `≈ ${data.estimatedBudget}`;

  const handleShare = async () => {
    try {
      trackWeeklyPlanEvent({
        name: 'weekly_plan_shared',
        payload: { planId: data.planId },
      });
      await Share.share({
        title: 'Thực đơn tuần Mogu của tôi',
        message: `Tôi vừa lên thực đơn tuần mới trên Mogu: ${data.durationDays} ngày, ${data.mealCount} bữa · https://mogu.app/plans/${data.planId}`,
      });
    } catch {
      // ignored
    }
  };

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      snapHeight={550}
      sheetBackgroundColor="#FFFFFF"
    >
      <DrawerHeader className="items-center px-5 pt-1 pb-0">
        {/* Success Icon Cloud Badge */}
        <View style={s.heroWrap}>
          <View style={s.cloudBg}>
            <View style={s.floatTomato} />
            <View style={s.floatBroccoli} />
            <View style={s.iconCircle}>
              <Check size={32} color="#FFFFFF" strokeWidth={3.2} />
            </View>
          </View>
        </View>

        <DrawerTitle className="text-[20px] font-extrabold text-[#111111] text-center mt-2">
          Thực đơn tuần đã sẵn sàng
        </DrawerTitle>
        <Text className="text-[14px] text-[#6B6862] text-center mt-1 px-4 leading-5">
          {data.mealCount} bữa đã được cân đối theo ngân sách và mục tiêu của bạn.
        </Text>
      </DrawerHeader>

      <DrawerContent className="px-5 pt-4 pb-2">
        {/* 3-Column Metric Card */}
        <View style={s.summaryGrid}>
          <View style={s.gridCol}>
            <View style={s.colIconBox}>
              <Calendar size={18} color="#D97706" strokeWidth={2.2} />
            </View>
            <Text style={s.gridValue}>{data.durationDays} ngày</Text>
            <Text style={s.gridLabel}>Thời gian</Text>
          </View>

          <View style={s.gridCol}>
            <View style={s.colIconBox}>
              <UtensilsCrossed size={18} color="#D97706" strokeWidth={2.2} />
            </View>
            <Text style={s.gridValue}>{data.mealCount} bữa</Text>
            <Text style={s.gridLabel}>Tổng số bữa</Text>
          </View>

          <View style={s.gridCol}>
            <View style={s.colIconBox}>
              <Coins size={18} color="#D97706" strokeWidth={2.2} />
            </View>
            <Text style={s.gridValue}>{budgetK}</Text>
            <Text style={s.gridLabel}>Ngân sách ước tính</Text>
          </View>
        </View>

        {/* Start date row */}
        {!!startFormatted && (
          <View style={s.startRow}>
            <Calendar size={16} color="#111111" strokeWidth={2.2} />
            <Text style={s.startText}>Bắt đầu từ {startFormatted}</Text>
          </View>
        )}
      </DrawerContent>

      <DrawerFooter className="px-5 pb-6 pt-1 gap-2.5">
        <Button
          onPress={() => onViewPlan(data.planId)}
          className="h-[52px] w-full flex-row items-center justify-center gap-1 rounded-2xl bg-[#FFC20E] active:opacity-90 shadow-none"
        >
          <Text className="text-[15px] font-extrabold text-[#111111]">
            Xem thực đơn
          </Text>
          <ChevronRight size={18} color="#111111" strokeWidth={2.5} />
        </Button>

        <Button
          variant="outline"
          onPress={onGoHome}
          className="h-[52px] w-full rounded-2xl border-[#E5E7EB] bg-white active:bg-neutral-50 shadow-none"
        >
          <Text className="text-[15px] font-bold text-[#111111]">Về trang chủ</Text>
        </Button>

        <Pressable onPress={handleShare} style={s.shareRow} hitSlop={10}>
          <Share2 size={16} color="#8A8580" strokeWidth={2.2} />
          <Text style={s.shareText}>Chia sẻ kế hoạch</Text>
        </Pressable>
      </DrawerFooter>
    </Drawer>
  );
}

const s = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cloudBg: {
    width: 140,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  floatTomato: {
    position: 'absolute',
    left: 12,
    bottom: 16,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  floatBroccoli: {
    position: 'absolute',
    right: 14,
    top: 16,
    width: 16,
    height: 18,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#F3EFE6',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  gridCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  gridLabel: {
    fontSize: 11.5,
    color: '#8A8580',
    marginTop: 2,
    fontWeight: '500',
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  startText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8580',
  },
});
