import { useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Ban,
  CalendarDays,
  Check,
  Heart,
  HeartPulse as HeartPulseIcon,
  Leaf,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  Soup,
  Sparkles,
  Target,
  TriangleAlert,
  User,
  UserRound,
  Utensils,
  X,
  Zap,
} from '@/components/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Chip, ChipWrap, InfoNote, Section, StepTitle } from './components';
import { BODY_LIMITS, cardShadow, goalIcon, MASCOT, ob } from './theme';
import {
  calcAge,
  calcBmi,
  daysInMonth,
  type Gender,
  type OnboardingController,
  UI_STEP,
  type UiStep,
} from './useOnboarding';

type StepProps = { ctl: OnboardingController };

// ─── 0 · Welcome ──────────────────────────────────────────────────────────────

const VALUE_PROPS = [
  { icon: UserRound, title: 'Gợi ý theo bạn', desc: 'Hợp khẩu vị, mục tiêu và sức khỏe' },
  { icon: Zap, title: 'Chọn món trong 1 chạm', desc: 'Hết cảnh “hôm nay ăn gì?”' },
  { icon: ShieldCheck, title: 'Tránh món dị ứng', desc: 'Tự động loại món không hợp' },
];

export function WelcomeStep() {
  const { height } = useWindowDimensions();
  const heroSize = Math.min(260, height * 0.3);
  return (
    <View style={{ alignItems: 'center', paddingTop: 8 }}>
      <View
        style={{
          width: heroSize,
          height: heroSize,
          borderRadius: heroSize / 2,
          backgroundColor: ob.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image source={MASCOT.welcome} resizeMode="contain" style={{ width: heroSize * 0.95, height: heroSize * 0.95 }} />
      </View>

      <Text style={{ fontSize: 30, fontWeight: '800', color: ob.ink, textAlign: 'center', lineHeight: 37, letterSpacing: -0.6, marginTop: 20 }}>
        {'Chào mừng bạn\nđến với NOAN'}
      </Text>
      <Text style={{ fontSize: 15, color: ob.sub, textAlign: 'center', lineHeight: 22, marginTop: 8 }}>
        Trả lời 4 câu hỏi nhanh để NOAN chọn món hợp với bạn hơn.
      </Text>

      <View style={[{ width: '100%', backgroundColor: ob.surface, borderRadius: 20, paddingVertical: 6, marginTop: 22 }, cardShadow]}>
        {VALUE_PROPS.map(({ icon: Icon, title, desc }, i) => (
          <View
            key={title}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: ob.surfaceWarm,
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ob.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={19} color={ob.gold700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: ob.ink }}>{title}</Text>
              <Text style={{ fontSize: 13, color: ob.sub, marginTop: 1 }}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── 1 · About (name + DOB + gender) ↔ backend steps 2,3,4 ────────────────────

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'MALE', label: 'Nam' },
  { id: 'FEMALE', label: 'Nữ' },
  { id: 'OTHER', label: 'Khác' },
];

export function AboutStep({ ctl }: StepProps) {
  const { form, patch } = ctl;
  const thisYear = new Date().getFullYear();
  const maxDay = daysInMonth(form.birthMonth, form.birthYear);
  const age = calcAge(form.birthDay, form.birthMonth, form.birthYear);

  const setDate = (p: { birthDay?: number; birthMonth?: number; birthYear?: number }) => {
    const next = { birthDay: form.birthDay, birthMonth: form.birthMonth, birthYear: form.birthYear, ...p };
    next.birthDay = Math.min(next.birthDay, daysInMonth(next.birthMonth, next.birthYear));
    patch(next);
  };

  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 90 }, (_, i) => thisYear - 5 - i);

  return (
    <View>
      <StepTitle
        eyebrow="LÀM QUEN"
        title="NOAN nên gọi bạn là gì?"
        subtitle="Để lời chào và gợi ý thân thiện hơn."
        mascot={MASCOT.welcome}
      />

      <Section icon={User} title="Tên của bạn" right={<OptionalTag />}>
        <TextInput
          value={form.displayName}
          onChangeText={(t) => patch({ displayName: t })}
          placeholder="Ví dụ: Minh, An, Huy…"
          placeholderTextColor={ob.muted}
          maxLength={50}
          autoCapitalize="words"
          returnKeyType="done"
          style={{
            height: 50,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: form.displayName ? ob.primary : ob.border,
            backgroundColor: ob.bg,
            paddingHorizontal: 14,
            fontSize: 16,
            fontWeight: '500',
            color: ob.ink,
          }}
        />
      </Section>

      <Section
        icon={CalendarDays}
        title="Ngày sinh"
        right={
          age >= 0 ? (
            <View style={{ backgroundColor: ob.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: ob.gold700 }}>{age} tuổi</Text>
            </View>
          ) : null
        }
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DateSelect flex={0.9} placeholder="Ngày" value={form.birthDay} label={`Ngày ${form.birthDay}`} options={days.map((d) => [d, `Ngày ${d}`])} onChange={(v) => setDate({ birthDay: v })} />
          <DateSelect flex={1.05} placeholder="Tháng" value={form.birthMonth} label={`Tháng ${form.birthMonth}`} options={months.map((m) => [m, `Tháng ${m}`])} onChange={(v) => setDate({ birthMonth: v })} />
          <DateSelect flex={1.05} placeholder="Năm" value={form.birthYear} label={String(form.birthYear)} options={years.map((y) => [y, String(y)])} onChange={(v) => setDate({ birthYear: v })} />
        </View>
      </Section>

      <Section icon={UserRound} title="Giới tính" right={<OptionalTag />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {GENDERS.map((g) => {
            const active = form.gender === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  patch({ gender: active ? null : g.id });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: active ? ob.primary : ob.border,
                  backgroundColor: active ? ob.primarySoft : ob.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {active ? <Check size={15} color={ob.ink} strokeWidth={3} /> : null}
                <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: ob.ink }}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <InfoNote icon={ShieldCheck}>Thông tin chỉ dùng để cá nhân hóa gợi ý, bạn có thể sửa bất kỳ lúc nào.</InfoNote>
    </View>
  );
}

function OptionalTag() {
  return <Text style={{ fontSize: 12, color: ob.muted, fontWeight: '500' }}>Không bắt buộc</Text>;
}

function DateSelect({
  flex,
  placeholder,
  value,
  label,
  options,
  onChange,
}: {
  flex: number;
  placeholder: string;
  value: number;
  label: string;
  options: [number, string][];
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ flex }}>
      <Select
        value={{ value: String(value), label }}
        onValueChange={(opt) => {
          if (opt?.value) onChange(Number(opt.value));
        }}
      >
        <SelectTrigger className="h-12 rounded-xl border border-border bg-background">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={String(v)} label={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </View>
  );
}

// ─── 2 · Body ↔ backend step 5 ─────────────────────────────────────────────────

function bmiInfo(bmi: number) {
  if (bmi < 18.5) return { label: 'Thiếu cân', color: '#3B82F6', bg: '#E0ECFF' };
  if (bmi < 23) return { label: 'Cân đối', color: ob.success, bg: ob.successSoft };
  if (bmi < 25) return { label: 'Hơi thừa cân', color: ob.gold700, bg: ob.primarySoft };
  return { label: 'Thừa cân', color: ob.danger, bg: ob.dangerSoft };
}

export function BodyStep({ ctl }: StepProps) {
  const { form, patch } = ctl;
  const bmi = calcBmi(form.heightCm, form.weightKg);
  const info = bmiInfo(bmi);

  return (
    <View>
      <StepTitle
        eyebrow="CƠ THỂ"
        title="Chiều cao & cân nặng"
        subtitle="Giúp NOAN ước lượng khẩu phần và lượng calo phù hợp."
        mascot={MASCOT.thinking}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MeasureCard
          label="Chiều cao"
          unit="cm"
          value={form.heightCm}
          {...BODY_LIMITS.height}
          onChange={(v) => patch({ heightCm: v })}
        />
        <MeasureCard
          label="Cân nặng"
          unit="kg"
          value={form.weightKg}
          {...BODY_LIMITS.weight}
          decimals={1}
          onChange={(v) => patch({ weightKg: v })}
        />
      </View>

      <View style={[{ marginTop: 12, backgroundColor: ob.surface, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, cardShadow]}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: info.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: info.color }}>{bmi.toFixed(1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: ob.sub }}>Chỉ số BMI của bạn</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: info.color, marginTop: 2 }}>{info.label}</Text>
          <BmiBar bmi={bmi} />
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <InfoNote icon={ShieldCheck}>Chạm vào số để nhập nhanh. Bạn có thể bỏ qua bước này.</InfoNote>
      </View>
    </View>
  );
}

