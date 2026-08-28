/**
 * EditPlanScreen — Man hinh "Chinh ke hoach"
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, Settings2 } from 'lucide-react-native';
import {
  upsertWeeklyPlanConfig,
  generateWeeklyPlan,
  getWeeklyPlanConfig,
  getCurrentWeeklyPlan,
} from '../services/api/weekly-plan';
import type { WeeklyMealSlot } from '../services/api/types';

const CREAM  = '#F7F2E8';
const WHITE  = '#FFFFFF';
const INK    = '#111111';
const YELLOW = '#FFC51A';
const MUTED  = '#999';
const BORDER = '#EDE5D2';

type Props = {
  onBack: () => void;
  onReset?: () => void;
  onSave?: (plan: PlanConfig) => void;
};

export type PlanConfig = {
  budget: number;
  kcalPerDay: number;
  kcalMode: 'profile' | 'custom';
  days: number;
  mealsPerDay: number;
  mealSlots: { sang: boolean; trua: boolean; toi: boolean; phu: boolean };
};

const DAYS_OPTIONS = [3, 5, 7, 14];
const MEALS_OPTIONS = [2, 3, 4];
const BUDGET_STEP = 50000;
const BUDGET_MIN = 100000;
const BUDGET_MAX = 5000000;
const KCAL_STEP = 50;
const KCAL_MIN = 1000;
const KCAL_MAX = 5000;

// DropdownModal — hien thi tren cung, khong bi che boi cac card khac
function DropdownModal({
  visible,
  options,
  selectedIdx,
  onSelect,
  onClose,
  anchorY,
  anchorX,
  width,
}: {
  visible: boolean;
  options: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
  anchorY: number;
  anchorX: number;
  width: number;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            top: anchorY,
            left: anchorX,
            width,
            backgroundColor: WHITE,
            borderRadius: 13,
            borderWidth: 1.5,
            borderColor: BORDER,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 10,
            overflow: 'hidden',
          }}
        >
          {options.map((opt, idx) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(idx); onClose(); }}
              style={[
                s.dropdownItem,
                selectedIdx === idx && s.dropdownItemActive,
                idx < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F3EDD8' },
              ]}
            >
              <Text style={[s.dropdownItemText, selectedIdx === idx && s.dropdownItemTextActive]}>
                {opt}
              </Text>
              {selectedIdx === idx && (
                <Text style={{ fontSize: 14, color: YELLOW }}>&#10003;</Text>
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

export function EditPlanScreen({ onBack, onReset, onSave }: Props) {
  const [budget, setBudget] = useState(500000);
  const [kcal, setKcal] = useState(2000);
  const [kcalMode, setKcalMode] = useState<'profile' | 'custom'>('profile');
  const [days, setDays] = useState(7);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [daysOpen, setDaysOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [daysAnchor, setDaysAnchor] = useState({ x: 0, y: 0, width: 0 });
  const [mealsAnchor, setMealsAnchor] = useState({ x: 0, y: 0, width: 0 });
  const [mealSlots, setMealSlots] = useState({
    sang: true, trua: true, toi: true, phu: false,
  });
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ── Load existing config + plan stats từ API ─────────────────────────────
  const [statsBar, setStatsBar] = useState({ days: 7, spent: 0, budget: 500000, kcal: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [config, plan] = await Promise.allSettled([
          getWeeklyPlanConfig(),
          getCurrentWeeklyPlan(),
        ]);

        if (config.status === 'fulfilled' && config.value) {
          const c = config.value;
          setBudget(c.budgetVnd ?? 500000);
          setKcal(c.kcalPerDay ?? 2000);
          setKcalMode(c.kcalMode === 'CUSTOM' ? 'custom' : 'profile');
          setDays(c.durationDays ?? 7);
          setMealsPerDay(c.mealsPerDay ?? 3);
          const slots = c.enabledSlots ?? ['MORNING', 'LUNCH', 'DINNER'];
          setMealSlots({
            sang: slots.includes('MORNING'),
            trua: slots.includes('LUNCH'),
            toi:  slots.includes('DINNER'),
            phu:  slots.includes('SNACK'),
          });
        }

        if (plan.status === 'fulfilled' && plan.value) {
          const p = plan.value;
          const d = Math.round(
            (new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000,
          );
          setStatsBar({
            days: d,
            spent: Math.round(Math.max(p.actualSpentVnd, p.projectedCostVnd) / 1000),
            budget: Math.round(p.budgetLimitVnd / 1000),
            kcal: Math.round((p.actualKcal || p.projectedKcal) / 1000),
          });
        }
      } catch {
        // Giữ giá trị mặc định
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const daysRef = useRef<View>(null);
  const mealsRef = useRef<View>(null);

  const toggleSlot = (slot: keyof typeof mealSlots) => {
    setMealSlots(prev => ({ ...prev, [slot]: !prev[slot] }));
  };

  const handleSave = async () => {
    // Map local mealSlots to API WeeklyMealSlot[]
    const enabledSlots: WeeklyMealSlot[] = [];
    if (mealSlots.sang) enabledSlots.push('MORNING');
    if (mealSlots.trua) enabledSlots.push('LUNCH');
    if (mealSlots.toi) enabledSlots.push('DINNER');
    if (mealSlots.phu) enabledSlots.push('SNACK');

    if (enabledSlots.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một bữa ăn.');
      return;
    }

    setSaving(true);
    try {
      // 1. Save config
      await upsertWeeklyPlanConfig({
        budgetVnd: budget,
        kcalPerDay: kcal,
        kcalMode: kcalMode === 'profile' ? 'PROFILE' : 'CUSTOM',
        durationDays: days,
        mealsPerDay,
        enabledSlots,
        avoidRepeat: true,
      });

      // 2. Generate a new plan starting from next Monday (or today)
      const startDate = getNextStartDate();
      await generateWeeklyPlan(startDate);

      // 3. Notify parent
      onSave?.({ budget, kcalPerDay: kcal, kcalMode, days, mealsPerDay, mealSlots });
      onBack();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message ?? 'Không thể lưu kế hoạch. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  /** Get ISO date for start: today or next available */
  function getNextStartDate(): string {
    const d = new Date();
    // Use today as start date
    return d.toISOString().split('T')[0];
  }

  const openDays = () => {
    daysRef.current?.measureInWindow((x, y, width, height) => {
      setDaysAnchor({ x, y: y + height + 4, width });
      setDaysOpen(true);
      setMealsOpen(false);
    });
  };

  const openMeals = () => {
    mealsRef.current?.measureInWindow((x, y, width, height) => {
      setMealsAnchor({ x, y: y + height + 4, width });
      setMealsOpen(true);
      setDaysOpen(false);
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Chỉnh kế hoạch</Text>
        <Pressable onPress={onReset} style={s.resetBtn} hitSlop={8}>
          <Text style={s.resetText}>Đặt lại</Text>
        </Pressable>
      </View>

      {/* Stats bar — dữ liệu từ API */}
      <View style={s.statsBar}>
        {loadingConfig ? (
          <ActivityIndicator size="small" color={YELLOW} />
        ) : (
          <>
            <Text style={s.statsItem}>{days} ngày · {days * mealsPerDay} bữa</Text>
            <View style={s.statsDivider} />
            <Text style={s.statsItem}>{statsBar.spent > 0 ? `${statsBar.spent}K / ${statsBar.budget}K` : `${Math.round(budget / 1000)}K`}</Text>
            <View style={s.statsDivider} />
            <Text style={s.statsItem}>{statsBar.kcal > 0 ? `${(statsBar.kcal * 1000).toLocaleString('vi-VN')} kcal` : `${kcal.toLocaleString('vi-VN')} kcal/ngày`}</Text>
          </>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ngan sach tuan */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Ngân sách tuần</Text>
          <View style={s.stepperRow}>
            <Pressable
              onPress={() => setBudget(prev => Math.max(BUDGET_MIN, prev - BUDGET_STEP))}
              style={s.stepperBtn}
            >
              <Text style={s.stepperBtnText}>{'−'}</Text>
            </Pressable>
            <View style={s.stepperValue}>
              <Text style={s.stepperNumber}>
                {budget.toLocaleString('vi-VN')}
                <Text style={s.stepperUnit}> đ</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setBudget(prev => Math.min(BUDGET_MAX, prev + BUDGET_STEP))}
              style={s.stepperBtn}
            >
              <Text style={s.stepperBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={s.estimatedHint}>
            Dự kiến còn{' '}
            <Text style={{ color: '#16A34A', fontWeight: '700' }}>
              {Math.max(0, Math.round((budget - (statsBar.spent > 0 ? statsBar.spent * 1000 : 0)) / 1000))}K
            </Text>
          </Text>
        </View>

        {/* Nang luong moi ngay */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Năng lượng mỗi ngày</Text>
          <View style={s.stepperRow}>
            <Pressable
              onPress={() => setKcal(prev => Math.max(KCAL_MIN, prev - KCAL_STEP))}
              style={s.stepperBtn}
            >
              <Text style={s.stepperBtnText}>{'−'}</Text>
            </Pressable>
            <View style={s.stepperValue}>
              <Text style={s.stepperNumber}>
                {kcal.toLocaleString('vi-VN')}
                <Text style={s.stepperUnit}> kcal</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setKcal(prev => Math.min(KCAL_MAX, prev + KCAL_STEP))}
              style={s.stepperBtn}
            >
              <Text style={s.stepperBtnText}>+</Text>
            </Pressable>
          </View>
          {/* Toggle */}
          <View style={s.modeToggle}>
            <Pressable
              onPress={() => setKcalMode('profile')}
              style={[s.modeBtn, kcalMode === 'profile' && s.modeBtnActive]}
            >
              <Text style={[s.modeBtnText, kcalMode === 'profile' && s.modeBtnTextActive]}>
                Theo hồ sơ
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setKcalMode('custom')}
              style={[s.modeBtn, kcalMode === 'custom' && s.modeBtnActive]}
            >
              <Text style={[s.modeBtnText, kcalMode === 'custom' && s.modeBtnTextActive]}>
                Tự đặt
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Lich an */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Lịch ăn</Text>

          {/* Dropdowns row */}
          <View style={s.dropdownRow}>
            {/* So ngay */}
            <View ref={daysRef} style={{ flex: 1 }}>
              <Pressable onPress={openDays} style={[s.dropdown, daysOpen && s.dropdownOpen]}>
                <Text style={s.dropdownText}>{days} ngày</Text>
                <ChevronDown
                  size={16}
                  color={MUTED}
                  style={daysOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </Pressable>
            </View>

            {/* So bua/ngay */}
            <View ref={mealsRef} style={{ flex: 1 }}>
              <Pressable onPress={openMeals} style={[s.dropdown, mealsOpen && s.dropdownOpen]}>
                <Text style={s.dropdownText}>{mealsPerDay} bữa/ngày</Text>
                <ChevronDown
                  size={16}
                  color={MUTED}
                  style={mealsOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </Pressable>
            </View>
          </View>

          {/* Meal slot checkboxes */}
          <View style={s.slotsRow}>
            {[
              { key: 'sang', label: 'Sáng' },
              { key: 'trua', label: 'Trưa' },
              { key: 'toi', label: 'Tối' },
              { key: 'phu', label: 'Bữa phụ' },
            ].map(({ key, label }) => {
              const checked = mealSlots[key as keyof typeof mealSlots];
              return (
                <Pressable
                  key={key}
                  onPress={() => toggleSlot(key as keyof typeof mealSlots)}
                  style={[s.slotChip, checked && s.slotChipActive]}
                >
                  {checked ? (
                    <View style={s.slotCheck}>
                      <Text style={{ fontSize: 10, color: WHITE, fontWeight: '800' }}>{'✓'}</Text>
                    </View>
                  ) : (
                    <View style={s.slotCircle} />
                  )}
                  <Text style={[s.slotText, checked && s.slotTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tuy chon them */}
        <Pressable style={s.moreOption}>
          <View style={s.moreOptionIcon}>
            <Settings2 size={18} color="#555" strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.moreOptionTitle}>Tuỳ chọn thêm</Text>
            <Text style={s.moreOptionSub}>Tự nấu · Hạn chế lặp món · Giữ món đã chọn</Text>
          </View>
          <Text style={{ color: MUTED, fontSize: 18 }}>{'›'}</Text>
        </Pressable>

        {/* Info */}
        <View style={s.infoBox}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>{'ℹ️'}</Text>
          <Text style={s.infoText}>Mogu sẽ cân đối lại các bữa chưa khóa.</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity activeOpacity={0.87} onPress={handleSave} style={[s.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#111" />
            : <Text style={s.saveBtnText}>Lưu thay đổi</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>Huỷ</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Modals — hien thi tren cung, khong bi che */}
      <DropdownModal
        visible={daysOpen}
        options={DAYS_OPTIONS.map(d => `${d} ngày`)}
        selectedIdx={DAYS_OPTIONS.indexOf(days)}
        onSelect={idx => setDays(DAYS_OPTIONS[idx])}
        onClose={() => setDaysOpen(false)}
        anchorY={daysAnchor.y}
        anchorX={daysAnchor.x}
        width={daysAnchor.width}
      />
      <DropdownModal
        visible={mealsOpen}
        options={MEALS_OPTIONS.map(m => `${m} bữa/ngày`)}
        selectedIdx={MEALS_OPTIONS.indexOf(mealsPerDay)}
        onSelect={idx => setMealsPerDay(MEALS_OPTIONS[idx])}
        onClose={() => setMealsOpen(false)}
        anchorY={mealsAnchor.y}
        anchorX={mealsAnchor.x}
        width={mealsAnchor.width}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },

  header: {
    height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: CREAM,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  resetBtn: { width: 60, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  resetText: { fontSize: 14, fontWeight: '600', color: '#C08000' },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: WHITE, paddingVertical: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  statsItem: { fontSize: 13, fontWeight: '600', color: '#444' },
  statsDivider: { width: 1, height: 14, backgroundColor: '#E0D8C8' },

  scrollContent: { padding: 16, gap: 14, paddingBottom: 120 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 18, padding: 18,
    shadowColor: '#B19B66', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardLabel: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 4 },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10,
  },
  stepperBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 24, color: '#555', fontWeight: '300', lineHeight: 28 },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperNumber: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -1 },
  stepperUnit: { fontSize: 16, fontWeight: '500', color: MUTED },

  estimatedHint: { textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 8 },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: 13, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#E0D8C8',
    marginTop: 14,
  },
  modeBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },
  modeBtnActive: { backgroundColor: YELLOW },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: MUTED },
  modeBtnTextActive: { color: INK, fontWeight: '700' },

  dropdownRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dropdown: {
    height: 46, borderRadius: 13,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: '#FAFAFA',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 6,
  },
  dropdownOpen: { borderColor: YELLOW, backgroundColor: '#FFFCE8' },
  dropdownText: { flex: 1, fontSize: 14, fontWeight: '600', color: INK },
  dropdownItem: {
    paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownItemActive: { backgroundColor: '#FFFAE0' },
  dropdownItemText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownItemTextActive: { color: '#C08000', fontWeight: '700' },

  slotsRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: WHITE,
  },
  slotChipActive: { backgroundColor: '#FFF9E0', borderColor: '#F0C040' },
  slotCheck: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  slotCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#CCC', backgroundColor: WHITE },
  slotText: { fontSize: 13, fontWeight: '600', color: MUTED },
  slotTextActive: { color: INK },

  moreOption: {
    backgroundColor: WHITE, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#B19B66', shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  moreOptionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center',
  },
  moreOptionTitle: { fontSize: 14, fontWeight: '700', color: INK },
  moreOptionSub: { fontSize: 12, color: MUTED, marginTop: 2 },

  infoBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E8E0D0',
  },
  infoText: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18 },

  footer: {
    backgroundColor: CREAM,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: BORDER,
    gap: 6,
  },
  saveBtn: { height: 52, borderRadius: 16, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelBtnText: { fontSize: 14, color: MUTED },
});
