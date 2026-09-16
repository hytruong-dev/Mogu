import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,

  ChevronRight,
  Compass,
  Dumbbell,
  Leaf,
  Minus,
  Plus,
  Salad,
  Scale,
  ShieldCheck,
  Soup,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Utensils,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../lib/utils';
import { onboardingApi } from '../services/api/onboarding';

type Props = { onFinish: () => void };

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'balance', label: 'Ăn uống cân bằng', icon: Salad },
  { id: 'lose', label: 'Giảm cân', icon: Scale },
  { id: 'gain', label: 'Tăng cân', icon: TrendingUp },
  { id: 'fat', label: 'Giảm mỡ', icon: TrendingDown },
  { id: 'muscle', label: 'Tăng cơ', icon: Dumbbell },
  { id: 'explore', label: 'Chỉ muốn khám phá', icon: Compass },
];

const GENDER_OPTIONS = [
  { id: 'MALE', label: 'Nam', emoji: '👨' },
  { id: 'FEMALE', label: 'Nữ', emoji: '👩' },
  { id: 'OTHER', label: 'Khác', emoji: '🌈' },
  { id: 'PREFER_NOT_TO_SAY', label: 'Không muốn tiết lộ', emoji: '🤫' },
];

// ─── Step transition hook ──────────────────────────────────────────────────────