function BmiBar({ bmi }: { bmi: number }) {
  // Thang 15 → 32
  const pct = Math.max(0, Math.min(1, (bmi - 15) / 17));
  const segs = [
    { w: 3.5, c: '#93C5FD' },
    { w: 4.5, c: '#6EE7B7' },
    { w: 2, c: '#FDE68A' },
    { w: 7, c: '#FCA5A5' },
  ];
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' }}>
        {segs.map((s, i) => (
          <View key={i} style={{ flex: s.w, backgroundColor: s.c }} />
        ))}
      </View>
      <View style={{ position: 'absolute', left: `${pct * 100}%`, top: -3, marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: ob.ink, borderWidth: 2, borderColor: '#FFF' }} />
    </View>
  );
}

function MeasureCard({
  label,
  unit,
  value,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<TextInput>(null);
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)) * 10 ** decimals) / 10 ** decimals;
  const display = decimals && value % 1 !== 0 ? value.toFixed(decimals) : String(value);

  const commit = () => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!Number.isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  const bump = (dir: 1 | -1) => {
    Haptics.selectionAsync();
    onChange(clamp(value + dir * step));
  };

  return (
    <View style={[{ flex: 1, backgroundColor: ob.surface, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }, cardShadow]}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: ob.sub }}>{label}</Text>
      <Pressable
        onPress={() => {
          setRaw(display);
          setEditing(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginTop: 6 }}
        accessibilityLabel={`${label} ${display} ${unit}, chạm để nhập`}
      >
        {editing ? (
          <TextInput
            ref={inputRef}
            value={raw}
            onChangeText={(t) => setRaw(t.replace(/[^0-9.,]/g, ''))}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={5}
            style={{ fontSize: 44, fontWeight: '800', color: ob.ink, minWidth: 90, textAlign: 'center', padding: 0, borderBottomWidth: 2, borderBottomColor: ob.primary }}
          />
        ) : (
          <Text style={{ fontSize: 44, fontWeight: '800', color: ob.ink, letterSpacing: -1 }}>{display}</Text>
        )}
        <Text style={{ fontSize: 16, fontWeight: '700', color: ob.muted, marginBottom: 10 }}>{unit}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        <StepperBtn onPress={() => bump(-1)} label={`Giảm ${label}`}>
          <Minus size={18} color={ob.ink} />
        </StepperBtn>
        <StepperBtn onPress={() => bump(1)} label={`Tăng ${label}`}>
          <Plus size={18} color={ob.ink} />
        </StepperBtn>
      </View>
    </View>
  );
}

