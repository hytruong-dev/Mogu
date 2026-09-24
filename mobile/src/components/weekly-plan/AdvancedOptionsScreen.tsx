/**
 * DishCreateOptionsSheet — "Tùy chọn tạo món"
 * Khớp 100% design bottom sheet (ưu tiên tự nấu / hạn chế lặp / ±kcal)
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChefHat, Info, Repeat } from 'lucide-react-native';

import { Button } from '../ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '../ui/drawer';
import { Switch } from '../ui/switch';
import { Text } from '../ui/text';

export type AdvancedOptions = {
  preferSelfCook: boolean;
  allowOutsideMeals: boolean;
  limitRepeats: boolean;
  repeatWindowDays: number;
  preferNewDishes: boolean;
  likedDishPreference: 'NONE' | 'LIGHT' | 'HIGH';
  keepLockedMeals: boolean;
  preserveLoggedDays: boolean;
  calorieTolerancePercent: 5 | 10 | 20 | 30;
};

export const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  preferSelfCook: true,
  allowOutsideMeals: true,
  limitRepeats: true,
  repeatWindowDays: 7,
  preferNewDishes: true,
  likedDishPreference: 'LIGHT',
  keepLockedMeals: true,
  preserveLoggedDays: true,
  calorieTolerancePercent: 10,
};

type Props = {
  visible: boolean;
  options: AdvancedOptions;
  onSave: (options: AdvancedOptions) => void;
  onDismiss: () => void;
};

const YELLOW = '#FFC20E';
const INK = '#111111';
const MUTED = '#8A8580';
const TOLERANCE: Array<5 | 10 | 20 | 30> = [5, 10, 20, 30];

export function DishCreateOptionsSheet({
  visible,
  options,
  onSave,
  onDismiss,
}: Props) {
  const [local, setLocal] = useState<AdvancedOptions>(options);

  useEffect(() => {
    if (visible) setLocal(options);
  }, [visible, options]);

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => !open && onDismiss()}
      snapHeight={520}
      sheetBackgroundColor="#FFFFFF"
    >
      <DrawerHeader className="px-5 pt-1 pb-2">
        <DrawerTitle className="text-[20px] font-extrabold text-[#111111]">
          Tùy chọn tạo món
        </DrawerTitle>
        <DrawerDescription className="text-[13.5px] text-[#8A8580] mt-1">
          Điều chỉnh cách Mogu chọn món phù hợp
        </DrawerDescription>
      </DrawerHeader>

      <DrawerContent className="px-5 pt-2 pb-2">
        <View style={s.row}>
          <View style={s.iconBox}>
            <ChefHat size={18} color="#B45309" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.rowTitle}>Ưu tiên món dễ tự nấu</Text>
            <Text style={s.rowDesc}>
              Ưu tiên món có công thức và nguyên liệu phù hợp
            </Text>
          </View>
          <Switch
            checked={local.preferSelfCook}
            onCheckedChange={(v) =>
              setLocal((prev) => ({ ...prev, preferSelfCook: v }))
            }
          />
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <View style={s.iconBox}>
            <Repeat size={18} color="#B45309" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={s.rowTitle}>Hạn chế lặp món</Text>
            <Text style={s.rowDesc}>
              Tránh món đã dùng trong {local.repeatWindowDays} ngày gần đây
            </Text>
          </View>
          <Switch
            checked={local.limitRepeats}
            onCheckedChange={(v) =>
              setLocal((prev) => ({ ...prev, limitRepeats: v }))
            }
          />
        </View>

        <View style={s.divider} />

        <Text style={s.flexLabel}>Độ linh hoạt năng lượng</Text>
        <View style={s.tolRow}>
          {TOLERANCE.map((t) => {
            const on = local.calorieTolerancePercent === t;
            return (
              <Pressable
                key={t}
                onPress={() =>
                  setLocal((prev) => ({ ...prev, calorieTolerancePercent: t }))
                }
                style={[s.tolChip, on && s.tolChipOn]}
              >
                <Text style={[s.tolText, on && s.tolTextOn]}>±{t}%</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.tolHint}>Mức cao hơn giúp tìm đủ món dễ hơn.</Text>

        <View style={s.infoBanner}>
          <Info size={16} color="#C2410C" strokeWidth={2.2} />
          <Text style={s.infoText}>
            Các dị ứng và nguyên liệu cần tránh luôn được giữ nguyên.
          </Text>
        </View>
      </DrawerContent>

      <DrawerFooter className="px-5 pb-5 pt-2 gap-3">
        <Button
          onPress={() => {
            onSave(local);
            onDismiss();
          }}
          className="h-[52px] w-full rounded-2xl bg-[#FFC20E] active:opacity-90"
        >
          <Text className="text-[15px] font-extrabold text-[#111111]">
            Lưu tùy chọn
          </Text>
        </Button>
        <Pressable
          onPress={() => setLocal({ ...DEFAULT_ADVANCED_OPTIONS })}
          style={s.resetLink}
        >
          <Text style={s.resetText}>Đặt lại mặc định</Text>
        </Pressable>
      </DrawerFooter>
    </Drawer>
  );
}

/** @deprecated alias */
export const AdvancedOptionsScreen = DishCreateOptionsSheet;

export function advancedOptionsSummary(opts: AdvancedOptions): string {
  const parts: string[] = [];
  if (opts.preferSelfCook) parts.push('Tự nấu');
  if (opts.limitRepeats) parts.push('Không lặp');
  parts.push(`±${opts.calorieTolerancePercent}% kcal`);
  return parts.join(' · ');
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF1D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },
  rowDesc: {
    fontSize: 12.5,
    color: MUTED,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EDE8DE',
    marginVertical: 4,
  },
  flexLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
    marginTop: 12,
    marginBottom: 10,
  },
  tolRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tolChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EAE6DF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tolChipOn: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  tolText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  tolTextOn: {
    color: INK,
    fontWeight: '800',
  },
  tolHint: {
    fontSize: 12.5,
    color: MUTED,
    marginTop: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF4E5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
    fontWeight: '500',
    lineHeight: 18,
  },
  resetLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '700',
    color: YELLOW,
  },
});
