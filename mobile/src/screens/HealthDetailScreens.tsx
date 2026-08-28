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
              {total.toLocaleString('vi-VN')} / 1.850
            </Text>
            <Text style={s.ringUnit}>kcal</Text>
          </View>
          <View style={s.summary}>
            <Summary
              color={C.yellow}
              label="Đã nạp"
              value={`${total.toLocaleString('vi-VN')} kcal`}
            />
            <Summary color="#F5F0E8" label="Còn lại" value={`${Math.max(0, 1850 - total)} kcal`} />
            <Summary color={C.yellow} label="Đã tiêu hao" value="320 kcal" />
          </View>
        </View>
        <Text style={s.sectionTitle}>Phân bố dinh dưỡng</Text>
        <View style={s.macroCard}>
          <Macro label="Protein" value="68/100g · 68%" percent={68} color={C.yellow} />
          <Macro label="Tinh bột" value="142/220g · 65%" percent={65} color={C.orange} />
          <Macro label="Chất béo" value="38/60g · 63%" percent={63} color={C.green} />
        </View>
        <Text style={s.sectionTitle}>Phân bố theo bữa</Text>
        <View style={s.mealDistribution}>
          <View style={s.smallRing}>
            <Text style={s.smallRingValue}>{total.toLocaleString('vi-VN')}</Text>
            <Text style={s.ringUnit}>kcal</Text>
          </View>
          <View style={s.distributionList}>
            <Distribution color={C.yellow} label="Bữa sáng" value="420 kcal" percent="34%" />
            <Distribution color={C.orange} label="Bữa trưa" value="560 kcal" percent="45%" />
            <Distribution color="#DDBB84" label="Bữa tối" value="Chưa ghi lại" percent="0%" />
            <Distribution color={C.green} label="Bữa phụ" value="260 kcal" percent="21%" />
          </View>
        </View>
        <Text style={s.sectionTitle}>So với mục tiêu</Text>
        <View style={s.targets}>
          <TargetItem icon={<Target color={C.yellowDark} />} label="Calo" value="Đúng kế hoạch" />
          <TargetItem icon={<Dumbbell color={C.orange} />} label="Protein" value="Còn thiếu 32g" />
          <TargetItem icon={<Droplets color={C.blue} />} label="Nước" value="Còn thiếu 0,8L" />
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
}: {
  onBack: () => void;
  onLog: () => void;
  onFood: () => void;
  total: number;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Header title="Bữa ăn hôm nay" onBack={onBack} />
        <DatePicker />
        <View style={s.totalCard}>
          <Text style={s.totalText}>
            Tổng <Text style={s.totalStrong}>{total.toLocaleString('vi-VN')}</Text> / 1.850 kcal
          </Text>
          <Text style={s.totalText}>
            Còn lại <Text style={s.totalStrong}>{Math.max(0, 1850 - total)}</Text> kcal
          </Text>
          <Progress value={Math.min(100, total / 18.5)} />
        </View>
        <MealCard
          icon={<Sun />}
          title="Bữa sáng"
          time="07:30"
          kcal="420 kcal"
          image={pho}
          food="Phở bò"
          serving="1 tô"
          macros="Protein 28g · Tinh bột 52g · Chất béo 12g"
          onAdd={onLog}
          onFood={onFood}
        />
        <MealCard
          icon={<Sun />}
          title="Bữa trưa"
          time="12:15"
          kcal="560 kcal"
          image={rice}
          food="Cơm gà Hội An"
          serving="1 phần"
          macros="Protein 32g · Tinh bột 58g · Chất béo 16g"
          onAdd={onLog}
          onFood={onFood}
        />
        <MealCard
          icon={<Utensils />}
          title="Bữa phụ"
          time="15:30"
          kcal="260 kcal"
          image={bun}
          food="Sữa chua trái cây"
          serving="1 ly"
          macros="Protein 9g · Tinh bột 30g · Chất béo 6g"
          onAdd={onLog}
          onFood={onFood}
        />
        <View style={s.emptyDinner}>
          <View style={[s.mealHeader, s.emptyDinnerHeader]}>
            <View style={s.mealIcon}>
              <Moon />
            </View>
            <View style={s.flex}>
              <Text style={s.mealTitle}>Bữa tối</Text>
              <Text style={s.meta}>Chưa ghi lại</Text>
            </View>
            <Pressable onPress={onLog} style={s.add}>
              <Plus />
            </Pressable>
          </View>
          <Bell size={42} color="#7B5012" strokeWidth={1.8} style={s.dinnerIcon} />
          <Text style={s.emptyText}>Bạn chưa ghi lại món ăn cho bữa tối.</Text>
          <Pressable onPress={onLog} style={s.outlineButton}>
            <Plus size={20} />
            <Text style={s.outlineText}>Thêm món</Text>
          </Pressable>
        </View>
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
}: {
  onClose: () => void;
  onSave: (calories: number) => void;
}) {
  const [meal, setMeal] = useState('Bữa tối');
  const [selected, setSelected] = useState(true);
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Header title="Ghi lại bữa ăn" onBack={onClose} close action="Lưu" />
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
        <View style={s.timeCard}>
          <View style={s.mealIcon}>
            <Clock3 />
          </View>
          <Text style={s.timeLabel}>Thời gian</Text>
          <Text style={s.timeValue}>19:00</Text>
          <ChevronRight />
        </View>
        <View style={s.search}>
          <Search color="#777" />
          <TextInput style={s.searchInput} placeholder="Tìm món ăn, nguyên liệu..." />
        </View>
        <View style={s.quickActions}>
          <Quick icon={<Camera />} label="Chụp món ăn" sub="Mogu nhận diện" />
          <Quick icon={<Sparkles />} label="Từ kết quả Random" />
          <Quick icon={<Plus />} label="Tạo món mới" />
        </View>
        <View style={s.suggestionCard}>
          <Text style={s.sectionTitleInline}>Gợi ý cho bữa tối</Text>
          <Suggestion
            image={rice}
            name="Ức gà áp chảo"
            meta="1 phần · 320 kcal"
            onAdd={() => setSelected(true)}
          />
          <Suggestion image={bun} name="Salad cá ngừ" meta="1 tô · 280 kcal" onAdd={() => {}} />
          <Suggestion image={pho} name="Cơm gạo lứt" meta="1 chén · 210 kcal" onAdd={() => {}} />
        </View>
        {selected && (
          <View style={s.selectedCard}>
            <Text style={s.sectionTitleInline}>Món đã chọn</Text>
            <View style={s.selectedFood}>
              <Image source={rice} style={s.selectedImage} />
              <View style={s.flex}>
                <Text style={s.selectedName}>Ức gà áp chảo</Text>
                <View style={s.quantity}>
                  <Pressable style={s.qty}>
                    <Text>−</Text>
                  </Pressable>
                  <Text>1 phần</Text>
                  <Pressable style={s.qty}>
                    <Plus size={18} />
                  </Pressable>
                </View>
              </View>
              <Text style={s.selectedKcal}>320 kcal</Text>
              <Pressable onPress={() => setSelected(false)}>
                <Trash2 size={20} />
              </Pressable>
            </View>
            <Text style={s.selectedMacros}>Protein 42g · Tinh bột 18g · Chất béo 8g</Text>
          </View>
        )}
        <Pressable onPress={() => onSave(selected ? 320 : 0)} style={s.primary}>
          <Text style={s.primaryText}>Lưu bữa ăn · {selected ? 320 : 0} kcal</Text>
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