function StepperBtn({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ob.surfaceWarm, borderWidth: 1, borderColor: ob.border, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </Pressable>
  );
}

// ─── 3 · Goal ↔ backend step 6 (catalog.goals) ────────────────────────────────

export function GoalStep({ ctl }: StepProps) {
  const { form, patch, catalog, catalogState } = ctl;

  return (
    <View>
      <StepTitle
        eyebrow="MỤC TIÊU"
        title="Bạn muốn ăn uống thế nào?"
        subtitle="Chọn một mục tiêu chính — có thể đổi lại sau."
        mascot={MASCOT.thinking}
      />

      {catalogState === 'loading' && catalog.goals.length === 0
        ? Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={{ height: 72, borderRadius: 18, backgroundColor: ob.surfaceWarm, marginBottom: 10 }} />
          ))
        : catalog.goals.map((g) => {
            const Icon = goalIcon(g.code);
            const active = form.primaryGoalId === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  patch({ primaryGoalId: g.id });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    borderRadius: 18,
                    marginBottom: 10,
                    borderWidth: 2,
                    borderColor: active ? ob.primary : 'transparent',
                    backgroundColor: active ? ob.gold50 : ob.surface,
                  },
                  cardShadow,
                ]}
              >
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: active ? ob.primary : ob.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={ob.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: ob.ink }}>{g.name}</Text>
                  {g.description ? (
                    <Text style={{ fontSize: 13, color: ob.sub, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
                      {g.description}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: active ? ob.ink : ob.border,
                    backgroundColor: active ? ob.ink : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? <Check size={13} color={ob.primary} strokeWidth={3.5} /> : null}
                </View>
              </Pressable>
            );
          })}
    </View>
  );
}

