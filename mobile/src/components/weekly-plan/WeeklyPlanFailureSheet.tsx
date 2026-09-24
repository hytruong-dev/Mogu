/**
 * WeeklyPlanFailureSheet — Trạng thái thất bại khi tạo thực đơn tuần
 * Khớp 100% với giao diện mockup (Image 1)
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ChevronRight,
  Coins,
  CookingPot,
  Leaf,
  Sparkles,
  TriangleAlert,
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
import type { WeeklyPlanGenerationErrorData, WeeklyPlanSuggestion } from '../../services/api/types';
import { trackWeeklyPlanEvent } from '../../lib/weekly-plan-analytics';

type Props = {
  visible: boolean;
  errorData?: WeeklyPlanGenerationErrorData | null;
  onAdjustConfig: (focus?: 'budget' | 'mealSlot' | 'avoided') => void;
  onViewApprovedDishes?: () => void;
  onDismiss: () => void;
};

type SuggestionRow = {
  type: string;
  label: React.ReactNode;
  Icon: typeof Coins;
  focus?: 'budget' | 'mealSlot' | 'avoided';
};

function buildRows(suggestions?: WeeklyPlanSuggestion[]): SuggestionRow[] {
  const source =
    suggestions && suggestions.length > 0
      ? suggestions
      : [
          { type: 'MIN_BUDGET', value: 350000 },
          { type: 'ENABLE_MEAL_SLOT', value: 'SNACK' },
          { type: 'REVIEW_AVOIDED_INGREDIENTS' },
        ];

  return source.map((s) => {
    if (s.type === 'MIN_BUDGET') {
      const val =
        typeof s.value === 'number'
          ? `${s.value.toLocaleString('vi-VN')}đ`
          : '350.000đ';
      return {
        type: s.type,
        Icon: Coins,
        focus: 'budget' as const,
        label: (
          <Text style={rowStyles.label}>
            Tăng ngân sách lên <Text style={rowStyles.bold}>{val}</Text>
          </Text>
        ),
      };
    }
    if (s.type === 'ENABLE_MEAL_SLOT') {
      return {
        type: s.type,
        Icon: CookingPot,
        focus: 'mealSlot' as const,
        label: (
          <Text style={rowStyles.label}>
            Bật thêm <Text style={rowStyles.bold}>Bữa phụ</Text>
          </Text>
        ),
      };
    }
    return {
      type: s.type,
      Icon: Leaf,
      focus: 'avoided' as const,
      label: (
        <Text style={rowStyles.label}>Nới lỏng nguyên liệu cần tránh</Text>
      ),
    };
  });
}

const rowStyles = StyleSheet.create({
  label: {
    fontSize: 14.5,
    color: '#3F3B35',
    fontWeight: '500',
  },
  bold: {
    fontWeight: '800',
    color: '#111111',
  },
});

export function WeeklyPlanFailureSheet({
  visible,
  errorData,
  onAdjustConfig,
  onViewApprovedDishes,
  onDismiss,
}: Props) {
  const rows = buildRows(errorData?.suggestions);
  const reasonMessage =
    errorData?.message ??
    'Kho món hiện chưa đủ lựa chọn phù hợp với cấu hình này.';

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => !open && onDismiss()}
      snapHeight={550}
      sheetBackgroundColor="#FFFFFF"
    >
      <DrawerHeader className="items-center px-5 pt-1 pb-0">
        {/* Warning Icon Container with decorative elements */}
        <View style={s.iconWrapper}>
          <View style={s.sparkLeft}>
            <Sparkles size={12} color="#F97316" />
          </View>
          <View style={s.sparkRight}>
            <Sparkles size={14} color="#F59E0B" />
          </View>
          <View style={s.iconCircle}>
            <TriangleAlert size={32} color="#DC2626" strokeWidth={2.4} />
          </View>
        </View>

        <DrawerTitle className="text-[20px] font-extrabold text-[#111111] text-center mt-3">
          Chưa thể tạo thực đơn
        </DrawerTitle>
        <Text className="text-[14px] text-[#6B6862] text-center mt-1 px-4 leading-5">
          {reasonMessage}
        </Text>
      </DrawerHeader>

      <DrawerContent className="px-5 pt-4 pb-2">
        <View style={s.suggestionsCard}>
          <Text style={s.cardTitle}>Bạn có thể thử:</Text>
          <View style={s.cardRows}>
            {rows.map((row, idx) => {
              const Icon = row.Icon;
              return (
                <React.Fragment key={`${row.type}-${idx}`}>
                  {idx > 0 && <View style={s.rowDivider} />}
                  <Pressable
                    onPress={() => {
                      trackWeeklyPlanEvent({
                        name: 'weekly_plan_recovery_selected',
                        payload: { type: row.type },
                      });
                      onAdjustConfig(row.focus);
                    }}
                    style={s.suggestionRow}
                  >
                    <View style={s.rowIcon}>
                      <Icon size={18} color="#B45309" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>{row.label}</View>
                    <ChevronRight size={18} color="#9CA3AF" strokeWidth={2.2} />
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </DrawerContent>

      <DrawerFooter className="px-5 pb-6 pt-1 gap-2.5">
        <Button
          onPress={() => {
            trackWeeklyPlanEvent({
              name: 'weekly_plan_recovery_selected',
              payload: { type: 'ADJUST_CONFIG' },
            });
            onAdjustConfig(rows[0]?.focus);
          }}
          className="h-[52px] w-full rounded-2xl bg-[#FFC20E] active:opacity-90 shadow-none"
        >
          <Text className="text-[15px] font-extrabold text-[#111111]">
            Điều chỉnh cấu hình
          </Text>
        </Button>

        {onViewApprovedDishes && (
          <Button
            variant="outline"
            onPress={() => {
              trackWeeklyPlanEvent({
                name: 'weekly_plan_recovery_selected',
                payload: { type: 'VIEW_APPROVED_DISHES' },
              });
              onViewApprovedDishes();
            }}
            className="h-[52px] w-full rounded-2xl border-[#E5E7EB] bg-white active:bg-neutral-50 shadow-none"
          >
            <Text className="text-[15px] font-bold text-[#111111]">
              Xem kho món đã duyệt
            </Text>
          </Button>
        )}

        <Pressable onPress={onDismiss} style={s.dismissBtn} hitSlop={10}>
          <Text className="text-[14px] font-semibold text-[#8A8580] text-center">
            Để sau
          </Text>
        </Pressable>
      </DrawerFooter>
    </Drawer>
  );
}

const s = StyleSheet.create({
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sparkLeft: {
    position: 'absolute',
    left: -12,
    top: 10,
  },
  sparkRight: {
    position: 'absolute',
    right: -12,
    top: 6,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsCard: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#F3EFE6',
    borderRadius: 20,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  cardRows: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3EFE6',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F3EFE6',
    marginLeft: 52,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
});
