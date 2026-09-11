import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  budgetKeyToDto,
  getRandomizationContext,
  mealKeyToSlot,
  normalizeImageUrl,
  randomizeDish,
  retryRandomization,
  selectRandomization,
  recordRecommendationEvent,
  type RandomizationContext,
  type RandomizationResult,
} from '../services/api/randomization';
import { formatApiErrorWithCode } from '../lib/api-error';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FoodDetailFlowScreen, type FoodDetailPage } from './FoodDetailFlowScreen';
import {
  AlarmClock,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Heart,
  Leaf,
  MapPin,
  MapPinned,
  PiggyBank,
  RotateCcw,
  Search,
  Salad,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Utensils,
  X,
} from 'lucide-react-native';

const YELLOW = '#FFC31A';
const CREAM = '#FFF9EB';
const INK = '#101010';
const MUTED = '#686868';
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

type Props = { onClose: () => void };

const ORBIT_DISHES = [
  { name: 'Phở bò', image: require('../assets/images/random/pho-result.jpg') },
  { name: 'Bún riêu', image: require('../assets/images/random/bun-rieu.jpg') },
  { name: 'Cháo gà', image: require('../assets/images/random/chao-ga.jpg') },
  { name: 'Bánh cuốn', image: require('../assets/images/random/banh-cuon.jpg') },
] as const;

function slotToMealKey(slot: string): string {
  const map: Record<string, string> = {
    BREAKFAST: 'Sáng',
    LUNCH: 'Trưa',
    DINNER: 'Tối',
    SNACK: 'Bữa phụ',
    ANY: 'Bất kỳ',
  };
  return map[slot] ?? 'Trưa';
}

