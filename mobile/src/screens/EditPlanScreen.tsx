/**
 * EditPlanScreen — Man hinh "Chinh ke hoach"
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Settings2 } from 'lucide-react-native';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  upsertWeeklyPlanConfig,
  generateWeeklyPlan,
  getWeeklyPlanConfig,
  getCurrentWeeklyPlan,
  pollWeeklyPlan,
} from '../services/api/weekly-plan';
import type { WeeklyMealSlot } from '../services/api/types';
import { formatApiErrorWithCode, formatWeeklyPlanGenerationError } from '../lib/api-error';
import { getTodayISO } from '../lib/dates';
import { EditPlanSkeleton } from '../components/skeletons/ScreenSkeletons';

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

const formatViNumber = (n: number) => n.toLocaleString('vi-VN');
const parseDigits = (text: string): number | null => {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function EditPlanScreen({ onBack, onReset, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [budget, setBudget] = useState(500000);
  const [kcal, setKcal] = useState(2000);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [kcalDraft, setKcalDraft] = useState<string | null>(null);
  const [kcalMode, setKcalMode] = useState<'profile' | 'custom'>('profile');
  const [days, setDays] = useState(7);
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

  const enabledSlots = (): WeeklyMealSlot[] => {
    const slots: WeeklyMealSlot[] = [];
    if (mealSlots.sang) slots.push('MORNING');
    if (mealSlots.trua) slots.push('LUNCH');
    if (mealSlots.toi) slots.push('DINNER');
    if (mealSlots.phu) slots.push('SNACK');
    return slots;
  };

  const mealsPerDay = enabledSlots().length;

  const adjustBudget = (delta: number) => {
    setBudgetDraft(null);
    setBudget((prev) => clamp(prev + delta, BUDGET_MIN, BUDGET_MAX));
  };

  const adjustKcal = (delta: number) => {
    setKcalDraft(null);
    setKcalMode('custom');
    setKcal((prev) => clamp(prev + delta, KCAL_MIN, KCAL_MAX));
  };

  const onBudgetChangeText = (text: string) => {
    const digits = text.replace(/[^\d]/g, '');
    if (!digits) {
      setBudgetDraft('');
      return;
    }
    setBudgetDraft(formatViNumber(parseInt(digits, 10)));
  };

  const onBudgetBlur = () => {
    const parsed = parseDigits(budgetDraft ?? '');
    setBudget(clamp(parsed ?? budget, BUDGET_MIN, BUDGET_MAX));
    setBudgetDraft(null);
  };

  const onKcalChangeText = (text: string) => {
    setKcalMode('custom');
    const digits = text.replace(/[^\d]/g, '');
    if (!digits) {
      setKcalDraft('');
      return;
    }
    setKcalDraft(formatViNumber(parseInt(digits, 10)));
  };

  const onKcalBlur = () => {
    const parsed = parseDigits(kcalDraft ?? '');
    setKcal(clamp(parsed ?? kcal, KCAL_MIN, KCAL_MAX));
    setKcalDraft(null);
  };

  const toggleSlot = (slot: keyof typeof mealSlots) => {
    setMealSlots((prev) => {
      const next = { ...prev, [slot]: !prev[slot] };
      const count = Object.values(next).filter(Boolean).length;
      if (count === 0) return prev;
      return next;
    });
  };

  const commitDrafts = () => {
    if (budgetDraft != null) {
      const parsed = parseDigits(budgetDraft);
      setBudget(clamp(parsed ?? budget, BUDGET_MIN, BUDGET_MAX));
      setBudgetDraft(null);
    }
    if (kcalDraft != null) {
      const parsed = parseDigits(kcalDraft);
      setKcal(clamp(parsed ?? kcal, KCAL_MIN, KCAL_MAX));
      setKcalDraft(null);
    }
  };

  const resolvedBudget = () => {
    if (budgetDraft == null) return budget;
    return clamp(parseDigits(budgetDraft) ?? budget, BUDGET_MIN, BUDGET_MAX);
  };

  const resolvedKcal = () => {
    if (kcalDraft == null) return kcal;
    return clamp(parseDigits(kcalDraft) ?? kcal, KCAL_MIN, KCAL_MAX);
  };

  const buildConfigDto = () => {
    const slots = enabledSlots();
    if (slots.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một bữa ăn.');
    }
    return {
      budgetVnd: resolvedBudget(),
      kcalPerDay: resolvedKcal(),
      kcalMode: (kcalMode === 'profile' ? 'PROFILE' : 'CUSTOM') as 'PROFILE' | 'CUSTOM',
      durationDays: days,
      mealsPerDay: slots.length,
      enabledSlots: slots,
      avoidRepeat: true,
    };
  };

  const handleSaveConfig = async () => {
    commitDrafts();
    setSavingConfig(true);
    try {
      const dto = buildConfigDto();
      await upsertWeeklyPlanConfig(dto);
      onSave?.({
        budget: dto.budgetVnd,
        kcalPerDay: dto.kcalPerDay,
        kcalMode,
        days,
        mealsPerDay,
        mealSlots,
      });
      Alert.alert('Đã lưu', 'Cấu hình kế hoạch đã được cập nhật.');
    } catch (err) {
      Alert.alert('Lỗi', formatApiErrorWithCode(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGeneratePlan = async () => {
    commitDrafts();
    setGenerating(true);
    try {
      const dto = buildConfigDto();
      await upsertWeeklyPlanConfig(dto);
      const { planId } = await generateWeeklyPlan(getTodayISO());
      const finalPlan = await pollWeeklyPlan(planId);

      if (finalPlan.status === 'FAILED') {
        Alert.alert(
          'Tạo thất bại',
          formatWeeklyPlanGenerationError(finalPlan.generationErrorCode),
        );
        return;
      }

      onSave?.({
        budget: dto.budgetVnd,
        kcalPerDay: dto.kcalPerDay,
        kcalMode,
        days,
        mealsPerDay,
        mealSlots,
      });
      Alert.alert('Hoàn tất', 'Kế hoạch mới đã sẵn sàng.');
      onBack();
    } catch (err) {
      Alert.alert('Lỗi', formatApiErrorWithCode(err));
    } finally {
      setGenerating(false);
    }
  };

  const remainingProjected = Math.max(0, resolvedBudget() - planForecast.projectedVnd);
  const endForecast = planForecast.projectedVnd;

  const daysValue = { value: String(days), label: `${days} ngày` };

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
      {!loadingConfig && (
        <View style={s.statsBar}>
          <Text style={s.statsItem}>{days} ngày · {days * mealsPerDay} bữa</Text>
          <View style={s.statsDivider} />
          <Text style={s.statsItem}>
            {planForecast.spentVnd > 0
              ? `${Math.round(planForecast.spentVnd / 1000)}K đã chi`
              : `${Math.round(budget / 1000)}K ngân sách`}
          </Text>
          <View style={s.statsDivider} />
          <Text style={s.statsItem}>{kcal.toLocaleString('vi-VN')} kcal/ngày</Text>
        </View>
      )}

      {loadingConfig ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <EditPlanSkeleton />
        </ScrollView>
      ) : (
      <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >
        <View style={s.formGroup}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Ngân sách cho {days} ngày</Text>
          <View style={s.stepperRow}>
            <Pressable onPress={() => adjustBudget(-BUDGET_STEP)} style={s.stepperBtn}>
              <Text style={s.stepperBtnText}>{'−'}</Text>
            </Pressable>
            <View style={s.stepperValue}>
              <View style={s.stepperInputRow}>
                <Input
                  value={budgetDraft ?? formatViNumber(budget)}
                  onChangeText={onBudgetChangeText}
                  onFocus={() => setBudgetDraft(formatViNumber(budget))}
                  onBlur={onBudgetBlur}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  className="min-w-[90px] max-w-[180px] border-0 bg-transparent p-0 text-center text-[26px] font-bold shadow-none"
                  style={s.stepperInput}
                  accessibilityLabel="Ngân sách"
                />
                <Text style={s.stepperUnit}> đ</Text>
              </View>
            </View>
            <Pressable onPress={() => adjustBudget(BUDGET_STEP)} style={s.stepperBtn}>
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
            <Pressable onPress={() => adjustKcal(-KCAL_STEP)} style={s.stepperBtn}>
              <Text style={s.stepperBtnText}>{'−'}</Text>
            </Pressable>
            <View style={s.stepperValue}>
              <View style={s.stepperInputRow}>
                <Input
                  value={kcalDraft ?? formatViNumber(kcal)}
                  onChangeText={onKcalChangeText}
                  onFocus={() => {
                    setKcalMode('custom');
                    setKcalDraft(formatViNumber(kcal));
                  }}
                  onBlur={onKcalBlur}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  className="min-w-[90px] max-w-[180px] border-0 bg-transparent p-0 text-center text-[26px] font-bold shadow-none"
                  style={s.stepperInput}
                  accessibilityLabel="Năng lượng mỗi ngày"
                />
                <Text style={s.stepperUnit}> kcal</Text>
              </View>
            </View>
            <Pressable onPress={() => adjustKcal(KCAL_STEP)} style={s.stepperBtn}>
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
            <View style={{ flex: 1 }}>
              <Select
                value={daysValue}
                onValueChange={(opt) => {
                  if (opt?.value) setDays(Number(opt.value));
                }}
              >
                <SelectTrigger className="h-11 rounded-xl border-[1.5px] border-[#EDE5D2] bg-white px-3">
                  <SelectValue placeholder="Chọn số ngày" className="text-[14.5px] font-semibold" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {DAYS_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)} label={`${d} ngày`}>
                      {`${d} ngày`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
            <View style={[s.dropdown, { flex: 1, opacity: 0.85 }]}>
              <Text style={s.dropdownText}>{mealsPerDay} bữa/ngày</Text>
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
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSlot(key as keyof typeof mealSlots)}
                  />
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
            <Text style={s.moreOptionSub} numberOfLines={1}>
              Tự nấu · Hạn chế lặp · Giữ món đã chọn
            </Text>
          </View>
          <Text style={{ color: MUTED, fontSize: 16 }}>{'›'}</Text>
        </Pressable>
        </View>

        <Text style={s.infoInline}>ℹ️  Mogu sẽ cân đối lại các bữa chưa khóa.</Text>
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
      </View>
      </>
      )}
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
    backgroundColor: WHITE, paddingVertical: 6, gap: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  statsItem: { fontSize: 12, fontWeight: '600', color: '#444' },
  statsDivider: { width: 1, height: 12, backgroundColor: '#E0D8C8' },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  formGroup: {
    gap: 10,
  },

  card: {
    backgroundColor: WHITE,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#B19B66', shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardLabel: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 4 },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6,
  },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 24, color: '#555', fontWeight: '300', lineHeight: 26 },
  stepperValue: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  stepperInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  stepperInput: {
    fontSize: 26,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.5,
    paddingVertical: 0,
    paddingHorizontal: 4,
    minWidth: 90,
    maxWidth: 180,
    textAlign: 'center',
  },
  stepperNumber: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  stepperUnit: { fontSize: 14, fontWeight: '500', color: MUTED },

  estimatedHint: { textAlign: 'center', fontSize: 12.5, color: MUTED, marginTop: 8 },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#E0D8C8',
    marginTop: 10,
  },
  modeBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },
  modeBtnActive: { backgroundColor: YELLOW },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: MUTED },
  modeBtnTextActive: { color: INK, fontWeight: '700' },

  dropdownRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  dropdown: {
    height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: '#FAFAFA',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 6,
  },
  dropdownText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: INK },

  slotsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.5, borderColor: '#E0D8C8',
    backgroundColor: WHITE,
  },
  slotChipActive: { backgroundColor: '#FFF9E0', borderColor: '#F0C040' },
  slotCheck: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  slotCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#CCC', backgroundColor: WHITE },
  slotText: { fontSize: 13.5, fontWeight: '600', color: MUTED },
  slotTextActive: { color: INK },

  moreOption: {
    backgroundColor: WHITE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#B19B66', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  moreOptionIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center',
  },
  moreOptionTitle: { fontSize: 15, fontWeight: '700', color: INK },
  moreOptionSub: { fontSize: 12.5, color: MUTED, marginTop: 2 },

  infoInline: {
    fontSize: 13, color: '#777', textAlign: 'center',
    paddingHorizontal: 4, marginTop: 14, marginBottom: 4,
  },

  footer: {
    backgroundColor: CREAM,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
    flexDirection: 'row', gap: 8,
  },
  saveBtn: {
    flex: 1, height: 46, borderRadius: 14, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: INK, letterSpacing: -0.2 },
  generateBtn: {
    flex: 1, height: 46, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E0D8C8', backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: INK },
});
