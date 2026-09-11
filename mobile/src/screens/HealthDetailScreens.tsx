import { type ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Utensils,
  X,
} from 'lucide-react-native';

const C = {
  bg: '#FFF9E8',
  white: '#FFF',
  yellow: '#FFD54F',
  yellowDark: '#F5B900',
  ink: '#161616',
  secondary: '#626262',
  border: '#E8E0D2',
  orange: '#FF612E',
  green: '#78C93C',
  blue: '#2F85F6',
};
const pho = require('../assets/images/random/pho-result.jpg');
const rice = require('../assets/images/random/chao-ga.jpg');
const bun = require('../assets/images/random/bun-rieu.jpg');
const mascot = require('../assets/images/random/thumb.png');

function Header({
  title,
  onBack,
  close,
  action,
}: {
  title: string;
  onBack: () => void;
  close?: boolean;
  action?: string;
}) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.iconButton}>
        {close ? <X size={28} /> : <ArrowLeft size={27} />}
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      {action ? <Text style={s.headerAction}>{action}</Text> : <CalendarDays size={26} />}
    </View>
  );
}
function DatePicker() {
  return (
    <View style={s.date}>
      <ChevronLeft size={24} />
      <Text style={s.dateText}>Hôm nay, 10 tháng 8</Text>
      <ChevronRight size={24} />
    </View>
  );
}
function Progress({ value, color = C.yellow }: { value: number; color?: string }) {
  return (
    <View style={s.progress}>
      <View style={[s.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

export function HealthOverviewScreen({ onBack, total }: { onBack: () => void; total: number }) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Header title="Tổng quan hôm nay" onBack={onBack} />
        <DatePicker />
        <View style={s.bigCard}>
          <View style={s.calorieRing}>
            <Text style={s.ringValue} numberOfLines={1} adjustsFontSizeToFit>
              {total > 0 ? total.toLocaleString('vi-VN') : '—'}
            </Text>
            <Text style={s.ringUnit}>kcal</Text>
          </View>
          <View style={s.summary}>
            <Summary
              color={C.yellow}
              label="Đã nạp"
              value={total > 0 ? `${total.toLocaleString('vi-VN')} kcal` : '—'}
            />
            <Summary color="#F5F0E8" label="Còn lại" value="—" />
            <Summary color={C.yellow} label="Đã tiêu hao" value="—" />
          </View>
        </View>
        <Text style={s.sectionTitle}>Phân bố dinh dưỡng</Text>
        <View style={s.macroCard}>
          <Text style={s.meta}>Chi tiết macro sẽ hiển thị khi có nhật ký bữa ăn.</Text>
        </View>
        <Text style={s.sectionTitle}>Phân bố theo bữa</Text>
        <View style={s.mealDistribution}>
          <View style={s.smallRing}>
            <Text style={s.smallRingValue}>{total > 0 ? total.toLocaleString('vi-VN') : '—'}</Text>
            <Text style={s.ringUnit}>kcal</Text>
          </View>
          <View style={s.distributionList}>
            <Text style={s.meta}>Mở nhật ký bữa để xem phân bố theo slot.</Text>
          </View>
        </View>
        <Text style={s.sectionTitle}>So với mục tiêu</Text>
        <View style={s.targets}>
          <TargetItem icon={<Target color={C.yellowDark} />} label="Calo" value={total > 0 ? 'Đã có nhật ký' : 'Chưa có dữ liệu'} />
          <TargetItem icon={<Dumbbell color={C.orange} />} label="Protein" value="—" />
          <TargetItem icon={<Droplets color={C.blue} />} label="Nước" value="—" />
        </View>
        <View style={s.tip}>
          <Check size={22} color={C.yellowDark} />
          <View>
            <Text style={s.tipTitle}>Bạn đang đi đúng hướng!</Text>
            <Text style={s.tipText}>
              Hãy bổ sung thêm protein vào bữa tối{`\n`}để hoàn thành mục tiêu hôm nay.
            </Text>
          </View>
          <Image source={mascot} style={s.mascot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Summary({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <View style={[s.summaryDot, { backgroundColor: color }]} />
      <View>
        <Text style={s.summaryLabel}>{label}</Text>
        <Text style={s.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}
function Macro({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  return (
    <View style={s.macro}>
      <Text style={s.macroLabel}>{label}</Text>
      <Text style={s.macroValue}>{value}</Text>
      <Progress value={percent} color={color} />
    </View>
  );
}
function Distribution({
  color,
  label,
  value,
  percent,
}: {
  color: string;
  label: string;
  value: string;
  percent: string;
}) {
  return (
    <View style={s.distribution}>
      <View style={[s.summaryDot, { backgroundColor: color }]} />
      <Text style={s.distributionLabel}>{label}</Text>
      <Text style={s.distributionValue}>{value}</Text>
      <Text style={s.distributionPercent}>{percent}</Text>
    </View>
  );
}
function TargetItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={s.target}>
      <View style={s.targetIcon}>{icon}</View>
      <Text style={s.targetLabel}>{label}</Text>
      <Text style={s.targetValue}>{value}</Text>
    </View>
  );
}

export function MealsScreen({
  onBack,
  onLog,
  onFood,
  total,
  mealGroups,
}: {
  onBack: () => void;
  onLog: () => void;
  onFood: (dishId?: string) => void;
  total: number;
  mealGroups?: Array<{
    mealSlot: string;
    totalKcal: number;
    meals: Array<{
      id: string;
      items: Array<{ id: string; displayName: string; referenceId?: string | null; calories: number | null }>;
      totals: { kcal: number };
    }>;
  }>;
}) {
  const slotLabel: Record<string, string> = {
    BREAKFAST: 'Bữa sáng',
    LUNCH: 'Bữa trưa',
    DINNER: 'Bữa tối',
    SNACK: 'Bữa phụ',
  };
  const groups = mealGroups ?? [];
  const hasMeals = groups.some((g) => g.meals.length > 0);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Header title="Bữa ăn hôm nay" onBack={onBack} />
        <View style={s.totalCard}>
          <Text style={s.totalText}>
            Tổng <Text style={s.totalStrong}>{total.toLocaleString('vi-VN')}</Text> kcal
          </Text>
          {!hasMeals ? (
            <Text style={[s.totalText, { marginTop: 8 }]}>Chưa ghi bữa nào cho ngày này.</Text>
          ) : null}
        </View>
        {groups.map((g) => (
          <View key={g.mealSlot} style={s.mealCard}>
            <View style={s.mealHeader}>
              <View style={s.mealIcon}>
                {g.mealSlot === 'DINNER' ? <Moon /> : <Sun />}
              </View>
              <View style={s.flex}>
                <Text style={s.mealTitle}>{slotLabel[g.mealSlot] ?? g.mealSlot}</Text>
                <Text style={s.meta}>
                  {g.meals.length === 0 ? 'Chưa ghi lại' : `${g.totalKcal} kcal`}
                </Text>
              </View>
              <Pressable onPress={onLog} style={s.add}>
                <Plus />
              </Pressable>
            </View>
            {g.meals.map((m) =>
              m.items.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => onFood(it.referenceId ?? undefined)}
                  style={{ paddingHorizontal: 16, paddingBottom: 12 }}
                >
                  <Text style={s.foodName}>{it.displayName}</Text>
                  <Text style={s.meta}>
                    {it.calories != null ? `${it.calories} kcal` : 'Chưa có kcal'}
                  </Text>
                </Pressable>
              )),
            )}
          </View>
        ))}
        <Pressable onPress={onLog} style={s.primary}>
          <Plus />
          <Text style={s.primaryText}>Ghi lại bữa ăn</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
function MealCard({
  icon,
  title,
  time,
  kcal,
  image,
  food,
  serving,
  macros,
  onAdd,
  onFood,
}: {
  icon: ReactNode;
  title: string;
  time: string;
  kcal: string;
  image: number;
  food: string;
  serving: string;
  macros: string;
  onAdd: () => void;
  onFood: () => void;
}) {
  return (
    <View style={s.mealCard}>
      <View style={s.mealHeader}>
        <View style={s.mealIcon}>{icon}</View>
        <View style={s.flex}>
          <Text style={s.mealTitle}>{title}</Text>
          <Text style={s.meta}>{time}</Text>
        </View>
        <Text style={s.mealKcal}>{kcal}</Text>
        <Pressable onPress={onAdd} style={s.add}>
          <Plus />
        </Pressable>
      </View>
      <Pressable onPress={onFood} style={s.foodRow}>
        <Image source={image} style={s.foodImage} />
        <View style={s.flex}>
          <Text style={s.foodName}>{food}</Text>
          <Text style={s.meta}>{serving}</Text>
          <Text style={s.foodMacros}>{macros}</Text>
        </View>
        <ChevronRight />
      </Pressable>
    </View>
  );
}

export function LogMealScreen({
  onClose,
  onSave,
  searchDishes,
}: {
  onClose: () => void;
  onSave: (payload: {
    dishId?: string;
    mealSlot?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    calories?: number;
  }) => void | Promise<void>;
  searchDishes?: (q: string) => Promise<Array<{ id: string; name: string; nutritionProfiles?: any[] }>>;
}) {
  const [meal, setMeal] = useState('Bữa trưa');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; kcal?: number | null }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string; kcal?: number | null } | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const mealSlotMap: Record<string, 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'> = {
    'Bữa sáng': 'BREAKFAST',
    'Bữa trưa': 'LUNCH',
    'Bữa tối': 'DINNER',
    'Bữa phụ': 'SNACK',
  };

  const runSearch = async (q: string) => {
    setQuery(q);
    if (!searchDishes || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchDishes(q.trim());
      setResults(
        rows.map((d) => ({
          id: d.id,
          name: d.name,
          kcal: d.nutritionProfiles?.[0]?.calories ?? null,
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Header title="Ghi lại bữa ăn" onBack={onClose} close />
        <View style={s.selectorCard}>
          <Text style={s.sectionTitleInline}>Chọn bữa</Text>
          <View style={s.mealSelector}>
            {['Bữa sáng', 'Bữa trưa', 'Bữa tối', 'Bữa phụ'].map((x) => (
              <Pressable
                key={x}
                onPress={() => setMeal(x)}
                style={[s.mealChoice, meal === x && s.mealChoiceActive]}
              >
                <Text style={s.choiceText}>{x}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.search}>
          <Search color="#777" />
          <TextInput
            style={s.searchInput}
            placeholder="Tìm món ăn..."
            value={query}
            onChangeText={runSearch}
          />
        </View>
        {searching ? <Text style={s.meta}>Đang tìm...</Text> : null}
        {results.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setSelected(r)}
            style={[s.suggestionCard, selected?.id === r.id && { borderColor: C.yellow, borderWidth: 2 }]}
          >
            <Text style={s.selectedName}>{r.name}</Text>
            <Text style={s.meta}>{r.kcal != null ? `${r.kcal} kcal` : 'Chưa có kcal'}</Text>
          </Pressable>
        ))}
        {selected ? (
          <View style={s.selectedCard}>
            <Text style={s.sectionTitleInline}>Món đã chọn</Text>
            <Text style={s.selectedName}>{selected.name}</Text>
            <Text style={s.selectedKcal}>
              {selected.kcal != null ? `${selected.kcal} kcal` : 'Kcal sẽ lấy từ server'}
            </Text>
          </View>
        ) : (
          <Text style={[s.meta, { marginTop: 12 }]}>Chọn một món từ kết quả tìm kiếm để lưu.</Text>
        )}
        <Pressable
          disabled={!selected || saving}
          onPress={async () => {
            if (!selected) return;
            setSaving(true);
            try {
              await onSave({
                dishId: selected.id,
                mealSlot: mealSlotMap[meal] ?? 'LUNCH',
                calories: selected.kcal ?? undefined,
              });
            } finally {
              setSaving(false);
            }
          }}
          style={[s.primary, (!selected || saving) && { opacity: 0.5 }]}
        >
          <Text style={s.primaryText}>{saving ? 'Đang lưu...' : 'Lưu bữa ăn'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
function Quick({ icon, label, sub }: { icon: ReactNode; label: string; sub?: string }) {
  return (
    <Pressable style={s.quick}>
      <View style={s.quickIcon}>{icon}</View>
      <Text style={s.quickLabel}>{label}</Text>
      {sub && <Text style={s.meta}>{sub}</Text>}
    </Pressable>
  );
}
function Suggestion({
  image,
  name,
  meta,
  onAdd,
}: {
  image: number;
  name: string;
  meta: string;
  onAdd: () => void;
}) {
  return (
    <View style={s.suggestion}>
      <Image source={image} style={s.suggestionImage} />
      <View style={s.flex}>
        <Text style={s.suggestionName}>{name}</Text>
        <Text style={s.meta}>{meta}</Text>
      </View>
      <Pressable onPress={onAdd} style={s.add}>
        <Plus />
      </Pressable>
    </View>
  );
}

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerAction: { width: 44, textAlign: 'right', fontSize: 17, color: C.yellowDark },
  date: {
    height: 56,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: 17 },
  bigCard: {
    height: 280,
    borderRadius: 24,
    backgroundColor: C.white,
    padding: 20,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  calorieRing: {
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 16,
    borderColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    width: 126,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  ringUnit: { fontSize: 12, color: C.secondary, marginTop: 4, textAlign: 'center' },
  summary: { flex: 1, paddingLeft: 28 },
  summaryRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryDot: { width: 12, height: 12, borderRadius: 6 },
  summaryLabel: { fontSize: 14, color: C.secondary },
  summaryValue: { fontSize: 22, fontWeight: '700', marginTop: 3 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 26, marginBottom: 12 },
  sectionTitleInline: { fontSize: 20, fontWeight: '700' },
  macroCard: {
    height: 120,
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    flexDirection: 'row',
    ...shadow,
  },
  macro: { flex: 1, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: C.border },
  macroLabel: { fontSize: 14 },
  macroValue: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  progress: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F2EDE4',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 5 },
  mealDistribution: {
    height: 190,
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  smallRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 14,
    borderColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallRingValue: { fontSize: 24, fontWeight: '700' },
  distributionList: { flex: 1, paddingLeft: 20 },
  distribution: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  distributionLabel: { flex: 1, fontSize: 14 },
  distributionValue: { fontSize: 14, fontWeight: '600' },
  distributionPercent: { width: 34, textAlign: 'right', fontSize: 13, color: C.secondary },
  targets: {
    height: 130,
    borderRadius: 20,
    backgroundColor: C.white,
    flexDirection: 'row',
    padding: 14,
    ...shadow,
  },
  target: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  targetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: { fontSize: 13, color: C.secondary, marginTop: 6 },
  targetValue: { fontSize: 13, fontWeight: '700', marginTop: 5 },
  tip: {
    height: 135,
    borderRadius: 20,
    backgroundColor: '#FFF4D8',
    padding: 18,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    marginTop: 16,
  },
  tipTitle: { fontSize: 17, fontWeight: '700' },
  tipText: { fontSize: 14, lineHeight: 23, marginTop: 12 },
  mascot: { position: 'absolute', right: -10, bottom: -25, width: 145, height: 145 },
  totalCard: {
    height: 110,
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    marginTop: 16,
    ...shadow,
  },
  totalText: { fontSize: 16 },
  totalStrong: { fontSize: 25, fontWeight: '700' },
  mealCard: {
    minHeight: 225,
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    marginTop: 16,
    ...shadow,
  },
  mealHeader: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  mealTitle: { fontSize: 19, fontWeight: '700' },
  meta: { fontSize: 13, color: C.secondary, marginTop: 3 },
  mealKcal: { fontSize: 18, fontWeight: '600' },
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: C.yellowDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  foodImage: { width: 118, height: 100, borderRadius: 14 },
  foodName: { fontSize: 18, fontWeight: '600' },
  foodMacros: { fontSize: 12, color: C.secondary, marginTop: 12 },
  emptyDinner: {
    height: 180,
    borderRadius: 20,
    backgroundColor: '#FFF4D8',
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  emptyDinnerHeader: { width: '100%', alignSelf: 'stretch' },
  dinnerIcon: { marginTop: -3 },
  emptyText: { fontSize: 12, color: '#7B5012', marginTop: 2, marginBottom: 6 },
  outlineButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.yellowDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outlineText: { fontSize: 15, fontWeight: '600' },
  primary: {
    height: 56,
    borderRadius: 16,
    backgroundColor: C.yellow,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...shadow,
  },
  primaryText: { fontSize: 17, fontWeight: '700' },
  selectorCard: { borderRadius: 20, backgroundColor: C.white, padding: 16, ...shadow },
  mealSelector: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mealChoice: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealChoiceActive: { backgroundColor: C.yellow, borderColor: C.yellowDark },
  choiceText: { fontSize: 14, fontWeight: '600' },
  timeCard: {
    height: 72,
    borderRadius: 20,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow,
  },
  timeLabel: { fontSize: 17, fontWeight: '600' },
  timeValue: { marginLeft: 'auto', fontSize: 17 },
  search: {
    height: 66,
    borderRadius: 20,
    backgroundColor: C.white,
    paddingHorizontal: 18,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 15 },
  quickActions: {
    height: 145,
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    ...shadow,
  },
  quick: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  suggestionCard: {
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    marginTop: 16,
    ...shadow,
  },
  suggestion: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  suggestionImage: { width: 94, height: 68, borderRadius: 12 },
  suggestionName: { fontSize: 17, fontWeight: '600' },
  selectedCard: {
    borderRadius: 20,
    backgroundColor: C.white,
    padding: 16,
    marginTop: 16,
    ...shadow,
  },
  selectedFood: { height: 100, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectedImage: { width: 78, height: 78, borderRadius: 12 },
  selectedName: { fontSize: 16, fontWeight: '600' },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  qty: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedKcal: { fontSize: 17, fontWeight: '600' },
  selectedMacros: {
    fontSize: 13,
    color: C.secondary,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    textAlign: 'center',
  },
});
