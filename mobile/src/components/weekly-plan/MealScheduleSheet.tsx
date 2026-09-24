/**
 * MealScheduleSheet — khớp 100% design Lịch ăn (chips thời lượng + checkbox bên phải)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Apple,
  Check,
  Moon,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';

import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Text } from '../ui/text';
import type { WeeklyMealSlot } from '../../services/api/types';

export type MealSlotDraft = {
  type: WeeklyMealSlot;
  enabled: boolean;
  time: string | null;
};

export type ScheduleDraft = {
  startDate: string;
  durationDays: number;
  mealSlots: MealSlotDraft[];
};

type Props = {
  visible: boolean;
  value: ScheduleDraft;
  onApply: (draft: ScheduleDraft) => void;
  onDismiss: () => void;
};

const YELLOW = '#FFC20E';
const INK = '#111111';
const MUTED = '#8A8580';
const BORDER = '#EAE6DF';

const DURATION_OPTIONS = [3, 5, 7, 14] as const;

const SLOT_META: Record<
  WeeklyMealSlot,
  { label: string; Icon: typeof Sun }
> = {
  MORNING: { label: 'Bữa sáng', Icon: Sun },
  LUNCH: { label: 'Bữa trưa', Icon: UtensilsCrossed },
  DINNER: { label: 'Bữa tối', Icon: Moon },
  SNACK: { label: 'Bữa phụ', Icon: Apple },
};

const SLOT_ORDER: WeeklyMealSlot[] = ['MORNING', 'LUNCH', 'DINNER', 'SNACK'];

const DEFAULT_SLOTS: MealSlotDraft[] = [
  { type: 'MORNING', enabled: true, time: '07:00' },
  { type: 'LUNCH', enabled: true, time: '12:00' },
  { type: 'DINNER', enabled: true, time: '18:30' },
  { type: 'SNACK', enabled: false, time: null },
];

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string) {
  const [, m, day] = iso.split('-');
  return `${day}/${m}`;
}

function cloneDraft(d: ScheduleDraft): ScheduleDraft {
  return {
    startDate: d.startDate,
    durationDays: d.durationDays,
    mealSlots: d.mealSlots.map((s) => ({ ...s })),
  };
}

function draftsEqual(a: ScheduleDraft, b: ScheduleDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function defaultScheduleDraft(startDate: string): ScheduleDraft {
  return {
    startDate,
    durationDays: 7,
    mealSlots: DEFAULT_SLOTS.map((s) => ({ ...s })),
  };
}

export function MealScheduleSheet({ visible, value, onApply, onDismiss }: Props) {
  const [draft, setDraft] = useState(() => cloneDraft(value));
  const [baseline, setBaseline] = useState(() => cloneDraft(value));
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next = cloneDraft(value);
    setDraft(next);
    setBaseline(next);
    setDiscardOpen(false);
  }, [visible, value]);

  const enabledCount = draft.mealSlots.filter((s) => s.enabled).length;
  const totalMeals = draft.durationDays * enabledCount;
  const endDate = addDaysISO(draft.startDate, draft.durationDays - 1);
  const dirty = !draftsEqual(draft, baseline);

  const orderedSlots = useMemo(() => {
    const map = new Map(draft.mealSlots.map((s) => [s.type, s]));
    return SLOT_ORDER.map(
      (type) => map.get(type) ?? { type, enabled: false, time: null },
    );
  }, [draft.mealSlots]);

  const requestClose = () => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onDismiss();
  };

  const toggleSlot = (type: WeeklyMealSlot) => {
    setDraft((prev) => {
      const nextSlots = prev.mealSlots.map((s) =>
        s.type === type ? { ...s, enabled: !s.enabled } : s,
      );
      if (!nextSlots.some((s) => s.enabled)) return prev;
      return { ...prev, mealSlots: nextSlots };
    });
  };

  return (
    <>
      <Drawer
        open={visible}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        snapHeight={580}
        sheetBackgroundColor="#FFFFFF"
      >
        <DrawerHeader className="px-5 pt-1 pb-2 flex-row items-center justify-between">
          <DrawerTitle className="text-[20px] font-extrabold text-[#111111]">
            Lịch ăn
          </DrawerTitle>
          <Pressable onPress={requestClose} hitSlop={10} style={s.closeBtn}>
            <X size={20} color={MUTED} strokeWidth={2.4} />
          </Pressable>
        </DrawerHeader>

        <DrawerContent className="px-5 pt-1 pb-2">
          <Text style={s.sectionLabel}>Thời lượng</Text>
          <View style={s.chipRow}>
            {DURATION_OPTIONS.map((d) => {
              const on = draft.durationDays === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDraft((prev) => ({ ...prev, durationDays: d }))}
                  style={[s.durationChip, on && s.durationChipOn]}
                >
                  <Text style={[s.durationChipText, on && s.durationChipTextOn]}>
                    {d} ngày
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.dateRange}>
            {formatShort(draft.startDate)} – {formatShort(endDate)}
          </Text>

          <Text style={[s.sectionLabel, { marginTop: 18 }]}>
            Chọn các bữa mỗi ngày
          </Text>
          <View style={s.slotList}>
            {orderedSlots.map((slot) => {
              const meta = SLOT_META[slot.type];
              const Icon = meta.Icon;
              const on = slot.enabled;
              return (
                <Pressable
                  key={slot.type}
                  onPress={() => toggleSlot(slot.type)}
                  style={s.slotCard}
                >
                  <View style={s.slotIcon}>
                    <Icon size={18} color={on ? '#B45309' : MUTED} strokeWidth={2.2} />
                  </View>
                  <Text style={[s.slotLabel, on && s.slotLabelOn]}>{meta.label}</Text>
                  <View style={[s.checkBox, on && s.checkBoxOn]}>
                    {on && <Check size={14} color={INK} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={s.summaryBox}>
            <Text style={s.summaryTitle}>{totalMeals} bữa sẽ được tạo</Text>
            <Text style={s.summarySub}>
              {enabledCount} bữa × {draft.durationDays} ngày
            </Text>
          </View>
        </DrawerContent>

        <DrawerFooter className="px-5 pb-5 pt-2 gap-3">
          <Button
            onPress={() => {
              if (enabledCount === 0) return;
              onApply(draft);
              onDismiss();
            }}
            disabled={enabledCount === 0}
            className="h-[52px] w-full rounded-2xl bg-[#FFC20E] active:opacity-90"
          >
            <Text className="text-[15px] font-extrabold text-[#111111]">
              Áp dụng lịch ăn
            </Text>
          </Button>
          <Pressable
            onPress={() =>
              setDraft({
                ...draft,
                durationDays: 7,
                mealSlots: DEFAULT_SLOTS.map((s) => ({ ...s })),
              })
            }
            style={s.resetLink}
          >
            <Text style={s.resetText}>Khôi phục mặc định</Text>
          </Pressable>
        </DrawerFooter>
      </Drawer>

      <ConfirmDialog
        visible={discardOpen}
        title="Bỏ thay đổi lịch ăn?"
        description="Bạn có thay đổi chưa áp dụng. Đóng sheet sẽ hủy các chỉnh sửa này."
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Tiếp tục chỉnh"
        tone="warning"
        onConfirm={() => {
          setDiscardOpen(false);
          setDraft(cloneDraft(baseline));
          onDismiss();
        }}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipOn: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  durationChipTextOn: {
    color: INK,
    fontWeight: '800',
  },
  dateRange: {
    textAlign: 'center',
    fontSize: 13,
    color: MUTED,
    marginTop: 10,
  },
  slotList: {
    gap: 8,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    gap: 12,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: MUTED,
  },
  slotLabelOn: {
    color: INK,
    fontWeight: '700',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#D4CEBF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  summaryBox: {
    marginTop: 14,
    backgroundColor: '#FFF8DC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  summarySub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  resetLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
    color: MUTED,
  },
});