export function RandomFlowScreen({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [meal, setMeal] = useState('Trưa');
  const [budget, setBudget] = useState('40K–80K');
  const [ba006Result, setBa006Result] = useState<RandomizationResult | null>(null);
  const [randomContext, setRandomContext] = useState<RandomizationContext | null>(null);
  const [noCandidateMessage, setNoCandidateMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<FoodDetailPage | null>(null);
  const pendingRetryId = useRef<string | null>(null);
  const lastDishIdRef = useRef<string | null>(null);
  const transitionX = useRef(new Animated.Value(0)).current;
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const busy = useRef(false);

  useEffect(() => {
    getRandomizationContext()
      .then((ctx) => {
        setRandomContext(ctx);
        if (ctx.suggestedMealSlot) {
          setMeal(slotToMealKey(ctx.suggestedMealSlot));
        }
      })
      .catch(() => {
        // Context optional — budget/meal still work without it
      });
  }, []);

  const navigate = (next: number, direction: 1 | -1) => {
    if (busy.current) return;
    busy.current = true;
    Animated.parallel([
      Animated.timing(transitionX, {
        toValue: direction * -28,
        duration: 155,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(transitionOpacity, { toValue: 0, duration: 155, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      transitionX.setValue(direction * 32);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(transitionX, {
            toValue: 0,
            duration: 195,
            easing: EASE,
            useNativeDriver: true,
          }),
          Animated.timing(transitionOpacity, {
            toValue: 1,
            duration: 195,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]).start(() => {
          busy.current = false;
        });
      });
    });
  };

  const back = () => {
    if (step === 0) onClose();
    else navigate(step - 1, -1);
  };

  const fetchRandom = useCallback(async () => {
    const retryId = pendingRetryId.current;
    pendingRetryId.current = null;
    setFetchError(null);
    setNoCandidateMessage(null);

    try {
      const result = retryId
        ? await retryRandomization(retryId, true)
        : await randomizeDish({
            source: retryId ? 'RANDOM_AGAIN' : 'RANDOM_FLOW',
            meal: { slot: mealKeyToSlot(meal), selectionSource: 'USER_SELECTED' },
            budget: budgetKeyToDto(budget),
            excludeDishIds: lastDishIdRef.current ? [lastDishIdRef.current] : undefined,
          });

      setBa006Result(result);

      if (result?.dish) {
        lastDishIdRef.current = result.dish.id;
        if (result.randomizationId) {
          recordRecommendationEvent(result.randomizationId, 'IMPRESSION').catch(() => {});
        }
        setDetailPage('result');
        return;
      }

      const summary =
        result?.reason?.summary ??
        result?.explanation?.summary ??
        'Không tìm thấy món phù hợp với tiêu chí của bạn.';
      setNoCandidateMessage(summary);
      setStep(3);
    } catch (err) {
      setFetchError(formatApiErrorWithCode(err));
      setStep(3);
    }
  }, [meal, budget]);

  const currentDishForResult = (() => {
    if (!ba006Result?.dish) return null;
    const imgUrl = normalizeImageUrl(ba006Result.dish.imageUrl);
    return {
      name: ba006Result.dish.name,
      image: imgUrl ? { uri: imgUrl } : require('../assets/images/random/pho-result.jpg'),
    };
  })();

  // Explanation từ BA-006 (hiển thị trong OverviewPage)
  const currentExplanation = ba006Result?.explanation ?? null;
  const currentRandomizationId = ba006Result?.randomizationId ?? null;

  if (detailPage && ba006Result?.dish && currentDishForResult) {
    const dish = ba006Result.dish;

    return (
      <FoodDetailFlowScreen
        initialPage={detailPage}
        dishId={dish.id}
        dishName={currentDishForResult.name}
        dishImage={currentDishForResult.image}
        meal={meal}
        priceMin={dish.priceMin ?? null}
        priceMax={dish.priceMax ?? null}
        prepMinutes={dish.prepMinutes ?? null}
        cookMinutes={dish.cookMinutes ?? null}
        shortDescription={dish.shortDescription ?? null}
        originText={dish.originText ?? null}
        nutrition={dish.nutrition ?? null}
        ingredients={dish.ingredients ?? []}
        allergens={dish.allergens ?? []}
        recipeSteps={dish.recipeSteps ?? []}
        difficulty={dish.difficulty ?? null}
        explanation={currentExplanation}
        onClose={() => {
          if (currentRandomizationId) {
            pendingRetryId.current = currentRandomizationId;
            recordRecommendationEvent(currentRandomizationId, 'RETRY').catch(() => {});
          }
          setDetailPage(null);
          setBa006Result(null);
          setStep(2);
        }}
        onFinish={() => {
          if (currentRandomizationId) {
            // selectRandomization ghi SELECT event trên BE — không gọi recordRecommendationEvent trùng
            selectRandomization(currentRandomizationId).catch(() => {});
          }
          onClose();
        }}
      />
    );
  }

  if (step === 2) {
    return (
      <LoadingScreen
        meal={meal}
        budget={budget === '40K–80K' ? '40K–80K' : budget}
        onClose={onClose}
        onDone={() => fetchRandom()}
      />
    );
  }

  if (step === 3) {
    return (
      <NoCandidateScreen
        message={fetchError ?? noCandidateMessage ?? 'Không tìm thấy món phù hợp.'}
        isError={!!fetchError}
        onBack={() => {
          setFetchError(null);
          setNoCandidateMessage(null);
          setStep(1);
        }}
        onRetry={() => {
          setFetchError(null);
          setNoCandidateMessage(null);
          setStep(2);
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={back} onClose={onClose} />
      <Progress active={step} />
      <Animated.View
        style={[
          styles.page,
          { opacity: transitionOpacity, transform: [{ translateX: transitionX }] },
        ]}
      >
        {step === 0 ? (
          <SelectionStep meal={meal} onMeal={setMeal} onNext={() => navigate(1, 1)} />
        ) : (
          <RefineStep
            budget={budget}
            context={randomContext}
            onBudget={setBudget}
            onSkip={() => navigate(2, 1)}
            onRandom={() => navigate(2, 1)}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <Image
      source={require('../assets/images/logo/mogu-wordmark-header.png')}
      resizeMode="contain"
      style={styles.brand}
    />
  );
}

function Header({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <RoundButton onPress={onBack}>
        <ArrowLeft size={26} color={INK} />
      </RoundButton>
      <Brand />
      <RoundButton onPress={onClose}>
        <X size={27} color={INK} />
      </RoundButton>
    </View>
  );
}

function RoundButton({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

function Progress({ active }: { active: number }) {
  return (
    <View style={styles.progress}>
      {[0, 1, 2].map((index) => (
        <ProgressSegment key={index} on={index <= active} />
      ))}
    </View>
  );
}

function ProgressSegment({ on }: { on: boolean }) {
  const fill = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: on ? 1 : 0,
      duration: 350,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [fill, on]);
  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width }]} />
    </View>
  );
}

// Meal slot definitions for Step 1
const MEAL_SLOTS: { key: string; icon: string; time: string }[] = [
  { key: 'Sáng',    icon: '☀️',  time: '06:00–10:00' },
  { key: 'Trưa',   icon: '🌤️',  time: '11:00–14:00' },
  { key: 'Tối',    icon: '🌙',  time: '17:00–21:00' },
  { key: 'Bữa phụ', icon: '🫙', time: 'Bất kỳ lúc nào' },
  { key: 'Bất kỳ',  icon: '✦',  time: 'Để Mogu tự chọn' },
];

function SelectionStep({
  meal,
  onMeal,
  onNext,
}: {
  meal: string;
  onMeal: (value: string) => void;
  onNext: () => void;
}) {
  // Tìm slot đang chọn
  const selectedSlot = MEAL_SLOTS.find((s) => s.key === meal) ?? MEAL_SLOTS[1];
  // Các slot phụ (không phải slot đang chọn)
  const otherSlots = MEAL_SLOTS.filter((s) => s.key !== meal);

  return (
    <View style={styles.stepFill}>
      {/* ── Hero: mascot + tiêu đề ── */}
      <View style={styles.selectionHero}>
        <Image
          source={require('../assets/images/random/random-step1.png')}
          style={styles.selectionMascot}
        />
        <View style={styles.selectionCopy}>
          <Text style={styles.stepLabel}>BƯỚC 1/3</Text>
          <Text style={styles.heroTitle}>Bạn muốn ăn bữa nào?</Text>
          <Text style={styles.heroSub}>Mogu đã chọn theo thời gian hiện tại.</Text>
        </View>
      </View>

      {/* ── Card lớn: bữa đang chọn ── */}
      <Pressable
        style={styles.selectedMealCard}
        onPress={() => { /* already selected, no-op */ }}
      >
        <View style={styles.selectedMealLeft}>
          <Text style={styles.selectedMealIcon}>{selectedSlot.icon}</Text>
          <View>
            <Text style={styles.selectedMealName}>{selectedSlot.key}</Text>
            <Text style={styles.selectedMealTime}>{selectedSlot.time} · Được chọn tự động</Text>
          </View>
        </View>
        <View style={styles.selectedMealCheck}>
          <Check size={20} color={INK} strokeWidth={3} />
        </View>
      </Pressable>

      {/* ── 4 chip nhỏ cho bữa còn lại ── */}
      <View style={styles.mealChipsRow}>
        {otherSlots.map((slot) => (
          <Pressable
            key={slot.key}
            style={[styles.mealChip, meal === slot.key && styles.mealChipOn]}
            onPress={() => onMeal(slot.key)}
          >
            <Text style={styles.mealChipIcon}>{slot.icon}</Text>
            <Text style={[styles.mealChipLabel, meal === slot.key && styles.mealChipLabelOn]}>
              {slot.key}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Info chip ── */}
      <View style={styles.applyChip}>
        <ShieldCheck size={18} color="#D9A000" />
        <Text style={styles.applyChipText}>Đã áp dụng mục tiêu và sở thích của bạn</Text>
      </View>

      {/* ── Nút Tiếp tục ── */}
      <PrimaryButton
        label="Tiếp tục"
        trailing={<ChevronRight size={25} />}
        onPress={onNext}
        fixed
      />
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionIcon}>{icon}</View>
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function Choice({
  label,
  selected,
  compact,
  onPress,
}: {
  label: string;
  selected: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, easing: EASE, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View
      style={[
        compact ? styles.mealChoice : styles.segmentChoice,
        selected && styles.choiceOn,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable style={styles.fillCenter} onPress={press}>
        <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function NeedChoice({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ChoiceSurface selected={selected} onPress={onPress} style={styles.needChoice}>
      {icon}
      <Text style={styles.needLabel}>{label}</Text>
    </ChoiceSurface>
  );
}

function MiniChoice({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ChoiceSurface selected={selected} onPress={onPress} style={styles.miniChoice}>
      {icon}
      <Text style={styles.miniChoiceText}>{label}</Text>
    </ChoiceSurface>
  );
}

function MiniSummary({ label, icon, active }: { label: string; icon: ReactNode; active: boolean }) {
  return (
    <View style={[styles.miniChoice, active && styles.choiceOn]}>
      {icon}
      <Text style={[styles.miniChoiceText, active && styles.choiceTextOn]}>{label}</Text>
    </View>
  );
}

function ChoiceSurface({
  selected,
  onPress,
  style,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  style: object;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, easing: EASE, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={[style, selected && styles.choiceOn, { transform: [{ scale }] }]}>
      <Pressable style={styles.choiceSurfacePress} onPress={press}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function RefineStep({
  budget,
  context,
  onBudget,
  onSkip,
  onRandom,
}: {
  budget: string;
  context: RandomizationContext | null;
  onBudget: (value: string) => void;
  onSkip: () => void;
  onRandom: () => void;
}) {
  const profile = context?.profileSnapshot;
  const dietLabels =
    profile?.hardDietTypeCodes?.length
      ? profile.hardDietTypeCodes.join(', ')
      : profile?.dietTypeCodes?.length
        ? profile.dietTypeCodes.join(', ')
        : null;
  const allergenLabels = profile?.allergenCodes?.length
    ? profile.allergenCodes.join(', ')
    : null;
  const goalLabels = profile?.preferenceCodes?.length
    ? profile.preferenceCodes.join(', ')
    : context?.availableGoals?.length
      ? 'Theo hồ sơ'
      : null;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.refineScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Mascot hero ── */}
      <View style={styles.refineHero}>
        <Image
          source={require('../assets/images/random/random-result.png')}
          style={styles.refineMascot}
          resizeMode="contain"
        />
        <Text style={styles.stepLabel}>BƯỚC 2/3</Text>
        <Text style={styles.refineTitle}>Mogu sẽ chọn theo hồ sơ này</Text>
        <Text style={styles.refineSub}>Bạn chỉ cần chỉnh ngân sách nếu hôm nay có thay đổi.</Text>
      </View>

      {/* ── Profile summary card ── */}
      <View style={styles.profileCard}>
        <View style={styles.profileCardHeader}>
          <Text style={styles.profileCardTitle}>Đang áp dụng</Text>
        </View>
        <View style={styles.profileRow}>
          <View style={styles.profileRowIcon}>
            <Sparkles size={18} color={INK} />
          </View>
          <Text style={styles.profileRowText}>
            {goalLabels ?? 'Theo mục tiêu trong hồ sơ'}
          </Text>
        </View>
        {dietLabels ? (
          <View style={styles.profileRow}>
            <View style={styles.profileRowIcon}>
              <Leaf size={18} color={INK} />
            </View>
            <Text style={styles.profileRowText}>Chế độ ăn: {dietLabels}</Text>
          </View>
        ) : null}
        <View style={styles.profileRow}>
          <View style={styles.profileRowIcon}>
            <ShieldCheck size={18} color={INK} />
          </View>
          <Text style={styles.profileRowText}>
            {allergenLabels ? `Tránh dị ứng: ${allergenLabels}` : 'Không có dị ứng đã lưu'}
          </Text>
        </View>
        <View style={[styles.profileRow, { borderBottomWidth: 0 }]}>
          <View style={styles.profileRowIcon}>
            <MapPin size={18} color={INK} />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.profileRowText, { flex: 1 }]}>Khu vực gợi ý</Text>
            <ComingSoonBadge />
          </View>
        </View>
      </View>

      {/* Unwired controls — visible but disabled */}
      <View style={styles.comingSoonSection}>
        <Text style={styles.comingSoonTitle}>Tuỳ chọn thêm</Text>
        {[
          { icon: <Salad size={18} color={MUTED} />, label: 'Nhu cầu hôm nay' },
          { icon: <Utensils size={18} color={MUTED} />, label: 'Loại món' },
        ].map(({ icon, label }) => (
          <View key={label} style={styles.comingSoonRow}>
            <View style={styles.profileRowIcon}>{icon}</View>
            <Text style={styles.comingSoonLabel}>{label}</Text>
            <ComingSoonBadge />
          </View>
        ))}
      </View>

      {/* ── Budget section ── */}
      <View style={styles.budgetSection}>
        <Text style={styles.budgetTitle}>Ngân sách hôm nay</Text>
        <View style={styles.budgetChips}>
          {(['Dưới 40K', '40K-80K', 'Không giới hạn'] as const).map((item) => {
            const on = budget === item || (item === '40K-80K' && budget === '40K–80K');
            return (
              <Pressable
                key={item}
                style={[styles.budgetChip, on && styles.budgetChipOn]}
                onPress={() => onBudget(item === '40K-80K' ? '40K–80K' : item)}
              >
                <Text style={[styles.budgetChipText, on && styles.budgetChipTextOn]}>
                  {item === '40K-80K' ? '40K–80K' : item}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.budgetHint}>Bỏ qua để Mogu tự cân đối.</Text>
      </View>

      {/* ── Actions ── */}
      <View style={styles.refineActions}>
        <Pressable onPress={onSkip} style={styles.skipTouchable}>
          <Text style={styles.skipText}>Bỏ qua</Text>
        </Pressable>
        <PrimaryButton
          label="Random ngay"
          icon={<Sparkles size={22} fill={INK} />}
          onPress={onRandom}
          compact
        />
      </View>
    </ScrollView>
  );
}

function PrimaryButton({
  label,
  onPress,
  trailing,
  icon,
  compact,
  fixed,
}: {
  label: string;
  onPress: () => void;
  trailing?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  fixed?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const press = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 90, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();
    setTimeout(onPress, 120);
  };
  return (
    <Animated.View
      style={[
        fixed ? styles.primaryFixed : compact ? styles.primaryCompact : styles.primaryWrap,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable style={styles.primaryPress} onPress={press}>
        <LinearGradient colors={['#FFC31A', '#FFD94A', '#FFC31A']} style={styles.primaryGradient}>
          {icon}
          <Text style={styles.primaryText}>{label}</Text>
          {trailing && <View style={styles.trailing}>{trailing}</View>}
        </LinearGradient>
        <Animated.View pointerEvents="none" style={[styles.buttonGlow, { opacity: glow }]} />
      </Pressable>
    </Animated.View>
  );
}

type SheetType = 'needs' | 'location' | 'adjust' | null;

type BottomSheetProps = {
  type: SheetType;
  need: string;
  distance: string;
  openOnly: boolean;
  excluded: string[];
  diet: string;
  onClose: () => void;
  onApplyNeed: (value: string) => void;
  onApplyLocation: (distance: string, openOnly: boolean) => void;
  onApplyAdjust: (excluded: string[], diet: string) => void;
};

function RandomBottomSheet({
  type,
  need,
  distance,
  openOnly,
  excluded,
  diet,
  onClose,
  onApplyNeed,
  onApplyLocation,
  onApplyAdjust,
}: BottomSheetProps) {
  const motion = useRef(new Animated.Value(0)).current;
  const [draftNeed, setDraftNeed] = useState(need);
  const [draftDistance, setDraftDistance] = useState(distance);
  const [draftOpenOnly, setDraftOpenOnly] = useState(openOnly);
  const [draftExcluded, setDraftExcluded] = useState(excluded);
  const [draftDiet, setDraftDiet] = useState(diet);
  const [ingredient, setIngredient] = useState('');

  useEffect(() => {
    if (!type) return;
    setDraftNeed(need);
    setDraftDistance(distance);
    setDraftOpenOnly(openOnly);
    setDraftExcluded(excluded);
    setDraftDiet(diet);
    setIngredient('');
    motion.setValue(0);
    Animated.timing(motion, {
      toValue: 1,
      duration: 350,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [diet, distance, excluded, motion, need, openOnly, type]);

  const close = () => {
    Animated.timing(motion, {
      toValue: 0,
      duration: 210,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(onClose);
  };

  const addIngredient = () => {
    const value = ingredient.trim();
    if (value && !draftExcluded.includes(value)) setDraftExcluded([...draftExcluded, value]);
    setIngredient('');
  };

  return (
    <Modal
      visible={type !== null}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={close}
    >
      <View style={styles.modalRoot}>
        {/* Overlay nằm absolute so với toàn modal, KHÔNG bị ảnh hưởng bởi flex */}
        <Animated.View
          style={[
            styles.sheetOverlay,
            {
              opacity: motion.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.45, 0.45],
                extrapolate: 'clamp',
              }),
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        {/* Sheet nằm ở bottom, slide lên từ dưới */}
        <Animated.View
          style={[
            styles.bottomSheet,
            type === 'needs'
              ? styles.needsSheet
              : type === 'location'
                ? styles.locationSheet
                : styles.adjustSheet,
            {
              transform: [
                {
                  translateY: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [820, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Pressable style={styles.sheetClose} onPress={close} hitSlop={4}>
            <X size={28} color={INK} />
          </Pressable>

          {type === 'needs' && (
            <>
              <Text style={styles.sheetTitle}>Chọn nhu cầu của bạn</Text>
              <Text style={styles.sheetSubtitle}>Bạn có thể chọn một lựa chọn phù hợp nhất.</Text>
              <View style={styles.sheetNeedGrid}>
                {[
                  ['Ăn ngon', <Salad size={32} key="eat" />],
                  ['Lành mạnh', <Leaf size={32} key="leaf" />],
                  ['Tiết kiệm', <PiggyBank size={32} key="save" />],
                  ['Nhanh gọn', <TimerReset size={32} key="fast" />],
                  ['Giảm cân', <Salad size={32} key="loss" />],
                  ['Tăng cơ', <Dumbbell size={32} key="muscle" />],
                  ['Thử món mới', <Sparkles size={32} key="new" />],
                ].map(([label, icon]) => (
                  <NeedSheetCard
                    key={label as string}
                    label={label as string}
                    icon={icon as ReactNode}
                    selected={draftNeed === label}
                    onPress={() => setDraftNeed(label as string)}
                  />
                ))}
              </View>
              <SheetPrimaryButton
                label="Xác nhận lựa chọn"
                onPress={() => onApplyNeed(draftNeed)}
              />
            </>
          )}

          {type === 'location' && (
            <>
              <Text style={styles.sheetTitle}>Khu vực tìm món</Text>
              <Text style={styles.sheetGroupTitle}>Khoảng cách</Text>
              <View style={styles.mapPreview}>
                <View style={styles.mapRiver} />
                <View style={[styles.mapRing, styles.mapRingLarge]} />
                <View style={[styles.mapRing, styles.mapRingSmall]} />
                <View style={styles.mapPinCenter}>
                  <MapPinned size={27} color={INK} />
                </View>
                <View style={[styles.mapRoad, { top: 43, transform: [{ rotate: '18deg' }] }]} />
                <View style={[styles.mapRoad, { top: 105, transform: [{ rotate: '-13deg' }] }]} />
              </View>
              <View style={styles.distanceRow}>
                {['1 km', '3 km', '5 km', '10 km'].map((value) => (
                  <SheetChip
                    key={value}
                    label={value}
                    selected={draftDistance === value}
                    onPress={() => setDraftDistance(value)}
                    large
                  />
                ))}
              </View>
              <DistanceTrack value={draftDistance} />
              <View style={styles.distanceLabels}>
                <Text style={styles.sheetBodyText}>Gần nhất</Text>
                <Text style={styles.sheetBodyText}>Xa hơn</Text>
              </View>
              <Pressable
                style={styles.openOnlyRow}
                onPress={() => setDraftOpenOnly((current) => !current)}
              >
                <Text style={styles.sheetNavText}>Chỉ gợi ý địa điểm đang mở</Text>
                <Toggle on={draftOpenOnly} />
              </Pressable>
              <Text style={styles.sheetHelper}>
                Mogu sử dụng vị trí hiện tại để tìm món phù hợp gần bạn.
              </Text>
              <SheetPrimaryButton
                label="Áp dụng"
                onPress={() => onApplyLocation(draftDistance, draftOpenOnly)}
              />
            </>
          )}

          {type === 'adjust' && (
            <>
              <Text style={[styles.sheetTitle, styles.sheetTitleCentered]}>Điều chỉnh thêm</Text>
              <Text style={[styles.sheetSubtitle, styles.sheetSubtitleCentered]}>
                Dùng thông tin đã lưu trong hồ sơ của bạn.
              </Text>
              <Text style={styles.sheetGroupTitle}>Nguyên liệu cần tránh</Text>
              <View style={styles.searchRow}>
                <Search size={23} color="#666" />
                <TextInput
                  value={ingredient}
                  onChangeText={setIngredient}
                  onSubmitEditing={addIngredient}
                  placeholder="Thêm nguyên liệu"
                  placeholderTextColor="#999999"
                  returnKeyType="done"
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.removableChips}>
                {draftExcluded.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.removableChip}
                    onPress={() =>
                      setDraftExcluded(draftExcluded.filter((value) => value !== item))
                    }
                  >
                    <Text style={styles.removableChipText}>{item}</Text>
                    <X size={18} />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sheetGroupTitle}>Chế độ ăn đặc biệt</Text>
              <View style={styles.dietChips}>
                {['Không có', 'Ăn chay', 'Eat clean', 'Keto', 'Ít đường'].map((value) => (
                  <SheetChip
                    key={value}
                    label={value}
                    selected={draftDiet === value}
                    onPress={() => setDraftDiet(value)}
                  />
                ))}
              </View>
              <View style={styles.syncRow}>
                <View style={styles.syncIcon}>
                  <ShieldCheck size={23} />
                </View>
                <Text style={styles.sheetBodyText}>Đã đồng bộ với sở thích trong hồ sơ</Text>
              </View>
              <View style={styles.sheetFooterRow}>
                <Pressable
                  style={styles.resetButton}
                  onPress={() => {
                    setDraftExcluded([]);
                    setDraftDiet('Không có');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Đặt lại</Text>
                </Pressable>
                <View style={styles.saveButtonWrap}>
                  <SheetPrimaryButton
                    label="Lưu thay đổi"
                    onPress={() => onApplyAdjust(draftExcluded, draftDiet)}
                  />
                </View>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function NeedSheetCard({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ChoiceSurface selected={selected} onPress={onPress} style={styles.sheetNeedCard}>
      {icon}
      <Text style={[styles.sheetNeedLabel, selected && styles.choiceTextOn]}>{label}</Text>
    </ChoiceSurface>
  );
}

function SheetChip({
  label,
  selected,
  onPress,
  large,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  large?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sheetChip,
        large && styles.sheetChipLarge,
        selected && styles.sheetChipSelected,
        pressed && styles.sheetChipPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.sheetChipText, selected && styles.sheetChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.toggleKnob, on && styles.toggleKnobOn]} />
    </View>
  );
}

function DistanceTrack({ value }: { value: string }) {
  const position = { '1 km': '8%', '3 km': '36%', '5 km': '64%', '10 km': '91%' }[value] ?? '36%';
  return (
    <View style={styles.distanceTrackWrap}>
      <View style={styles.distanceTrack} />
      <View style={[styles.distanceTrackActive, { width: position as `${number}%` }]} />
      <View style={[styles.distanceKnob, { left: position as `${number}%` }]} />
    </View>
  );
}

function SheetPrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.sheetPrimaryButton, pressed && styles.sheetPrimaryPressed]}
      onPress={onPress}
    >
      <Text style={styles.sheetPrimaryText}>{label}</Text>
    </Pressable>
  );
}

function ComingSoonBadge() {
  return (
    <View style={styles.comingSoonBadge}>
      <Text style={styles.comingSoonBadgeText}>Sắp có</Text>
    </View>
  );
}

function NoCandidateScreen({
  message,
  isError,
  onBack,
  onRetry,
  onClose,
}: {
  message: string;
  isError: boolean;
  onBack: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={onBack} onClose={onClose} />
      <View style={styles.noCandidateWrap}>
        <Text style={{ fontSize: 48 }}>{isError ? '⚠️' : '🔍'}</Text>
        <Text style={styles.noCandidateTitle}>
          {isError ? 'Không thể random món' : 'Chưa tìm thấy món phù hợp'}
        </Text>
        <Text style={styles.noCandidateBody}>{message}</Text>
        <PrimaryButton label="Thử lại" icon={<RotateCcw size={20} color={INK} />} onPress={onRetry} />
        <Pressable onPress={onBack} style={styles.skipTouchable}>
          <Text style={styles.skipText}>Chỉnh tiêu chí</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen({
  meal,
  budget,
  onClose,
  onDone,
}: {
  meal: string;
  budget: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const orbit = useRef(new Animated.Value(0)).current;
  const mascot = useRef(new Animated.Value(0.82)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mascot pop-in
    Animated.spring(mascot, { toValue: 1, speed: 10, bounciness: 10, useNativeDriver: true }).start();

    // Orbit loop
    const orbitLoop = Animated.loop(
      Animated.timing(orbit, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
    );

    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: EASE, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.4, duration: 1100, easing: EASE, useNativeDriver: false }),
      ]),
    );

    // Dot bounce loop
    const dotLoop = Animated.loop(
      Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    );

    orbitLoop.start();
    glowLoop.start();
    dotLoop.start();

    const timer = setTimeout(onDone, 2800);
    return () => {
      clearTimeout(timer);
      orbitLoop.stop();
      glowLoop.stop();
      dotLoop.stop();
    };
  }, [dots, glow, mascot, onDone, orbit]);

  const glowSize = glow.interpolate({ inputRange: [0, 1], outputRange: [230, 300] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.loadingHeader}>
        <View style={styles.headerSpacer} />
        <Brand />
        <RoundButton onPress={onClose}>
          <X size={27} color={INK} />
        </RoundButton>
      </View>

      {/* Progress */}
      <Progress active={2} />

      {/* Step label */}
      <Text style={styles.loadingStep}>BƯỚC 3/3</Text>

      {/* Tiêu đề */}
      <Text style={styles.loadingTitle}>Mogu đang chọn món cho bạn...</Text>
      <Text style={styles.loadingSub}>Chỉ mất vài giây thôi.</Text>

      {/* Stage: mascot + orbit cards */}
      <View style={styles.loadingStage}>
        {/* Glow aura */}
        <Animated.View
          style={[
            styles.loadingAura,
            { width: glowSize, height: glowSize, opacity: glowOpacity },
          ]}
          pointerEvents="none"
        />

        {/* Orbit layer */}
        <Animated.View
          style={[
            styles.orbitLayer,
            {
              transform: [{
                rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              }],
            },
          ]}
        >
          {ORBIT_DISHES.map((dish, index) => (
            <OrbitDish key={dish.name} dish={dish} index={index} orbit={orbit} />
          ))}
        </Animated.View>

        {/* Mascot trung tâm */}
        <Animated.Image
          source={require('../assets/images/random/random-loading.png')}
          style={[styles.loadingMascot, { transform: [{ scale: mascot }] }]}
          resizeMode="contain"
        />
      </View>

      {/* Chip: Trưa · 40K–80K */}
      <View style={styles.filterChip}>
        <Text style={styles.filterText}>{meal} · {budget}</Text>
      </View>

      {/* Đã áp dụng */}
      <View style={styles.loadingApply}>
        <ShieldCheck size={17} color="#C89800" />
        <Text style={styles.loadingApplyText}>Đã áp dụng hồ sơ của bạn</Text>
      </View>

      {/* Dots */}
      <LoadingDots progress={dots} />

      {/* Dừng lại */}
      <Pressable style={styles.stopButton} onPress={onClose}>
        <Text style={styles.stopText}>Dừng lại</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function OrbitDish({
  dish,
  index,
  orbit,
}: {
  dish: (typeof ORBIT_DISHES)[number];
  index: number;
  orbit: Animated.Value;
}) {
  const positions = [styles.orbitTop, styles.orbitRight, styles.orbitBottom, styles.orbitLeft];
  return (
    <View style={[styles.orbitPosition, positions[index]]}>
      <Animated.View
        style={[
          styles.orbitCard,
          {
            transform: [
              {
                rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }),
              },
            ],
          },
        ]}
      >
        <Image source={dish.image} style={styles.orbitImage} />
        <Text style={styles.orbitLabel}>{dish.name}</Text>
      </Animated.View>
    </View>
  );
}

function LoadingDots({ progress }: { progress: Animated.Value }) {
  return (
    <View style={styles.dotsRow}>
      {[0, 0.33, 0.66].map((offset, index) => (
        <Animated.View
          key={offset}
          style={[
            styles.loadingDot,
            {
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [offset, Math.min(offset + 0.18, 0.99), Math.min(offset + 0.34, 1)],
                    outputRange: [1, 1.55, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              opacity: index === 1 ? 1 : 0.82,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ResultScreen({
  dish,
  meal,
  onBack,
  onAgain,
  onChoose,
  onDetail,
}: {
  dish: (typeof ORBIT_DISHES)[number];
  meal: string;
  onBack: () => void;
  onAgain: () => void;
  onChoose: () => void;
  onDetail: () => void;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const photoScale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,    { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideUp,   { toValue: 0, speed: 14, bounciness: 8, useNativeDriver: true }),
      Animated.spring(photoScale,{ toValue: 1, speed: 12, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp, photoScale]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.resultHeader}>
        <RoundButton onPress={onBack}><ArrowLeft size={26} color={INK} /></RoundButton>
        <Brand />
        <View style={styles.resultHeaderActions}>
          <RoundButton onPress={() => undefined}><Share2 size={23} color={INK} /></RoundButton>
          <RoundButton onPress={() => undefined}><Bookmark size={23} color={INK} /></RoundButton>
        </View>
      </View>

      {/* Progress bar */}
      <Progress active={2} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultScroll}>
        {/* Mascot + tiêu đề */}
        <Animated.View style={[styles.resultIntro, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          <Image
            source={require('../assets/images/random/random-result.png')}
            style={styles.resultMascot}
            resizeMode="contain"
          />
          <Text style={styles.resultLead}>Món hôm nay của bạn là</Text>
          <Text style={styles.resultDishName}>{dish.name}!</Text>
        </Animated.View>

        {/* Ảnh món + badge Phù hợp */}
        <Animated.View style={[styles.photoCard, { transform: [{ scale: photoScale }] }]}>
          <Image source={dish.image} style={styles.resultPhoto} resizeMode="cover" />
          <View style={styles.matchBadge}>
            <Sparkles size={14} color={INK} fill={INK} />
            <Text style={styles.matchText}>Phù hợp <Text style={styles.bold}>92%</Text></Text>
          </View>
        </Animated.View>

        {/* 4 stat chips — dọc (label nhỏ ở trên, value to ở dưới) */}
        <Animated.View style={[styles.statsRow, { opacity: fadeIn }]}>
          <ResultStat icon={<MapPin    size={20} color={MUTED} />} label="Khoảng" value="55K"  />
          <ResultStat icon={<Sparkles  size={20} color={MUTED} />} label="kcal"    value="420"  />
          <ResultStat icon={<Clock3    size={20} color={MUTED} />} label="phút"    value="25"   />
          <ResultStat icon={<AlarmClock size={20} color={MUTED} />} label="Bữa"   value={meal} />
        </Animated.View>

        {/* Lý do */}
        <Animated.View style={[styles.reasonBox, { opacity: fadeIn }]}>
          <Text style={styles.reasonTitle}>Vì sao Mogu chọn món này?</Text>
          <Text style={styles.reasonText}>
            Món ăn ấm nóng, đủ năng lượng, phù hợp nhu cầu lành mạnh và ngân sách của bạn.
          </Text>
        </Animated.View>

        {/* 2 nút flex ngang */}
        <View style={styles.resultBtnRow}>
          <Pressable style={styles.resultAgainBtn} onPress={onAgain}>
            <RotateCcw size={18} color={INK} />
            <Text style={styles.resultAgainText}>Random lại</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Chọn món này"
              icon={<Sparkles size={20} fill={INK} />}
              onPress={onChoose}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.resultStatChip}>
      <View style={styles.resultStatIcon}>{icon}</View>
      <Text style={styles.resultStatLabel}>{label}</Text>
      <Text style={styles.resultStatValue}>{value}</Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function BottomAction({
  icon,
  label,
  onPress = () => undefined,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.bottomAction} onPress={onPress}>
      <View style={styles.bottomActionIcon}>{icon}</View>
      <Text style={styles.bottomActionText}>{label}</Text>
    </Pressable>
  );
}

const shadow = {
  shadowColor: '#8D753F',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  page: { flex: 1, paddingHorizontal: 14, paddingBottom: 10 },
  stepFill: { flex: 1, position: 'relative' },
  header: {
    height: 56,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingHeader: {
    height: 56,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: { width: 42 },
  resultHeader: {
    height: 56,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultHeaderActions: { width: 92, flexDirection: 'row', justifyContent: 'space-between' },
  brand: { width: 96, height: 43 },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  progress: {
    height: 25,
    marginHorizontal: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#DFDEDC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: YELLOW,
  },
  // ── Step 1 styles ──────────────────────────────────────────────────────────
  selectionHero: { paddingHorizontal: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  selectionMascot: { width: 90, height: 78, resizeMode: 'contain' },
  selectionCopy: { flex: 1, marginLeft: 10 },
  stepLabel: { color: '#D99F00', fontSize: 13, fontWeight: '700', marginBottom: 4, letterSpacing: 0.4 },
  heroTitle: { color: INK, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4 },
  heroSub: { marginTop: 4, color: MUTED, fontSize: 12, lineHeight: 16 },

  // Card lớn: bữa đang chọn
  selectedMealCard: {
    marginHorizontal: 0,
    marginTop: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadow,
  },
  selectedMealLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectedMealIcon: { fontSize: 36 },
  selectedMealName: { fontSize: 22, fontWeight: '700', color: INK },
  selectedMealTime: { marginTop: 3, fontSize: 12, color: MUTED },
  selectedMealCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4 chip nhỏ bên dưới
  mealChipsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  mealChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    ...shadow,
  },
  mealChipOn: { backgroundColor: '#FFD248', borderColor: '#EEAB00' },
  mealChipIcon: { fontSize: 22 },
  mealChipLabel: { fontSize: 12.5, fontWeight: '600', color: INK },
  mealChipLabelOn: { fontWeight: '700' },

  // Chip info "Đã áp dụng"
  applyChip: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    backgroundColor: '#FFFDF5',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  applyChipText: { fontSize: 13.5, color: '#444', flex: 1 },

  // Legacy - kept for NeedChoice / ChoiceSurface compatibility
  choiceText: { fontSize: 12.5, color: INK },
  choiceTextOn: { fontWeight: '700' },
  choiceOn: { backgroundColor: '#FFD248', borderColor: '#EEAB00' },
  fillCenter: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  mealChoice: { flex: 1, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: '#E8DDD0', backgroundColor: '#FFF' },
  needChoice: { width: '48.7%', height: 69, borderRadius: 14, borderWidth: 1, borderColor: '#EEE4D9', backgroundColor: '#FFF' },
  choiceSurfacePress: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 5 },
  needLabel: { fontSize: 14, fontWeight: '600' },
  miniChoice: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#EADFCF', backgroundColor: '#FFFAF0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  miniChoiceText: { fontSize: 11.5, fontWeight: '500' },
  moreButton: { height: 52, marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E8E0D2', paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreText: { color: '#202020', fontSize: 16, fontWeight: '500' },
  chevronTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  moreChoices: { height: 36, marginTop: 8, flexDirection: 'row', gap: 8 },
  divider: { height: 1, backgroundColor: '#EEE8DF', marginVertical: 5 },
  dividerCompact: { height: 1, backgroundColor: '#EEE8DF', marginTop: 10 },
  sectionTitle: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0B7', alignItems: 'center', justifyContent: 'center' },
  sectionTitleText: { fontSize: 18, fontWeight: '700' },
  autoHint: { height: 29, marginTop: 5, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 9 },
  hintText: { color: MUTED, fontSize: 11.8 },
  needGrid: { height: 146, marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealRow: { height: 42, marginTop: 6, flexDirection: 'row', gap: 7 },
  selectionPanel: { height: 462, borderRadius: 24, backgroundColor: '#FFF', padding: 12, ...shadow },

  primaryWrap: { height: 54, marginTop: 8, borderRadius: 18, overflow: 'hidden', ...shadow },
  primaryFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    ...shadow,
  },
  primaryCompact: { flex: 1, height: 58, borderRadius: 18, overflow: 'hidden', ...shadow },
  primaryPress: { flex: 1 },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { fontSize: 18, fontWeight: '700' },
  trailing: { position: 'absolute', right: 18 },
  buttonGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.35)',
  },
  // ── Step 2 (Refine) styles ─────────────────────────────────────────────────
  refineScroll: { paddingHorizontal: 14, paddingBottom: 24 },
  refineHero: { alignItems: 'center', paddingVertical: 20 },
  refineMascot: { width: 100, height: 88 },
  refineTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  refineSub: { color: MUTED, fontSize: 13, marginTop: 6, textAlign: 'center' },

  // Profile summary card
  profileCard: {
    borderRadius: 20,
    backgroundColor: '#FFF',
    padding: 18,
    ...shadow,
  },
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileCardTitle: { fontSize: 17, fontWeight: '700', color: INK },
  profileCardEdit: { fontSize: 14, fontWeight: '600', color: '#D49F00', textDecorationLine: 'underline' },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE2',
    gap: 14,
  },
  profileRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF3CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRowText: { fontSize: 15, color: '#333', flex: 1 },

  // Budget section
  budgetSection: { marginTop: 22 },
  budgetTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 12 },
  budgetChips: { flexDirection: 'row', gap: 10 },
  budgetChip: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0D9CF',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  budgetChipOn: { backgroundColor: YELLOW, borderColor: '#EEAB00' },
  budgetChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  budgetChipTextOn: { color: INK, fontWeight: '700' },
  budgetHint: { marginTop: 10, fontSize: 13, color: MUTED, textAlign: 'center' },

  // Actions
  refineActions: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  skipTouchable: { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontSize: 16, color: INK, textDecorationLine: 'underline', fontWeight: '500' },

  // Legacy styles kept for compatibility
  refinePanel: { borderRadius: 24, backgroundColor: '#FFF', padding: 17, ...shadow },
  threeSegments: { height: 53, marginTop: 8, flexDirection: 'row', gap: 9 },
  segmentChoice: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: '#E8DDD0', backgroundColor: '#FFF' },
  settingRow: { height: 54, marginTop: 10, paddingHorizontal: 15, borderRadius: 13, borderWidth: 1, borderColor: '#E8C45B', flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingRowDark: { borderColor: INK },
  settingIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0B7', alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1, color: '#444', fontSize: 13.5 },
  // ── Step 3 (Loading) styles ────────────────────────────────────────────────
  loadingStep: {
    marginTop: 18,
    color: '#E7A900',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  loadingTitle: { marginTop: 10, fontSize: 24, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  loadingSub: { marginTop: 6, color: MUTED, fontSize: 14, textAlign: 'center' },
  loadingStage: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  loadingAura: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: YELLOW,
  },
  orbitLayer: { position: 'absolute', width: 320, height: 320, zIndex: 3 },
  orbitPosition: { position: 'absolute', width: 86, height: 96 },
  orbitTop: { top: -5, left: 117 },
  orbitRight: { top: 112, right: -5 },
  orbitBottom: { bottom: -5, left: 117 },
  orbitLeft: { top: 112, left: -5 },
  orbitCard: {
    width: 86,
    height: 96,
    borderRadius: 14,
    padding: 6,
    backgroundColor: '#FFF',
    alignItems: 'center',
    ...shadow,
  },
  orbitImage: { width: 74, height: 66, borderRadius: 10 },
  orbitLabel: { marginTop: 3, fontSize: 11, fontWeight: '600' },
  loadingMascot: { width: 250, height: 220, resizeMode: 'contain', zIndex: 2 },
  lightRing: {
    position: 'absolute',
    width: 315,
    height: 195,
    borderRadius: 160,
    borderWidth: 3,
    borderColor: 'rgba(255,197,26,.24)',
    transform: [{ rotate: '-9deg' }],
  },
  filterChip: {
    alignSelf: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF2C7',
    borderWidth: 1,
    borderColor: '#EDD88A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginTop: 2,
  },
  filterText: { fontSize: 14, fontWeight: '700', color: '#7A5F00' },
  // "Đã áp dụng hồ sơ"
  loadingApply: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadingApplyText: { fontSize: 13, color: '#A07800' },
  dotsRow: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: YELLOW },
  stopButton: {
    height: 56,
    marginHorizontal: 50,
    marginBottom: 14,
    borderWidth: 1.3,
    borderColor: '#B0ABA3',
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  stopText: { fontSize: 17, fontWeight: '600', color: INK },
  resultIntro: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  resultMascot: { width: 80, height: 64 },
  resultLead: { fontSize: 15, fontWeight: '500', color: MUTED, marginTop: 6 },
  resultDishName: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: INK, textAlign: 'center' },
  photoCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultPhoto: { width: '100%', height: '100%' },
  matchBadge: {
    position: 'absolute',
    zIndex: 3,
    left: 12,
    top: 12,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchText: { fontSize: 13, fontWeight: '500', color: INK },
  bold: { fontWeight: '800' },
  resultSheet: {
    flex: 1,
    marginHorizontal: 17,
    marginBottom: 8,
    marginTop: -2,
    borderRadius: 22,
    backgroundColor: '#FFF',
    padding: 12,
    ...shadow,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE5D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { marginTop: 2, color: MUTED, fontSize: 9.5 },
  statValue: { fontSize: 15, fontWeight: '800' },
  reasonBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE5D9',
    backgroundColor: '#FFFCF5',
    padding: 14,
  },
  reasonTitle: { fontSize: 15, fontWeight: '700', color: INK },
  reasonText: { marginTop: 4, color: MUTED, fontSize: 13, lineHeight: 18 },
  againButton: { height: 56, borderRadius: 18, borderWidth: 1.5, borderColor: '#C8C0B4', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...shadow },
  againText: { fontSize: 16, fontWeight: '700', color: INK },
  bottomActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  bottomAction: { alignItems: 'center', gap: 5 },
  bottomActionIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#EEE5D9', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow },
  bottomActionText: { color: '#555', fontSize: 11, fontWeight: '500' },

  /* ResultScreen — 2 nút flex ngang */
  resultBtnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  resultAgainBtn: {
    height: 56, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#C8C0B4',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 18,
    ...shadow,
  },
  resultAgainText: { fontSize: 15, fontWeight: '700', color: INK },
  modalRoot: { flex: 1, justifyContent: 'flex-end', position: 'relative' },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 0,
  },
  bottomSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 27,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: '#000',
    zIndex: 1,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  needsSheet: { height: '88%' },
  locationSheet: { height: '88%' },
  adjustSheet: { height: '86%' },
  sheetHandle: {
    position: 'absolute',
    top: 11,
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D3D3D3',
  },
  sheetClose: {
    position: 'absolute',
    zIndex: 2,
    right: 14,
    top: 25,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    paddingRight: 44,
    color: '#111111',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  sheetTitleCentered: { paddingRight: 0, textAlign: 'center' },
  sheetSubtitle: { marginTop: 4, color: '#666666', fontSize: 15, lineHeight: 21 },
  sheetSubtitleCentered: { textAlign: 'center' },
  sheetGroupTitle: {
    marginTop: 25,
    marginBottom: 10,
    color: '#111111',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '600',
  },
  sheetNeedGrid: {
    marginTop: 18,
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  sheetNeedCard: {
    width: '48.2%',
    height: 106,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    backgroundColor: '#FFF',
    ...shadow,
  },
  sheetNeedLabel: { color: '#111111', fontSize: 15, fontWeight: '500' },
  sheetPrimaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFD12F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryPressed: { backgroundColor: '#F8C927', transform: [{ scale: 0.98 }] },
  sheetPrimaryText: { color: '#111111', fontSize: 17, fontWeight: '700' },
  mapPreview: {
    height: 184,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFF0BD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapRiver: {
    position: 'absolute',
    left: 36,
    top: -25,
    width: 24,
    height: 240,
    borderRadius: 14,
    backgroundColor: '#C7E1F1',
    transform: [{ rotate: '11deg' }],
  },
  mapRoad: {
    position: 'absolute',
    width: '120%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,.92)',
  },
  mapRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#F2B900',
    borderRadius: 999,
    backgroundColor: 'rgba(255,209,47,.08)',
  },
  mapRingLarge: { width: 148, height: 148 },
  mapRingSmall: { width: 82, height: 82 },
  mapPinCenter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFD12F',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  distanceRow: { height: 54, marginTop: 14, flexDirection: 'row', gap: 8 },
  sheetChip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetChipLarge: { flex: 1, height: 54, paddingHorizontal: 0 },
  sheetChipSelected: { backgroundColor: '#FFD54F', borderColor: '#F5B900' },
  sheetChipPressed: { backgroundColor: '#F8C927', borderColor: '#E5AA00' },
  sheetChipText: { color: '#333333', fontSize: 14, fontWeight: '500' },
  sheetChipTextSelected: { color: '#111111', fontWeight: '600' },
  distanceTrackWrap: { height: 34, marginTop: 12, justifyContent: 'center' },
  distanceTrack: { height: 4, borderRadius: 2, backgroundColor: '#DFDFDF' },
  distanceTrackActive: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD12F',
  },
  distanceKnob: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#FFD12F',
    ...shadow,
  },
  distanceLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sheetBodyText: { color: '#333333', fontSize: 15, lineHeight: 21 },
  openOnlyRow: {
    height: 64,
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetNavText: { color: '#202020', fontSize: 16, fontWeight: '500' },
  toggle: {
    width: 54,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E7E4DE',
    padding: 3,
  },
  toggleOn: { backgroundColor: '#FFD12F' },
  toggleKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', ...shadow },
  toggleKnobOn: { marginLeft: 22 },
  sheetHelper: { marginVertical: 14, color: '#777777', fontSize: 13, lineHeight: 18 },
  searchRow: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D1C5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  searchInput: { flex: 1, height: 54, color: '#202020', fontSize: 15 },
  removableChips: { minHeight: 46, marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  removableChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    backgroundColor: '#FFF9EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removableChipText: { color: '#333333', fontSize: 14, fontWeight: '500' },
  dietChips: { minHeight: 86, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  syncRow: {
    height: 60,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D2',
    backgroundColor: '#FFFBF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE796',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFooterRow: { flex: 1, minHeight: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  resetButton: { width: 100, height: 56, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#111111', fontSize: 16, fontWeight: '600' },
  saveButtonWrap: { flex: 1 },

  // ── ResultScreen redesign ─────────────────────────────────────────────────
  resultScroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  // resultIntro: đã có, nhưng override lại cho design mới
  // photoCard: đã có, thêm borderRadius đồng bộ
  resultStatChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    ...shadow,
  },
  resultStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5DC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  resultStatLabel: { fontSize: 11, color: MUTED },
  resultStatValue: { fontSize: 16, fontWeight: '800', color: INK },

  comingSoonSection: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#FFF',
    padding: 14,
    ...shadow,
  },
  comingSoonTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 8 },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE2',
  },
  comingSoonLabel: { flex: 1, fontSize: 14, color: MUTED },
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  comingSoonBadgeText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  noCandidateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  noCandidateTitle: { fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center' },
  noCandidateBody: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
});