// ─── 4 · Preferences ↔ backend step 7 (taste/diet/allergens/avoid) ────────────

export function PrefsStep({ ctl }: StepProps) {
  const { form, patch, catalog } = ctl;
  const [avoidText, setAvoidText] = useState('');

  const toggle = (key: 'tasteIds' | 'dietIds' | 'allergenIds', id: string) => {
    const list = form[key];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    patch(key === 'allergenIds' ? { allergenIds: next, noAllergies: false } : { [key]: next });
  };

  const addAvoid = () => {
    const v = avoidText.trim();
    if (!v || form.avoidIngredients.length >= 30) return;
    if (!form.avoidIngredients.some((x) => x.toLowerCase() === v.toLowerCase())) {
      patch({ avoidIngredients: [...form.avoidIngredients, v.slice(0, 80)] });
    }
    setAvoidText('');
  };

  const { taste, diet } = catalog.dietaryPreferences;

  return (
    <View>
      <StepTitle
        eyebrow="KHẨU VỊ"
        title="NOAN nên ghi nhớ điều gì?"
        subtitle="Chọn tất cả những gì phù hợp. Không chọn cũng được."
        mascot={MASCOT.serving}
      />

      {taste.length > 0 && (
        <Section icon={Soup} title="Khẩu vị yêu thích" right={<Count n={form.tasteIds.length} />}>
          <ChipWrap>
            {taste.map((t) => (
              <Chip key={t.id} label={t.name} active={form.tasteIds.includes(t.id)} onPress={() => toggle('tasteIds', t.id)} />
            ))}
          </ChipWrap>
        </Section>
      )}

      {diet.length > 0 && (
        <Section icon={Leaf} iconTone="green" title="Chế độ ăn" right={<Count n={form.dietIds.length} />}>
          <ChipWrap>
            {diet.map((d) => (
              <Chip key={d.id} label={d.name} active={form.dietIds.includes(d.id)} onPress={() => toggle('dietIds', d.id)} />
            ))}
          </ChipWrap>
        </Section>
      )}

      <Section
        icon={TriangleAlert}
        iconTone="danger"
        title="Dị ứng thực phẩm"
        hint="Món chứa thành phần này sẽ không bao giờ được gợi ý."
      >
        <ChipWrap>
          <Chip
            label="Không có dị ứng"
            active={form.noAllergies}
            icon={<Ban size={14} color={ob.sub} />}
            onPress={() => patch({ noAllergies: !form.noAllergies, allergenIds: [] })}
          />
          {catalog.allergens.map((a) => (
            <Chip key={a.id} tone="danger" label={a.name} active={form.allergenIds.includes(a.id)} onPress={() => toggle('allergenIds', a.id)} />
          ))}
        </ChipWrap>
      </Section>

      <Section icon={Utensils} title="Nguyên liệu không thích" hint="Ví dụ: hành lá, ngò, tiêu…" right={<OptionalTag />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={avoidText}
            onChangeText={setAvoidText}
            onSubmitEditing={addAvoid}
            placeholder="Nhập rồi bấm Thêm"
            placeholderTextColor={ob.muted}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={80}
            style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: ob.border, backgroundColor: ob.bg, paddingHorizontal: 12, fontSize: 15, color: ob.ink }}
          />
          <Pressable
            onPress={addAvoid}
            disabled={!avoidText.trim()}
            style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: avoidText.trim() ? ob.ink : ob.disabled, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Thêm</Text>
          </Pressable>
        </View>
        {form.avoidIngredients.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {form.avoidIngredients.map((name) => (
              <Pressable
                key={name}
                onPress={() => patch({ avoidIngredients: form.avoidIngredients.filter((x) => x !== name) })}
                accessibilityLabel={`Xóa ${name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 12, paddingRight: 8, borderRadius: 17, backgroundColor: ob.surfaceWarm, borderWidth: 1, borderColor: ob.border }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: ob.ink }}>{name}</Text>
                <X size={14} color={ob.sub} />
              </Pressable>
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

function Count({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={{ backgroundColor: ob.primarySoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: ob.gold700 }}>{n} đã chọn</Text>
    </View>
  );
}

// ─── 5 · Summary ↔ backend step 8 + POST /onboarding/complete ─────────────────

const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export function SummaryStep({ ctl, onEdit }: StepProps & { onEdit: (s: UiStep) => void }) {
  const { form, catalog, lookup } = ctl;
  const age = calcAge(form.birthDay, form.birthMonth, form.birthYear);
  const goal = catalog.goals.find((g) => g.id === form.primaryGoalId);
  const tastes = lookup([...form.tasteIds, ...form.dietIds]);
  const allergens = lookup(form.allergenIds);
  const avoid = [...allergens, ...form.avoidIngredients];

  const about = [form.displayName.trim() || null, `${age} tuổi`, form.gender ? GENDER_LABEL[form.gender] : null]
    .filter(Boolean)
    .join(' · ');
  const body = form.bodySkipped
    ? 'Chưa cập nhật'
    : `${form.heightCm} cm · ${form.weightKg} kg · BMI ${calcBmi(form.heightCm, form.weightKg).toFixed(1)}`;

  const rows = [
    { icon: User, label: 'Về bạn', value: about, step: UI_STEP.about },
    { icon: HeartPulseIcon, label: 'Cơ thể', value: body, step: UI_STEP.body },
    { icon: Target, label: 'Mục tiêu', value: goal?.name ?? 'Chưa chọn', step: UI_STEP.goal },
    { icon: Heart, label: 'Khẩu vị', value: tastes.length ? tastes.join(', ') : 'Ăn được hết', step: UI_STEP.prefs },
    {
      icon: ShieldCheck,
      label: 'Cần tránh',
      value: avoid.length ? avoid.join(', ') : form.noAllergies ? 'Không có dị ứng' : 'Chưa khai báo',
      step: UI_STEP.prefs,
    },
  ];

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: ob.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        <Image source={MASCOT.celebrate} resizeMode="contain" style={{ width: 172, height: 172 }} />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: ob.success, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: ob.bg }}>
          <Check size={20} color="#FFF" strokeWidth={3.5} />
        </View>
      </View>

      <Text style={{ fontSize: 26, fontWeight: '800', color: ob.ink, textAlign: 'center', marginTop: 16, letterSpacing: -0.5 }}>
        {form.displayName.trim() ? `Xong rồi, ${form.displayName.trim()}!` : 'Xong rồi!'}
      </Text>
      <Text style={{ fontSize: 14.5, color: ob.sub, textAlign: 'center', lineHeight: 21, marginTop: 6 }}>
        Kiểm tra lại thông tin. Chạm vào từng dòng để sửa.
      </Text>

      <View style={[{ width: '100%', backgroundColor: ob.surface, borderRadius: 20, marginTop: 18, paddingVertical: 4 }, cardShadow]}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={() => onEdit(r.step)}
            accessibilityRole="button"
            accessibilityLabel={`Sửa ${r.label}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: ob.surfaceWarm }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ob.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <r.icon size={18} color={ob.gold700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, color: ob.muted, fontWeight: '600' }}>{r.label}</Text>
              <Text style={{ fontSize: 15, color: ob.ink, fontWeight: '600', marginTop: 1 }} numberOfLines={2}>
                {r.value}
              </Text>
            </View>
            <Pencil size={16} color={ob.muted} />
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <Sparkles size={16} color={ob.gold700} />
        <Text style={{ fontSize: 13, color: ob.sub }}>NOAN sẽ ưu tiên món hợp với bạn ngay từ bữa đầu tiên.</Text>
      </View>
    </View>
  );
}