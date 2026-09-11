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
  pollWeeklyPlan,
} from '../services/api/weekly-plan';
import type { WeeklyMealSlot } from '../services/api/types';
import { formatApiErrorWithCode } from '../lib/api-error';
import { getTodayISO } from '../lib/dates';

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
  const [daysOpen, setDaysOpen] = useState(false);
  const [daysAnchor, setDaysAnchor] = useState({ x: 0, y: 0, width: 0 });
  const [mealSlots, setMealSlots] = useState({
    sang: true, trua: true, toi: true, phu: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [planForecast, setPlanForecast] = useState({
    spentVnd: 0,
    projectedVnd: 0,
    budgetVnd: 500000,
    kcalPerDay: 2000,
  });

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
          setPlanForecast({
            spentVnd: p.actualSpentVnd,
            projectedVnd: p.projectedCostVnd,
            budgetVnd: p.budgetLimitVnd,
            kcalPerDay: Math.round(p.targetKcal / Math.max(days, 1)),
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

  const enabledSlots = (): WeeklyMealSlot[] => {
    const slots: WeeklyMealSlot[] = [];
    if (mealSlots.sang) slots.push('MORNING');
    if (mealSlots.trua) slots.push('LUNCH');
    if (mealSlots.toi) slots.push('DINNER');
    if (mealSlots.phu) slots.push('SNACK');
    return slots;
  };

  const mealsPerDay = enabledSlots().length;

  const toggleSlot = (slot: keyof typeof mealSlots) => {
    setMealSlots((prev) => {
      const next = { ...prev, [slot]: !prev[slot] };
      const count = Object.values(next).filter(Boolean).length;
      if (count === 0) return prev;
      return next;
    });
  };

  const buildConfigDto = () => {
    const slots = enabledSlots();
    if (slots.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một bữa ăn.');
    }
    return {
      budgetVnd: budget,
      kcalPerDay: kcal,
      kcalMode: (kcalMode === 'profile' ? 'PROFILE' : 'CUSTOM') as 'PROFILE' | 'CUSTOM',
      durationDays: days,
      mealsPerDay: slots.length,
      enabledSlots: slots,
      avoidRepeat: true,
    };
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await upsertWeeklyPlanConfig(buildConfigDto());
      onSave?.({ budget, kcalPerDay: kcal, kcalMode, days, mealsPerDay, mealSlots });
      Alert.alert('Đã lưu', 'Cấu hình kế hoạch đã được cập nhật.');
    } catch (err) {
      Alert.alert('Lỗi', formatApiErrorWithCode(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      await upsertWeeklyPlanConfig(buildConfigDto());
      const { planId } = await generateWeeklyPlan(getTodayISO());
      const finalPlan = await pollWeeklyPlan(planId);

      if (finalPlan.status === 'FAILED') {
        Alert.alert(
          'Tạo thất bại',
          finalPlan.generationErrorCode ?? 'Không thể tạo kế hoạch. Vui lòng thử lại.',
        );
        return;
      }

      onSave?.({ budget, kcalPerDay: kcal, kcalMode, days, mealsPerDay, mealSlots });
      Alert.alert('Hoàn tất', 'Kế hoạch mới đã sẵn sàng.');
      onBack();
    } catch (err) {
      Alert.alert('Lỗi', formatApiErrorWithCode(err));
    } finally {
      setGenerating(false);
    }
  };

  const openDays = () => {
    daysRef.current?.measureInWindow((x, y, width, height) => {
      setDaysAnchor({ x, y: y + height + 4, width });
      setDaysOpen(true);
    });
  };

  const remainingProjected = Math.max(0, budget - planForecast.projectedVnd);
  const endForecast = planForecast.projectedVnd;

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
            <Text style={s.statsItem}>
              {planForecast.spentVnd > 0
                ? `${Math.round(planForecast.spentVnd / 1000)}K đã chi`
                : `${Math.round(budget / 1000)}K ngân sách`}
            </Text>
            <View style={s.statsDivider} />
            <Text style={s.statsItem}>{kcal.toLocaleString('vi-VN')} kcal/ngày</Text>
          </>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card}>
          <Text style={s.cardLabel}>Ngân sách cho {days} ngày</Text>
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
            Đã chi{' '}
            <Text style={{ fontWeight: '700' }}>{Math.round(planForecast.spentVnd / 1000)}K</Text>
            {' · '}Dự toán còn{' '}
            <Text style={{ color: '#16A34A', fontWeight: '700' }}>
              {Math.round(remainingProjected / 1000)}K
            </Text>
            {' · '}Cuối kỳ ~{Math.round(endForecast / 1000)}K
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

          <View style={s.dropdownRow}>
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
            <View style={[s.dropdown, { flex: 1, opacity: 0.85 }]}>
              <Text style={s.dropdownText}>{mealsPerDay} bữa/ngày</Text>
            </View>
          </View>
          <Text style={[s.estimatedHint, { marginTop: 8 }]}>
            Số bữa/ngày tự động theo các slot đã chọn.
          </Text>

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

      <View style={s.footer}>
        <TouchableOpacity
          activeOpacity={0.87}
          onPress={handleSaveConfig}
          style={[s.saveBtn, savingConfig && { opacity: 0.7 }]}
          disabled={savingConfig || generating}
        >
          {savingConfig
            ? <ActivityIndicator size="small" color="#111" />
            : <Text style={s.saveBtnText}>Lưu cấu hình</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.87}
          onPress={handleGeneratePlan}
          style={[s.generateBtn, generating && { opacity: 0.7 }]}
          disabled={generating || savingConfig}
        >
          {generating
            ? <ActivityIndicator size="small" color="#111" />
            : <Text style={s.generateBtnText}>Tạo lại plan</Text>
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
  generateBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0D8C8',
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: INK },
  cancelBtn: { alignItems: 'center', paddingVertical: 6 },
  cancelBtnText: { fontSize: 14, color: MUTED },
});