function useStepTransition(width: number) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const transition = useCallback(
    (next: number, current: number, onChange: (n: number) => void) => {
      const direction = next > current ? 1 : -1;
      Haptics.selectionAsync();
      opacity.value = withTiming(0, { duration: 150 });
      translateX.value = withTiming(
        -direction * 24,
        { duration: 150, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (!finished) return;
          runOnJS(onChange)(next);
          translateX.value = direction * width * 0.1;
          opacity.value = withTiming(1, { duration: 280 });
          translateX.value = withTiming(0, {
            duration: 340,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          });
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return { transition, animStyle };
}

// ─── SplashScreen (Root) ──────────────────────────────────────────────────────

export function SplashScreen({ onFinish }: Props) {
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);

  // Step 2 — Profile
  const [displayName, setDisplayName] = useState('');
  const [birthDay, setBirthDay] = useState(18);
  const [birthMonth, setBirthMonth] = useState(8);
  const [birthYear, setBirthYear] = useState(2000);
  const [gender, setGender] = useState<string | null>(null);
  // Step 3 — Body
  const [heightValue, setHeightValue] = useState(170);
  const [weight, setWeight] = useState(60);
  // Step 4 — Goal
  const [goal, setGoal] = useState('balance');
  // Step 5 — Preferences
  const [taste, setTaste] = useState<string | null>(null);
  const [diet, setDiet] = useState<string | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  // API
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  const { transition, animStyle } = useStepTransition(width);
  const TOTAL = 6; // 0..5, step 5 = CompletionScreen
  const go = (next: number) => transition(next, step, setStep);

  const toggleAllergy = (id: string) =>
    setAllergies((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const finishOnboarding = async () => {
    setSaving(true);
    setApiError('');
    try {
      await onboardingApi.start();
      const [state, catalog] = await Promise.all([onboardingApi.state(), onboardingApi.catalog()]);
      let version = state.profileVersion;

      // Step 2: name
      if (displayName.trim()) {
        const s2 = await onboardingApi.saveStep(2, { displayName: displayName.trim() }, version);
        version = s2.profileVersion ?? version;
      } else {
        await onboardingApi.skipStep(2);
      }

      // Step 3: birthday
      const dob = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
      const s3 = await onboardingApi.saveStep(3, { dateOfBirth: dob }, version);
      version = s3.profileVersion ?? version;

      // Step 4: gender
      if (gender) {
        const s4 = await onboardingApi.saveStep(4, { gender }, version);
        version = s4.profileVersion ?? version;
      } else {
        await onboardingApi.skipStep(4);
      }

      // Step 5: body
      const s5 = await onboardingApi.saveStep(5, { heightCm: heightValue, weightKg: weight }, version);
      version = s5.profileVersion ?? version;

      // Step 6: goal
      const goalCodes: Record<string, string> = {
        balance: 'BALANCE',
        lose: 'LOSE_WEIGHT',
        gain: 'EAT_HEALTHY',
        fat: 'LOSE_WEIGHT',
        muscle: 'BUILD_MUSCLE',
        explore: 'EXPLORE',
      };
      const goalItem =
        catalog.goals.find((item) => item.code === goalCodes[goal]) ?? catalog.goals[0];
      if (!goalItem) throw new Error('Backend chưa có danh mục mục tiêu onboarding.');
      const s6 = await onboardingApi.saveStep(
        6,
        { primaryGoalId: goalItem.id, secondaryGoalIds: [] },
        version,
      );
      version = s6.profileVersion ?? version;

      // Step 7: preferences
      const tasteCodes: Record<string, string> = { spicy: 'SPICY', mild: 'MILD', soup: 'SOUPY' };
      const preferenceCodes = [taste ? tasteCodes[taste] : null, diet?.toUpperCase()]
        .filter(Boolean) as string[];
      const preferenceIds = [
        ...catalog.dietaryPreferences.taste,
        ...catalog.dietaryPreferences.diet,
      ]
        .filter((item) => preferenceCodes.includes(item.code))
        .map((item) => item.id);

      const allergenItems = catalog.allergens.filter((a) =>
        allergies.includes(a.code.toLowerCase()),
      );
      await onboardingApi.saveStep(
        7,
        {
          dietaryPreferenceIds: preferenceIds,
          noAllergies: allergenItems.length === 0,
          allergenIds: allergenItems.map((a) => a.id),
        },
        version,
      );

      await onboardingApi.complete(version);
      onFinish();
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'Không thể lưu thông tin onboarding.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Step 5 = Completion
  if (step === 5) {
    const allergyLabel =
      allergies.length === 0
        ? 'Không có'
        : allergies
          .map((a) => {
            const map: Record<string, string> = {
              seafood: 'Hải sản',
              peanut: 'Đậu phộng',
              milk: 'Sữa',
              beef: 'Thịt bò',
            };
            return map[a] ?? a;
          })
          .join(', ');

    return (
      <CompletionScreen
        goal={GOALS.find((g) => g.id === goal)?.label ?? 'Ăn uống cân bằng'}
        heightValue={heightValue}
        weight={weight}
        allergyLabel={allergyLabel}
        onFinish={finishOnboarding}
        saving={saving}
        apiError={apiError}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FEF8E8' }}>
      {/* Glow bg */}
      <View
        style={{
          position: 'absolute',
          top: '8%',
          left: '-20%',
          width: '140%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: 'rgba(255,213,79,0.12)',
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header row */}
        <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 }}>
          {step > 0 ? (
            <Pressable
              onPress={() => go(step - 1)}
              style={({ pressed }) => ({
                width: 35, height: 35, borderRadius: 22,
                backgroundColor: '#FFF',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#67541C', shadowOpacity: 0.12, shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 }, elevation: 3,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <ArrowLeft size={26} color="#111" strokeWidth={2.4} />
            </Pressable>
          ) : (
            <View style={{ width: 35 }} />
          )}
          <Pressable hitSlop={14} onPress={onFinish}>
            <Text style={{ fontSize: 17, fontWeight: '500', color: '#333' }}>Bỏ qua</Text>
          </Pressable>
        </View>

        {/* Progress dots + badge */}
        <ProgressRow step={step} total={TOTAL - 1} />

        {/* Animated content */}
        <Animated.View style={[animStyle, { flex: 1 }]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && <WelcomeStep />}
            {step === 1 && (
              <ProfileStep
                displayName={displayName} onDisplayName={setDisplayName}
                birthDay={birthDay} birthMonth={birthMonth} birthYear={birthYear}
                onBirthDay={setBirthDay} onBirthMonth={setBirthMonth} onBirthYear={setBirthYear}
                gender={gender} onGender={setGender}
              />
            )}
            {step === 2 && (
              <BodyStep heightValue={heightValue} weight={weight} onHeight={setHeightValue} onWeight={setWeight} />
            )}
            {step === 3 && <GoalStep selected={goal} onSelect={setGoal} />}
            {step === 4 && (
              <PreferenceStep
                taste={taste} onTaste={setTaste}
                diet={diet} onDiet={setDiet}
                allergies={allergies} onToggleAllergy={toggleAllergy}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* Footer */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <NextButton
            label={step === 0 ? 'Bắt đầu' : 'Tiếp tục'}
            onPress={() => go(step + 1)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── ProgressRow ──────────────────────────────────────────────────────────────

function ProgressRow({ step, total }: { step: number; total: number }) {
  // step là 0-indexed (0..4), total = 5 dots
  const displayStep = step + 1; // 1-indexed cho badge
  return (
    <View style={{ alignItems: 'center', marginBottom: 6, paddingTop: 4 }}>
      {/* Dots */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              height: 5,
              borderRadius: 3,
              width: i === step ? 36 : 14,
              backgroundColor: i <= step ? '#FFC20E' : '#DDD9CF',
            }}
          />
        ))}
      </View>
      {/* Badge bước — hiển thị ở tất cả các bước */}
      <View style={{
        marginTop: 8,
        paddingHorizontal: 14, paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: '#FFF6D6',
        borderWidth: 1,
        borderColor: '#FFD83E',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#7A5C0B' }}>
          Bước {displayStep}/{total}
        </Text>
      </View>
    </View>
  );
}

// ─── Mascot Hero ──────────────────────────────────────────────────────────────

function MascotHero({
  source,
  height = 230,
}: {
  source: any;
  height?: number;
}) {
  const { width } = useWindowDimensions();
  // Kích thước circle tuyệt đối = 80% chiều rộng màn hình, không phụ thuộc container
  const circleSize = width * 0.72;

  return (
    // overflow: visible để circle không bị clip bởi View cha
    <View style={{ width: '100%', height, alignItems: 'center', justifyContent: 'center', marginTop: 8, overflow: 'visible' }}>
      {/* Yellow glow circle — kích thước tuyệt đối */}
      <View
        style={{
          position: 'absolute',
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: 'rgba(255,215,70,0.25)',
        }}
      />
      {/* Stars */}
      <Text style={{ position: 'absolute', left: 14, top: 30, fontSize: 22, color: '#FFC20E', zIndex: 2 }}>✦</Text>
      <Text style={{ position: 'absolute', right: 18, top: 55, fontSize: 18, color: '#FFC20E', zIndex: 2 }}>✧</Text>
      <Image source={source} resizeMode="contain" style={{ width: '100%', height: '100%', zIndex: 3 }} />
    </View>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <MascotHero source={require('../assets/images/onboarding/welcome-cropped.png')} height={240} />

      <Text style={{ fontSize: 31, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 38, letterSpacing: -0.8, marginTop: 6 }}>
        {'Chào mừng bạn\nđến với Mogu!'}
      </Text>
      <Text style={{ fontSize: 15, color: '#4E4A43', textAlign: 'center', lineHeight: 22, marginTop: 8 }}>
        {'Mỗi ngày một món ngon,\nmỗi lựa chọn đều hợp với bạn hơn.'}
      </Text>

      {/* Heart icon */}
      <Text style={{ fontSize: 22, marginTop: 10 }}>🩷</Text>

      {/* 3 feature chips */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' }}>
        {[
          { icon: <UserRound size={22} color="#111" strokeWidth={2} />, label: 'Gợi ý cá nhân' },
          { icon: <Zap size={22} color="#111" strokeWidth={2} />, label: 'Chọn nhanh' },
          { icon: <Utensils size={22} color="#111" strokeWidth={2} />, label: 'Khám phá\nmón mới' },
        ].map(({ icon, label }) => (
          <View
            key={label}
            style={{
              flex: 1, backgroundColor: '#FFF', borderRadius: 20,
              alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 8,
              shadowColor: '#B19B66', shadowOpacity: 0.1, shadowRadius: 10, elevation: 2,
            }}
          >
            {icon}
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#111', textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Step 1: Profile ──────────────────────────────────────────────────────────

function ProfileStep({
  displayName, onDisplayName,
  birthDay, birthMonth, birthYear,
  onBirthDay, onBirthMonth, onBirthYear,
  gender, onGender,
}: {
  displayName: string; onDisplayName: (v: string) => void;
  birthDay: number; birthMonth: number; birthYear: number;
  onBirthDay: (v: number) => void; onBirthMonth: (v: number) => void; onBirthYear: (v: number) => void;
  gender: string | null; onGender: (v: string | null) => void;
}) {
  const dobLabel = `${birthDay} tháng ${birthMonth}, ${birthYear}`;

  return (
    <View style={{ paddingTop: 8 }}>
      <MascotHero source={require('../assets/images/onboarding/welcome-cropped.png')} height={190} />

      <Text style={{ fontSize: 29, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 36, letterSpacing: -0.7 }}>
        Mogu gọi bạn là gì?
      </Text>
      <Text style={{ fontSize: 14, color: '#4E4A43', textAlign: 'center', lineHeight: 20, marginTop: 6 }}>
        Thông tin này giúp trải nghiệm gần gũi hơn.
      </Text>

      {/* White card */}
      <View style={{ marginTop: 20, backgroundColor: '#FFF', borderRadius: 22, padding: 16, shadowColor: '#B19B66', shadowOpacity: 0.1, shadowRadius: 12, elevation: 2 }}>

        {/* Tên bạn */}
        <ProfileSectionLabel icon="👤" label="Tên bạn" />
        <View style={{ marginTop: 8 }}>
          <Input
            value={displayName}
            onChangeText={onDisplayName}
            placeholder="Ví dụ: Minh, An, Huy..."
            placeholderTextColor="#BBBAB5"
            className="h-12 rounded-xl border border-[#EAE6DF] bg-white px-3.5 text-base font-medium text-[#111]"
            maxLength={40}
            returnKeyType="next"
          />
        </View>
        <Text style={{ fontSize: 12, color: '#AAA5A0', marginTop: 4 }}>Không bắt buộc</Text>

        <Separator className="my-3.5 bg-[#F0EBE3]" />

        {/* Ngày sinh */}
        <ProfileSectionLabel icon="📅" label="Ngày sinh" />
        <DatePickerRow
          day={birthDay} month={birthMonth} year={birthYear}
          dobLabel={dobLabel}
          onDay={onBirthDay} onMonth={onBirthMonth} onYear={onBirthYear}
        />

        <Separator className="my-3.5 bg-[#F0EBE3]" />

        {/* Giới tính */}
        <ProfileSectionLabel icon="⚥" label="Giới tính" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onGender(active ? null : opt.id)}
                style={{
                  flexBasis: '47%', height: 50,
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
                  borderRadius: 14, borderWidth: active ? 2 : 1,
                  borderColor: active ? '#FFD83E' : '#E8E6E1',
                  backgroundColor: active ? '#FFFBE8' : '#FFF',
                  shadowColor: '#000', shadowOpacity: active ? 0.1 : 0.04,
                  shadowRadius: 6, elevation: active ? 3 : 1,
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 8 }}>{opt.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#111' : '#4E4A43', flex: 1 }}>
                  {opt.label}
                </Text>
                {active && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFD83E', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color="#111" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function ProfileSectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>
      {icon}  {label}
    </Text>
  );
}

// ─── DatePickerRow (react-native-reusables Select) ───────────────────────────

function DatePickerRow({
  day, month, year, dobLabel,
  onDay, onMonth, onYear,
}: {
  day: number; month: number; year: number; dobLabel: string;
  onDay: (v: number) => void; onMonth: (v: number) => void; onYear: (v: number) => void;
}) {
  const dayOpts = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Ngày ${i + 1}` }));
  const monthOpts = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }));
  const yearOpts = Array.from({ length: 100 }, (_, i) => {
    const y = new Date().getFullYear() - 5 - i;
    return { value: String(y), label: `Năm ${y}` };
  });

  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Calendar size={18} color="#888" strokeWidth={1.8} />
        <Text style={{ fontSize: 14, color: '#666' }}>{dobLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Select
            value={{ value: String(day), label: `Ngày ${day}` }}
            onValueChange={(opt) => { if (opt?.value) onDay(Number(opt.value)); }}
          >
            <SelectTrigger className="h-12 rounded-xl border border-[#EAE6DF] bg-white">
              <SelectValue placeholder="Ngày" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {dayOpts.map((o) => (
                <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View style={{ flex: 1.1 }}>
          <Select
            value={{ value: String(month), label: `Tháng ${month}` }}
            onValueChange={(opt) => { if (opt?.value) onMonth(Number(opt.value)); }}
          >
            <SelectTrigger className="h-12 rounded-xl border border-[#EAE6DF] bg-white">
              <SelectValue placeholder="Tháng" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {monthOpts.map((o) => (
                <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View style={{ flex: 1.2 }}>
          <Select
            value={{ value: String(year), label: `Năm ${year}` }}
            onValueChange={(opt) => { if (opt?.value) onYear(Number(opt.value)); }}
          >
            <SelectTrigger className="h-12 rounded-xl border border-[#EAE6DF] bg-white">
              <SelectValue placeholder="Năm" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {yearOpts.map((o) => (
                <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
      </View>
    </View>
  );
}

// ─── Step 2: Body ─────────────────────────────────────────────────────────────

function BodyStep({
  heightValue, weight, onHeight, onWeight,
}: {
  heightValue: number; weight: number;
  onHeight: (v: number) => void; onWeight: (v: number) => void;
}) {
  return (
    <View style={{ paddingTop: 4 }}>
      <MascotHero source={require('../assets/images/onboarding/body-info.png')} height={210} />

      <Text style={{ fontSize: 29, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 36, letterSpacing: -0.7 }}>
        Cơ thể của bạn hiện tại
      </Text>
      <Text style={{ fontSize: 14, color: '#4E4A43', textAlign: 'center', lineHeight: 21, marginTop: 6 }}>
        {'Mogu dùng thông tin này để cá nhân hóa\nkhẩu phần phù hợp hơn.'}
      </Text>

      {/* Two cards */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <BodyCard label="Chiều cao" value={heightValue} unit="cm" min={50} max={300} onChange={onHeight} />
        <BodyCard label="Cân nặng" value={weight} unit="kg" min={10} max={500} onChange={onWeight} />
      </View>

      {/* Metric / Imperial toggle (decorative) */}
      <View style={{ flexDirection: 'row', marginTop: 14, borderRadius: 20, backgroundColor: '#EEE8DD', padding: 4 }}>
        <View style={{ flex: 1, height: 38, borderRadius: 16, backgroundColor: '#FFD43E', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Text style={{ fontSize: 16 }}>📏</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>Metric</Text>
        </View>
        <View style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Text style={{ fontSize: 16 }}>📏</Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#888' }}>Imperial</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' }}>
        <ShieldCheck size={18} color="#111" />
        <Text style={{ fontSize: 13, color: '#4E4A43' }}>Bạn có thể cập nhật lại bất kỳ lúc nào.</Text>
      </View>
    </View>
  );
}

function BodyCard({
  label, value, unit, min, max, onChange,
}: {
  label: string; value: number; unit: string;
  min: number; max: number; onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<any>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const startEdit = () => {
    setRaw(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  return (
    <View style={{
      flex: 1, backgroundColor: '#FFF', borderRadius: 22,
      padding: 16, alignItems: 'center',
      shadowColor: '#B19B66', shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
    }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12 }}>{label}</Text>

      {/* Big number */}
      <Pressable onPress={startEdit} style={{ width: '100%', alignItems: 'center', minHeight: 60, justifyContent: 'center' }}>
        {editing ? (
          <Input
            ref={inputRef}
            value={raw}
            onChangeText={(t) => setRaw(t.replace(/[^0-9]/g, ''))}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
            maxLength={3}
            className="border-0 bg-transparent p-0 text-center shadow-none"
            style={{ fontSize: 52, fontWeight: '900', color: '#111', textAlign: 'center', width: '100%' }}
          />
        ) : (
          <Text style={{ fontSize: 52, fontWeight: '900', color: '#111' }}>{value}</Text>
        )}
      </Pressable>

      {/* Unit badge */}
      <LinearGradient
        colors={['#FFD63B', '#FFC316']}
        style={{ paddingHorizontal: 18, paddingVertical: 5, borderRadius: 12, marginTop: 4 }}
      >
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>{unit}</Text>
      </LinearGradient>

      {/* Stepper */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 }}>
        <Pressable
          onPress={() => onChange(clamp(value - 1))}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5DD', alignItems: 'center', justifyContent: 'center', elevation: 1 }}
        >
          <Minus size={20} color="#111" />
        </Pressable>
        <View style={{ width: 14, height: 1, backgroundColor: '#CBC8C2' }} />
        <Pressable
          onPress={() => onChange(clamp(value + 1))}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5DD', alignItems: 'center', justifyContent: 'center', elevation: 1 }}
        >
          <Plus size={20} color="#111" />
        </Pressable>
      </View>
    </View>
  );
}


// ─── Step 3: Goal ─────────────────────────────────────────────────────────────

function GoalStep({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  return (
    <View style={{ paddingTop: 4 }}>
      <MascotHero source={require('../assets/images/onboarding/goal.png')} height={200} />

      <Text style={{ fontSize: 29, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 36, letterSpacing: -0.7 }}>
        Mục tiêu của bạn là gì?
      </Text>
      <Text style={{ fontSize: 14, color: '#4E4A43', textAlign: 'center', lineHeight: 20, marginTop: 6 }}>
        Chọn một mục tiêu chính, bạn có thể thay đổi sau.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
        {GOALS.map(({ id, label, icon: Icon }) => {
          const active = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => { onSelect(id); Haptics.selectionAsync(); }}
              style={{
                width: '47.5%', height: 100,
                borderRadius: 20, borderWidth: active ? 2 : 1,
                borderColor: active ? '#111' : '#EEE8DD',
                backgroundColor: active ? '#FFE27A' : '#FFF',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                shadowColor: '#7A5D1C', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
                position: 'relative',
              }}
            >
              <Icon size={36} color="#111" strokeWidth={1.8} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#111', textAlign: 'center', paddingHorizontal: 4 }}>
                {label}
              </Text>
              {active && (
                <View style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={14} color="#FFD83E" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, justifyContent: 'center' }}>
        <ShieldCheck size={18} color="#111" />
        <Text style={{ fontSize: 12, color: '#4E4A43' }}>Mogu sẽ ưu tiên món phù hợp với mục tiêu này.</Text>
      </View>
    </View>
  );
}

// ─── Step 4: Preferences ─────────────────────────────────────────────────────

const TASTE_OPTIONS = [
  { id: 'spicy', label: 'Thích ăn cay' },
  { id: 'mild', label: 'Không ăn cay' },
  { id: 'soup', label: 'Thích món nước' },
  { id: 'sweet', label: 'Thích vị ngọt' },
  { id: 'sour', label: 'Thích vị chua' },
];

const DIET_OPTIONS = [
  { id: 'vegetarian', label: 'Ăn chay' },
  { id: 'eat_clean', label: 'Eat clean' },
  { id: 'low_carb', label: 'Ít tinh bột' },
  { id: 'vegan', label: 'Thuần chay' },
  { id: 'keto', label: 'Keto' },
  { id: 'high_protein', label: 'Giàu đạm' },
];

const ALLERGY_OPTIONS = [
  { id: 'seafood', label: 'Hải sản' },
  { id: 'peanut', label: 'Đậu phộng' },
  { id: 'milk', label: 'Sữa' },
  { id: 'beef', label: 'Thịt bò' },
  { id: 'egg', label: 'Trứng' },
  { id: 'soy', label: 'Đậu nành' },
  { id: 'wheat', label: 'Gluten/Lúa mì' },
  { id: 'shellfish', label: 'Động vật có vỏ' },
];

// ─── TagSearchBox — search input kèm chip tags và dropdown ───────────────────

function TagSearchBox({
  icon,
  iconBg,
  title,
  placeholder,
  selected,
  options,
  onToggle,
  danger = false,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  placeholder: string;
  selected: string[];
  options: { id: string; label: string }[];
  onToggle: (id: string) => void;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = options.filter(
    (o) =>
      !selected.includes(o.id) &&
      o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const selectedItems = options.filter((o) => selected.includes(o.id));

  return (
    <View style={{ marginTop: 14 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111' }}>{title}</Text>
      </View>

      {/* Search row */}
      <Pressable
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
          minHeight: 50,
          borderWidth: 1.5,
          borderColor: open ? '#FFD83E' : '#EAE6DF',
          borderRadius: 16,
          paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: '#FFF',
          gap: 6,
        }}
      >
        {/* Search icon */}
        <View style={{ marginRight: 2 }}>
          <Text style={{ fontSize: 16, color: '#AAA' }}>🔍</Text>
        </View>

        {/* Selected chips inside input */}
        {selectedItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
              backgroundColor: danger ? '#FFEAE8' : '#FFF6D6',
              borderWidth: 1,
              borderColor: danger ? '#FFBDB6' : '#FFD83E',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: danger ? '#D63B2F' : '#6B4B00' }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 13, color: danger ? '#D63B2F' : '#999', lineHeight: 14 }}>×</Text>
          </Pressable>
        ))}

        {/* Placeholder text */}
        {selectedItems.length === 0 && !open && (
          <Text style={{ flex: 1, fontSize: 14, color: '#BBBAB5' }}>{placeholder}</Text>
        )}

        {/* Text input khi open */}
        {open && (
          <Input
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor="#BBBAB5"
            className="border-0 bg-transparent p-0 shadow-none"
            style={{ flex: 1, fontSize: 14, color: '#111', paddingVertical: 0, minWidth: 80 }}
          />
        )}

        {/* Dropdown arrow */}
        <View style={{ marginLeft: 'auto' }}>
          <Text style={{ fontSize: 14, color: '#AAA' }}>{open ? '▲' : '▽'}</Text>
        </View>
      </Pressable>

      {/* Dropdown list */}
      {open && (
        <View style={{
          marginTop: 4, borderWidth: 1, borderColor: '#EAE6DF', borderRadius: 14,
          backgroundColor: '#FFF', overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
        }}>
          {filtered.length === 0 ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#BBBAB5', fontSize: 13 }}>Không tìm thấy kết quả</Text>
            </View>
          ) : (
            filtered.slice(0, 6).map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onToggle(item.id);
                  setQuery('');
                }}
                style={({ pressed }) => ({
                  paddingVertical: 13, paddingHorizontal: 16,
                  borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F5F0E8',
                  backgroundColor: pressed ? '#FFFBE8' : '#FFF',
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                })}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: danger ? '#FF6B5B' : '#FFD83E' }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#222' }}>{item.label}</Text>
              </Pressable>
            ))
          )}
          {/* Close dropdown */}
          <Pressable
            onPress={() => { setOpen(false); setQuery(''); }}
            style={{ padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F5F0E8' }}
          >
            <Text style={{ fontSize: 12, color: '#AAA' }}>Đóng ▲</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PreferenceStep({
  taste, onTaste, diet, onDiet, allergies, onToggleAllergy,
}: {
  taste: string | null; onTaste: (v: string | null) => void;
  diet: string | null; onDiet: (v: string | null) => void;
  allergies: string[]; onToggleAllergy: (id: string) => void;
}) {
  // Chuyển single value → array để dùng TagSearchBox
  const dietArr = diet ? [diet] : [];

  const handleDietToggle = (id: string) => {
    onDiet(diet === id ? null : id);
  };

  return (
    <View style={{ paddingTop: 4 }}>
      <Text style={{ fontSize: 29, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 36, letterSpacing: -0.7, marginTop: 8 }}>
        Mogu nên ghi nhớ điều gì?
      </Text>
      <Text style={{ fontSize: 14, color: '#4E4A43', textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 4 }}>
        Chọn khẩu vị và những nguyên liệu bạn cần tránh.
      </Text>

      {/* White card */}
      <View style={{
        marginTop: 14, backgroundColor: '#FFF', borderRadius: 22,
        padding: 16,
        shadowColor: '#B19B66', shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
      }}>
        {/* Chế độ ăn */}
        <TagSearchBox
          icon={<Leaf size={17} color="#111" strokeWidth={2} />}
          iconBg="#FFD74A"
          title="Chế độ ăn"
          placeholder="Tìm chế độ ăn"
          selected={dietArr}
          options={DIET_OPTIONS}
          onToggle={handleDietToggle}
        />

        <View style={{ height: 1, backgroundColor: '#F0EBE3', marginTop: 16 }} />

        {/* Dị ứng hoặc hạn chế */}
        <TagSearchBox
          icon={<TriangleAlert size={17} color="#FF5A42" strokeWidth={2} />}
          iconBg="#FFE8E5"
          title="Dị ứng hoặc hạn chế"
          placeholder="Tìm nguyên liệu"
          selected={allergies}
          options={ALLERGY_OPTIONS}
          onToggle={onToggleAllergy}
          danger
        />

        <Text style={{ fontSize: 12, color: '#AAA5A0', marginTop: 10 }}>
          Nhập để tìm và chọn nhiều mục.
        </Text>
      </View>

      {/* Warning box */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: '#FFF8E1', borderRadius: 14,
        borderWidth: 1, borderColor: '#FFD83E',
      }}>
        <TriangleAlert size={16} color="#E08A00" fill="#FFD83E" />
        <Text style={{ flex: 1, fontSize: 12, color: '#7A5000', lineHeight: 18 }}>
          Món chứa thành phần cần tránh sẽ không được gợi ý.
        </Text>
      </View>
    </View>
  );
}

function PrefSection({
  icon, title, children, last,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEE8DD' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFD74A', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function PrefChip({
  label, active, danger, onPress,
}: {
  label: string; active: boolean; danger?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? (danger ? '#FF5A42' : '#F5B900') : '#E6E1D8',
        backgroundColor: active ? (danger ? '#FFF0EE' : '#FFE566') : '#FFF',
        flexDirection: 'row', alignItems: 'center', gap: 5,
      }}
    >
      {active && <Check size={13} color={danger ? '#FF5A42' : '#111'} strokeWidth={3} />}
      <Text style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? (danger ? '#FF5A42' : '#111') : '#333' }}>
        {label}
      </Text>
    </Pressable>
  );
}


// Helper: circle dùng useWindowDimensions để không bị cắt
function CompletionCircle() {
  const { width } = useWindowDimensions();
  const size = width * 0.72;
  return (
    <View
      style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(255,215,70,0.22)',
      }}
    />
  );
}

// ─── Step 5: Completion ───────────────────────────────────────────────────────

function CompletionScreen({
  goal, heightValue, weight, allergyLabel, onFinish, saving, apiError,
}: {
  goal: string; heightValue: number; weight: number; allergyLabel: string;
  onFinish: () => void; saving: boolean; apiError: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FEF8E8' }}>
      <View style={{ position: 'absolute', top: '8%', left: '-20%', width: '140%', aspectRatio: 1, borderRadius: 9999, backgroundColor: 'rgba(255,213,79,0.12)' }} />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 22 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Text style={{ fontSize: 17, fontWeight: '500', color: '#999' }}>Bỏ qua</Text>
        </View>

        {/* Progress dots only */}
        <View style={{ alignItems: 'center', marginBottom: 8, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={{ height: 5, borderRadius: 3, width: i === 4 ? 36 : 14, backgroundColor: '#FFC20E' }} />
            ))}
          </View>
        </View>

        {/* Mascot */}
        <View style={{ height: 270, alignItems: 'center', justifyContent: 'center', marginTop: 8, overflow: 'visible' }}>
          <CompletionCircle />
          <Text style={{ position: 'absolute', left: 14, top: 40, fontSize: 22, color: '#FFC20E', zIndex: 2 }}>✦</Text>
          <Image source={require('../assets/images/onboarding/complete.png')} resizeMode="contain" style={{ width: '88%', height: '100%', zIndex: 3 }} />
          <View style={{
            position: 'absolute', top: 28, right: 28,
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: '#FFC416', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#D09E00', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
          }}>
            <Check size={30} color="#FFF" strokeWidth={3.5} />
          </View>
        </View>

        <Text style={{ fontSize: 31, fontWeight: '900', color: '#111', textAlign: 'center', lineHeight: 38, letterSpacing: -0.8, marginTop: 4 }}>
          Mogu đã hiểu bạn hơn rồi!
        </Text>
        <Text style={{ fontSize: 15, color: '#3F3C37', textAlign: 'center', lineHeight: 22, marginTop: 8 }}>
          {'Từ hôm nay, mỗi khi phân vân ăn gì,\nMogu sẽ chọn giúp bạn.'}
        </Text>

        {/* Summary card */}
        <View style={{ marginTop: 18, backgroundColor: '#FFF', borderRadius: 22, paddingHorizontal: 16, shadowColor: '#7A5D1C', shadowOpacity: 0.1, shadowRadius: 15, elevation: 3 }}>
          <SummaryRow icon={<Target size={22} color="#F2B900" />} label="Mục tiêu" value={goal} />
          <SummaryRow icon={<UserRound size={22} color="#F2B900" />} label="Thông tin" value={`${heightValue} cm · ${weight} kg`} />
          <SummaryRow icon={<ShieldCheck size={22} color="#111" />} label="Cần tránh" value={allergyLabel} last />
        </View>

        {/* Edit hint */}
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          <Text style={{ fontSize: 14, color: '#888' }}>✏️  Chỉnh sửa</Text>
        </Pressable>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {apiError ? <Text style={{ marginBottom: 6, textAlign: 'center', fontSize: 12, color: '#EF4444' }}>{apiError}</Text> : null}

        <NextButton
          label={saving ? 'Đang lưu...' : 'Khám phá món đầu tiên'}
          onPress={saving ? () => undefined : onFinish}
        />
        <View style={{ height: 4 }} />
      </SafeAreaView>
    </View>
  );
}

function SummaryRow({
  icon, label, value, last,
}: {
  icon: React.ReactNode; label: string; value: string; last?: boolean;
}) {
  return (
    <View style={{
      minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEE8DD',
    }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF4C8', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#111' }}>{label}</Text>
      <Text style={{ marginLeft: 'auto', fontSize: 15, fontWeight: '500', color: '#292929' }}>{value}</Text>
    </View>
  );
}

// ─── NextButton ───────────────────────────────────────────────────────────────

function NextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withSpring(1, { damping: 10, stiffness: 220 }),
    );
    setTimeout(onPress, 90);
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable onPress={handlePress}>
        <LinearGradient
          colors={['#FFC20E', '#FFDB46', '#FFC20E']}
          style={{
            height: 62, borderRadius: 32, flexDirection: 'row',
            alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24,
            shadowColor: '#D09E00', shadowOpacity: 0.25, shadowRadius: 14, elevation: 5,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111', textAlign: 'center' }}>
              {label}
            </Text>
          </View>
          <ArrowRight size={28} color="#111" strokeWidth={2.5} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
