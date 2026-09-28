/**
 * RandomFlowScreen — Quick setup → loading in-place → compact result
 * Theo docs/MOBILE_RANDOM_UX_REDESIGN_2026.md
 */
import { createElement, type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Heart,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Sunrise,
  Wallet,
  X,
} from '@/components/icons';
import {
  budgetKeyToDto,
  getRandomizationContext,
  mealKeyToSlot,
  normalizeImageUrl,
  randomizeDish,
  retryRandomization,
  selectRandomization,
  recordRecommendationEvent,
  type RandomizationResult,
} from '../services/api/randomization';
import { dishesApi } from '../services/api/dishes';
import { profileApi } from '../services/api/profile';
import { formatApiErrorWithCode } from '../lib/api-error';
import { AppImage } from '../components/ui/app-image';
import { NoanWordmark } from '../components/brand/NoanWordmark';
import {
  isDishSaved,
  toggleDishSave,
  subscribeSavedDishChange,
  ensureSavedDishesSynced,
} from '../services/saved-dishes-store';
import { recordRandomRunStore, recordRandomSelectionStore } from '../services/app-store';
import { FoodDetailFlowScreen } from './FoodDetailFlowScreen';
import {
  RandomProfileSheet,
  type ProfileSnapshot,
} from '../components/organisms/RandomProfileSheet';
import type { CatalogItem } from '../services/api/types';
import { noanSemantic } from '../theme/tokens';
import { FoodReelMachine } from '../components/random/FoodReelMachine';
import { useFoodReelSounds } from '../components/random/useFoodReelSounds';

const YELLOW = noanSemantic.primary;
const CREAM = noanSemantic.background;
const WHITE = noanSemantic.surface;
const INK = noanSemantic.text;
const MUTED = noanSemantic.textSecondary;
const BORDER = noanSemantic.border;

const MASCOT = require('../assets/images/noan/noan-mascot-master-v1.png');
const LOADING_MASCOT = require('../assets/images/noan/noan-thinking-v1.png');
const CELEBRATING_MASCOT = require('../assets/images/noan/mascot/noan-celebrating-v1.png');
const CONFETTI_RING = require('../assets/images/noan/effects/celebration-confetti-ring-v1.png');
const COM_TAM_RESULT = require('../assets/images/noan/food-reel/dish-com-tam-v1.png');
const PHO_RESULT = require('../assets/images/random/pho-result.jpg');
const BUN_RIEU = require('../assets/images/random/bun-rieu.jpg');
const BANH_CUON = require('../assets/images/random/banh-cuon.jpg');
const CHAO_GA = require('../assets/images/random/chao-ga.jpg');

// NativeWind's Babel plugin also rewrites createElement to createInteropElement.
// Explicitly opt out and resolve pressed styles here so native receives only
// style objects/arrays rather than a callback that CSS interop can flatten away.
function StyledPressable(props: ComponentProps<typeof Pressable>) {
  const [pressed, setPressed] = useState(false);
  const nativeProps = {
    ...props,
    cssInterop: false,
    style: typeof props.style === 'function' ? props.style({ pressed }) : props.style,
    onPressIn: (event: GestureResponderEvent) => {
      setPressed(true);
      props.onPressIn?.(event);
    },
    onPressOut: (event: GestureResponderEvent) => {
      setPressed(false);
      props.onPressOut?.(event);
    },
  };
  return createElement(Pressable, nativeProps);
}

function getDishFallbackImage(name?: string) {
  const n = (name ?? '').toLowerCase();
  if (n.includes('cơm') || n.includes('sườn') || n.includes('tấm')) return COM_TAM_RESULT;
  if (n.includes('bún') || n.includes('chả') || n.includes('nem')) return BUN_RIEU;
  if (n.includes('bánh')) return BANH_CUON;
  if (n.includes('cháo') || n.includes('gà')) return CHAO_GA;
  return COM_TAM_RESULT;
}

/** Hero ảnh món — luôn hiện fallback local, phủ ảnh remote khi tải xong */
function ResultDishPhoto({ uri, dishName }: { uri?: string | null; dishName?: string }) {
  const fallback = getDishFallbackImage(dishName);
  return (
    <View style={styles.photoWrap}>
      <AppImage
        uri={uri}
        fallbackSource={fallback}
        style={styles.photo}
        contentFit="cover"
        showLoader
      />
    </View>
  );
}

type Props = { onClose: () => void };
type Phase = 'setup' | 'result';
type MealKey = 'Sáng' | 'Trưa' | 'Tối' | 'Bữa phụ';
type BudgetKey = 'Dưới 40K' | '40K–80K' | 'Không giới hạn';

const MEALS: Array<{ key: MealKey; label: string; Icon: typeof Sun }> = [
  { key: 'Sáng', label: 'Sáng', Icon: Sunrise },
  { key: 'Trưa', label: 'Trưa', Icon: Sun },
  { key: 'Tối', label: 'Tối', Icon: Moon },
  { key: 'Bữa phụ', label: 'Bữa phụ', Icon: Coffee },
];

const BUDGETS: BudgetKey[] = ['Dưới 40K', '40K–80K', 'Không giới hạn'];

function slotToMealKey(slot: string): MealKey {
  const map: Record<string, MealKey> = {
    BREAKFAST: 'Sáng',
    LUNCH: 'Trưa',
    DINNER: 'Tối',
    SNACK: 'Bữa phụ',
  };
  return map[slot] ?? 'Trưa';
}

function formatPrice(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return 'Chưa có giá';
  if (min != null && max != null) return `${Math.round(min / 1000)}K–${Math.round(max / 1000)}K`;
  if (max != null) return `~${Math.round(max / 1000)}K`;
  return `~${Math.round((min as number) / 1000)}K`;
}

export function RandomFlowScreen({ onClose }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('setup');
  const [meal, setMeal] = useState<MealKey | null>(null);
  const [budget, setBudget] = useState<BudgetKey>('Không giới hạn');
  const [mealSource, setMealSource] = useState<'AUTO_TIME' | 'USER_SELECTED'>('USER_SELECTED');
  const [mealReady, setMealReady] = useState(false);

  const [profileSnap, setProfileSnap] = useState<ProfileSnapshot | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [queuedMode, setQueuedMode] = useState<'fresh' | 'again'>('fresh');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [noCandidateMessage, setNoCandidateMessage] = useState<string | null>(null);

  const [ba006Result, setBa006Result] = useState<RandomizationResult | null>(null);
  const [resolvedImage, setResolvedImage] = useState<ImageSourcePropType | undefined>();
  const [showDetail, setShowDetail] = useState(false);
  const [saved, setSaved] = useState(false);

  const requestSeq = useRef(0);
  const spinStartedRef = useRef(false);
  const cancelledRef = useRef(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDishIdRef = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const celebrationLift = useSharedValue(0);
  const celebrationFloat = useSharedValue(0);

  useEffect(() => {
    if (phase !== 'result' || !ba006Result?.dish) return;
    if (reducedMotion) {
      celebrationLift.value = 0;
      celebrationFloat.value = 0;
      return;
    }

    celebrationLift.value = withSequence(
      withTiming(-14, { duration: 260, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 280, easing: Easing.out(Easing.back(1.2)) }, () => {
        celebrationFloat.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          true,
        );
      }),
    );

    return () => {
      cancelAnimation(celebrationLift);
      cancelAnimation(celebrationFloat);
    };
  }, [phase, ba006Result?.dish?.id, reducedMotion, celebrationLift, celebrationFloat]);

  const celebratingMascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: celebrationLift.value + celebrationFloat.value }],
  }));

  useEffect(() => {
    ensureSavedDishesSynced();
    return subscribeSavedDishChange((changedDishId, isSavedVal) => {
      if (ba006Result?.dish?.id === changedDishId) {
        setSaved(isSavedVal);
      }
    });
  }, [ba006Result?.dish?.id]);

  useEffect(() => {
    getRandomizationContext()
      .then((ctx) => {
        if (ctx.suggestedMealSlot) {
          setMeal(slotToMealKey(ctx.suggestedMealSlot));
          setMealSource('AUTO_TIME');
        } else {
          setMeal('Trưa');
          setMealSource('USER_SELECTED');
        }
        setMealReady(true);
      })
      .catch(() => {
        setMeal('Trưa');
        setMealSource('USER_SELECTED');
        setMealReady(true);
      });

    // Preload hồ sơ để runtimeOverrides sẵn sàng trước khi mở sheet
    void (async () => {
      try {
        const me = await profileApi.me<{
          version?: number;
          profileVersion?: number;
          noAllergies?: boolean;
          preferences?: {
            primaryGoal?: { id: string; code: string; name: string } | null;
            tastePreferences?: CatalogItem[];
            dietTypes?: CatalogItem[];
            allergens?: CatalogItem[];
          };
        }>();
        setProfileSnap({
          profileVersion: me.version ?? me.profileVersion ?? 1,
          primaryGoal: me.preferences?.primaryGoal ?? null,
          dietTypes: me.preferences?.dietTypes ?? [],
          tasteIds: (me.preferences?.tastePreferences ?? []).map((x) => x.id),
          allergens: me.preferences?.allergens ?? [],
          noAllergies: Boolean(me.noAllergies),
          goalCodes: me.preferences?.primaryGoal?.code ? [me.preferences.primaryGoal.code] : [],
          dietTypeCodes: (me.preferences?.dietTypes ?? []).map((d) => d.code).filter(Boolean),
        });
      } catch {
        // optional
      }
    })();
  }, []);

  useEffect(() => {
    const dish = ba006Result?.dish;
    if (!dish?.id) {
      setResolvedImage(undefined);
      return;
    }
    const fromRandom = normalizeImageUrl(dish.imageUrl);
    if (fromRandom) {
      setResolvedImage({ uri: fromRandom });
      return;
    }
    let cancelled = false;
    dishesApi
      .getById(dish.id)
      .then((full) => {
        if (cancelled) return;
        const media = (full as any)?.media as
          | Array<{ publicUrl?: string; storageKey?: string; bucket?: string; isPrimary?: boolean }>
          | undefined;
        const primary = media?.find((m) => m.isPrimary) ?? media?.[0];
        const url =
          normalizeImageUrl((full as any)?.imageUrl) ??
          normalizeImageUrl(primary?.publicUrl) ??
          null;
        if (url) {
          setResolvedImage({ uri: url });
          return;
        }
        if (primary?.storageKey) {
          const base = (
            globalThis as typeof globalThis & {
              process?: { env?: Record<string, string | undefined> };
            }
          ).process?.env?.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
          if (base) {
            const bucket = primary.bucket ?? 'dish-images';
            const uri = `${base}/storage/v1/object/public/${bucket}/${primary.storageKey}`;
            setResolvedImage({ uri });
            return;
          }
        }
        setResolvedImage(undefined);
      })
      .catch(() => {
        if (!cancelled) setResolvedImage(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [ba006Result?.dish?.id, ba006Result?.dish?.imageUrl]);

  const clearOverlayTimer = () => {
    if (overlayTimer.current) {
      clearTimeout(overlayTimer.current);
      overlayTimer.current = null;
    }
  };

  const stopLoading = () => {
    clearOverlayTimer();
    setLoading(false);
    setShowOverlay(false);
    setSpinning(false);
    setFinishing(false);
  };

  const cancelRequest = () => {
    cancelledRef.current = true;
    requestSeq.current += 1;
    spinStartedRef.current = false;
    stopLoading();
  };

  const runRandom = useCallback(
    async (mode: 'fresh' | 'again') => {
      if (!meal) return;
      const seq = ++requestSeq.current;
      cancelledRef.current = false;
      setFetchError(null);
      setNoCandidateMessage(null);
      setLoading(true);
      setShowOverlay(true);
      setSpinning(true);
      setFinishing(false);
      clearOverlayTimer();
      const spinStartedAt = Date.now();

      try {
        const result =
          mode === 'again' && ba006Result?.randomizationId
            ? await retryRandomization(ba006Result.randomizationId, true)
            : await randomizeDish({
                source: mode === 'again' ? 'RANDOM_AGAIN' : 'RANDOM_FLOW',
                meal: {
                  slot: mealKeyToSlot(meal),
                  selectionSource: mealSource,
                },
                budget: budgetKeyToDto(budget),
                runtimeOverrides: {
                  goalCodes: profileSnap?.goalCodes?.length ? profileSnap.goalCodes : undefined,
                  dietTypeCodes: profileSnap?.dietTypeCodes?.length
                    ? profileSnap.dietTypeCodes
                    : undefined,
                },
                excludeDishIds:
                  mode === 'again' && lastDishIdRef.current ? [lastDishIdRef.current] : undefined,
              });

        if (cancelledRef.current || requestSeq.current !== seq) return;

        setBa006Result(result);
        if (result?.dish) {
          lastDishIdRef.current = result.dish.id;
          setSaved(isDishSaved(result.dish.id));
          if (result.randomizationId) {
            recordRecommendationEvent(result.randomizationId, 'IMPRESSION').catch(() => undefined);
          }
          recordRandomRunStore(result);
          // Give the reel time to spin, then stop its three columns before revealing the dish.
          const remainingSpin = Math.max(0, 1700 - (Date.now() - spinStartedAt));
          if (remainingSpin) await new Promise((resolve) => setTimeout(resolve, remainingSpin));
          if (cancelledRef.current || requestSeq.current !== seq) return;
          setFinishing(true);
          overlayTimer.current = setTimeout(() => {
            if (cancelledRef.current || requestSeq.current !== seq) return;
            setPhase('result');
            setShowDetail(false);
            stopLoading();
          }, 1900);
          return;
        }

        const summary =
          result?.reason?.summary ??
          result?.explanation?.summary ??
          'Không tìm thấy món phù hợp với tiêu chí của bạn.';
        setNoCandidateMessage(summary);
        setPhase('setup');
        stopLoading();
      } catch (err) {
        if (cancelledRef.current || requestSeq.current !== seq) return;
        setFetchError(formatApiErrorWithCode(err));
        setPhase('setup');
        stopLoading();
      }
    },
    [meal, mealSource, budget, profileSnap, ba006Result?.randomizationId],
  );

  const openMachine = (mode: 'fresh' | 'again') => {
    if (!meal || !mealReady || loading) return;
    spinStartedRef.current = false;
    setQueuedMode(mode);
    setSpinning(false);
    setFinishing(false);
    setLoading(true);
    setShowOverlay(true);
  };

  const pullLever = () => {
    if (spinStartedRef.current || spinning || finishing) return;
    spinStartedRef.current = true;
    void runRandom(queuedMode);
  };

  const onSelectMeal = (key: MealKey) => {
    setMeal(key);
    setMealSource('USER_SELECTED');
  };

  const dish = ba006Result?.dish ?? null;
  const explanation = ba006Result?.explanation ?? null;

  if (showDetail && dish) {
    return (
      <FoodDetailFlowScreen
        initialPage="overview"
        dishId={dish.id}
        dishName={dish.name}
        dishImage={resolvedImage}
        meal={meal ?? 'Bữa ăn'}
        priceMin={dish.priceMin}
        priceMax={dish.priceMax}
        prepMinutes={dish.prepMinutes}
        cookMinutes={dish.cookMinutes}
        shortDescription={dish.shortDescription}
        originText={dish.originText}
        nutrition={dish.nutrition}
        ingredients={dish.ingredients ?? []}
        allergens={dish.allergens ?? []}
        recipeSteps={dish.recipeSteps ?? []}
        difficulty={dish.difficulty}
        explanation={explanation}
        onClose={() => setShowDetail(false)}
        onFinish={() => {
          if (ba006Result?.randomizationId) {
            selectRandomization(ba006Result.randomizationId).catch(() => undefined);
          }
          if (ba006Result) recordRandomSelectionStore(ba006Result);
          onClose();
        }}
      />
    );
  }

  if (phase === 'result' && dish) {
    const totalMin = (dish.prepMinutes ?? 0) + (dish.cookMinutes ?? 0);
    const priceLabel = formatPrice(dish.priceMin, dish.priceMax);
    const timeLabel = totalMin > 0 ? `${totalMin} phút` : '—';
    const budgetRelaxed = (explanation?.fallbackApplied ?? []).includes('budget');
    const fromResolved =
      resolvedImage && typeof resolvedImage === 'object' && 'uri' in resolvedImage
        ? (resolvedImage as { uri?: string }).uri
        : undefined;
    const dishImageUri =
      normalizeImageUrl(dish.imageUrl) ?? normalizeImageUrl(fromResolved) ?? null;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.resultHeader}>
          <Pressable onPress={() => setPhase('setup')} style={styles.plainBackBtn} hitSlop={14}>
            <ArrowLeft size={24} color="#2A1A10" strokeWidth={2.4} />
          </Pressable>
          <View style={styles.resultBrand} pointerEvents="none">
            <Text style={styles.resultWordmark} accessibilityLabel="NOAN — Nghé Ơi, Ăn Ngon">NOAN</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.resultScroll,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
          bounces={false}
        >
          <Text style={styles.resultTitle} accessibilityLiveRegion="polite">
            NOAN chọn được món rồi!
          </Text>
          <Text style={styles.resultSub}>Một món ngon dành cho bạn</Text>

          <View style={styles.resultDishCardContainer}>
            {/* Top-left scattered gold confetti ribbons */}
            <View style={styles.confettiTopLeft1} pointerEvents="none" />
            <View style={styles.confettiTopLeft2} pointerEvents="none" />
            <View style={styles.confettiTopLeft3} pointerEvents="none" />
            <View style={styles.confettiTopLeft4} pointerEvents="none" />

            {/* Celebration confetti ring / burst behind mascot */}
            <View style={styles.confettiRingWrap} pointerEvents="none">
              <Image
                source={CONFETTI_RING}
                resizeMode="contain"
                style={styles.fullSize}
              />
            </View>

            {/* Warm radiant glow behind mascot */}
            <View style={styles.mascotSunburst} pointerEvents="none" />

            {/* White card container */}
            <View style={styles.resultDishCard}>
              <View style={[styles.resultPhotoStage, { height: Math.max(255, Math.min(360, windowHeight * 0.36)) }]}>
                <ResultDishPhoto uri={dishImageUri || null} dishName={dish.name} />
              </View>

              <View style={styles.resultDishInfo}>
                <View style={styles.resultDishTitleRow}>
                  <View style={styles.resultDishTextCol}>
                    <Text style={styles.dishName} numberOfLines={2}>
                      {dish.name}
                    </Text>
                    <Text style={styles.resultMetaLine}>
                      {meal ? (meal === 'Bữa phụ' ? 'Bữa phụ' : `Bữa ${meal.toLowerCase()}`) : 'Bữa trưa'}
                      {dish.nutrition?.calories != null
                        ? ` · ${Math.round(dish.nutrition.calories)} kcal`
                        : ''}
                    </Text>
                  </View>

                  <StyledPressable
                    onPress={async () => {
                      if (!dish?.id) return;
                      try {
                        const nextSaved = await toggleDishSave(dish.id, saved, {
                          name: dish.name,
                          imageUrl: dishImageUri ?? undefined,
                          priceMin: dish.priceMin ?? undefined,
                          priceMax: dish.priceMax ?? undefined,
                          kcal: dish.nutrition?.calories ?? undefined,
                        });
                        setSaved(nextSaved);
                      } catch (e: any) {
                        Alert.alert('Lỗi', e?.message || 'Không thể cập nhật món đã lưu.');
                      }
                    }}
                    hitSlop={12}
                    style={({ pressed }) => [styles.heartBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? 'Bỏ lưu món' : 'Lưu món'}
                    accessibilityState={{ selected: saved }}
                  >
                    <Heart
                      size={26}
                      color={saved ? '#FFC928' : '#2A1A10'}
                      fill={saved ? '#FFC928' : 'transparent'}
                      strokeWidth={1.8}
                    />
                  </StyledPressable>
                </View>
              </View>
            </View>

            {/* Nghé NOAN jumping celebrating at top-right overlapping card */}
            <View style={styles.mascotWrap} pointerEvents="none">
              <Animated.Image
                source={CELEBRATING_MASCOT}
                resizeMode="contain"
                style={[styles.fullSize, celebratingMascotStyle]}
                accessibilityLabel="Nghé NOAN đang nhảy ăn mừng món ăn được chọn"
              />
            </View>
          </View>

          <StyledPressable
            style={({ pressed }) => [styles.chooseBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Xem chi tiết món ăn"
            onPress={() => setShowDetail(true)}
            disabled={loading}
          >
            <Text style={styles.chooseTxt}>Xem món ăn</Text>
            <ChevronRight size={20} color="#2A1A10" strokeWidth={3} />
          </StyledPressable>

          <StyledPressable
            style={({ pressed }) => [styles.againBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Chọn một món khác"
            onPress={() => {
              if (ba006Result?.randomizationId) {
                recordRecommendationEvent(ba006Result.randomizationId, 'RETRY').catch(
                  () => undefined,
                );
              }
              openMachine('again');
            }}
            disabled={loading}
          >
            <Text style={styles.againTxt}>Chọn món khác</Text>
          </StyledPressable>

          <View style={styles.tagline}>
            <LeafIcon size={14} color="#A8988B" />
            <Text style={styles.taglineTxt}>Ngon miệng cùng NOAN</Text>
            <LeafIcon size={14} color="#A8988B" flip />
          </View>
        </ScrollView>

        {showOverlay && loading ? (
          <LoadingOverlay
            meal={meal}
            budget={budget}
            spinning={spinning}
            finishing={finishing}
            selectedDish={
              ba006Result?.dish
                ? (resolvedImage ?? getDishFallbackImage(ba006Result.dish.name))
                : undefined
            }
            onCancel={cancelRequest}
            onPull={pullLever}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  const errorBanner = fetchError ?? noCandidateMessage;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
          <ArrowLeft size={20} color={INK} />
        </Pressable>
        <NoanWordmark width={92} height={32} />
        <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
          <X size={20} color={INK} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.setupScroll}
        bounces={false}
        pointerEvents={loading ? 'none' : 'auto'}
      >
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setupTitle}>Hôm nay ăn gì?</Text>
            <Text style={styles.setupSub}>Chọn nhanh, NOAN lo phần còn lại.</Text>
          </View>
          <Image source={MASCOT} style={styles.setupMascot} resizeMode="contain" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bữa ăn</Text>
          <Text style={styles.cardSub}>
            {mealReady && mealSource === 'AUTO_TIME'
              ? 'Gợi ý theo thời gian hiện tại.'
              : 'Chọn bữa bạn muốn ăn.'}
          </Text>
          <View style={styles.mealGrid}>
            {MEALS.map(({ key, label, Icon }) => {
              const selected = meal === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.mealChip, selected && styles.mealChipOn]}
                  onPress={() => onSelectMeal(key)}
                >
                  {selected ? (
                    <View style={styles.selectedBadge}>
                      <Check size={9} color={INK} strokeWidth={3} />
                    </View>
                  ) : null}
                  <Icon size={22} color={selected ? INK : MUTED} strokeWidth={selected ? 2 : 1.8} />
                  <Text style={[styles.mealChipTxt, selected && styles.mealChipTxtOn]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ngân sách</Text>
          <Text style={styles.cardSub}>Bạn có thể đổi bất cứ lúc nào.</Text>
          <View style={styles.budgetRow}>
            {BUDGETS.map((b) => {
              const selected = budget === b;
              return (
                <Pressable
                  key={b}
                  style={[styles.budgetChip, selected && styles.budgetChipOn]}
                  onPress={() => setBudget(b)}
                >
                  {selected ? (
                    <View style={styles.selectedBadge}>
                      <Check size={9} color={INK} strokeWidth={3} />
                    </View>
                  ) : null}
                  <Text
                    style={[styles.budgetChipTxt, selected && styles.budgetChipTxtOn]}
                    numberOfLines={2}
                  >
                    {b}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable style={styles.profileRow} onPress={() => setSheetOpen(true)}>
          <View style={styles.profileIcon}>
            <ShieldCheck size={18} color="#15803D" />
          </View>
          <Text style={styles.profileTxt}>Đã áp dụng hồ sơ ăn uống</Text>
          <Text style={styles.profileLink}>Xem ›</Text>
        </Pressable>

        {errorBanner ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTxt}>{errorBanner}</Text>
            <View style={styles.errorActions}>
              <Pressable
                style={styles.errorBtn}
                onPress={() => {
                  setFetchError(null);
                  setNoCandidateMessage(null);
                  openMachine('fresh');
                }}
              >
                <Text style={styles.errorBtnTxt}>Thử lại</Text>
              </Pressable>
              <Pressable
                style={styles.errorBtnGhost}
                onPress={() => {
                  setFetchError(null);
                  setNoCandidateMessage(null);
                }}
              >
                <Text style={styles.errorBtnGhostTxt}>Sửa lựa chọn</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.setupFooter}>
        <Pressable
          style={[styles.cta, (!meal || !mealReady || loading) && { opacity: 0.55 }]}
          disabled={!meal || !mealReady || loading}
          onPress={() => openMachine('fresh')}
        >
          {loading && !showOverlay ? (
            <ActivityIndicator color={INK} />
          ) : (
            <Text style={styles.ctaTxt}>Chọn món cho tôi</Text>
          )}
        </Pressable>
        <Text style={styles.ctaHint}>Không ưng? Bạn có thể đổi món.</Text>
      </View>

      {showOverlay && loading ? (
        <LoadingOverlay
          meal={meal}
          budget={budget}
          spinning={spinning}
          finishing={finishing}
          selectedDish={
            ba006Result?.dish
              ? (resolvedImage ?? getDishFallbackImage(ba006Result.dish.name))
              : undefined
          }
          onCancel={cancelRequest}
          onPull={pullLever}
        />
      ) : null}

      <RandomProfileSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialSnapshot={profileSnap}
        onApplied={setProfileSnap}
      />
    </SafeAreaView>
  );
}

function LeafIcon({
  size = 14,
  color = '#B5A59B',
  flip = false,
}: {
  size?: number;
  color?: string;
  flip?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M13.8 2.2C8.8 2.4 4.5 6.2 2.6 13.4C6.8 12.8 11.2 10.4 13.8 2.2Z"
        fill={color}
      />
    </Svg>
  );
}

function ForkSpoonIcon({ size = 18, color = '#3C2415' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 20 23" fill={color}>
      <Path d="M3.5 1v7c0 1.1.9 2 2 2v11a1 1 0 1 0 2 0V10c1.1 0 2-.9 2-2V1a1 1 0 0 0-2 0v5h-1V1a1 1 0 1 0-2 0v5h-1V1a1 1 0 1 0-2 0z" />
      <Path d="M15 1c-2.2 0-3.5 2.2-3.5 4.5S12.8 10 14 10v11a1 1 0 1 0 2 0V10c1.2 0 2.5-2.2 2.5-4.5S17.2 1 15 1z" />
    </Svg>
  );
}

function LoadingOverlay({
  meal,
  budget,
  spinning,
  finishing,
  selectedDish,
  onCancel,
  onPull,
}: {
  meal: MealKey | null;
  budget: BudgetKey;
  spinning: boolean;
  finishing: boolean;
  selectedDish?: ImageSourcePropType;
  onCancel: () => void;
  onPull: () => void;
}) {
  useFoodReelSounds(spinning, finishing);
  const reducedMotion = useReducedMotion();
  const entrance = useSharedValue(reducedMotion ? 1 : 0);
  const mascotFloat = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reducedMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    mascotFloat.value = withRepeat(withTiming(-4, { duration: 700 }), -1, true);
    return () => cancelAnimation(mascotFloat);
  }, [mascotFloat, reducedMotion]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 22 }, { scale: 0.96 + entrance.value * 0.04 }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: mascotFloat.value }] }));

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Animated.View style={[styles.overlayCard, entranceStyle]}>
        <Animated.Image
          source={LOADING_MASCOT}
          style={[styles.overlayMascot, mascotStyle]}
          resizeMode="contain"
          importantForAccessibility="no"
        />

        <View style={styles.overlayCopy}>
          <View style={styles.livePillRow}>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>
                {spinning ? 'ĐANG CHỌN MÓN' : 'SẴN SÀNG CHỌN MÓN'}
              </Text>
            </View>
            <Svg width={18} height={14} viewBox="0 0 18 14" style={styles.sparkleRay}>
              <Path d="M2 12L7 4" stroke="#FFB800" strokeWidth="2.5" strokeLinecap="round" />
              <Path d="M10 13L15 2" stroke="#FFB800" strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.overlayTitle}>
            {finishing ? 'Đã tìm thấy món phù hợp!' : 'Hôm nay ăn món gì?'}
          </Text>
          <Text style={styles.overlaySub}>
            {meal ?? 'Bữa'} · {budget}
          </Text>
        </View>

        <FoodReelMachine
          running={spinning}
          finishing={finishing}
          selectedDish={selectedDish}
          onPull={onPull}
        />

        <View style={styles.machineCaption}>
          <ForkSpoonIcon size={18} color="#3C2415" />
          <Text style={styles.machineCaptionTxt} accessibilityLiveRegion="polite">
            {finishing
              ? 'NOAN đã chọn món cho bạn'
              : spinning
                ? 'NOAN đang cân bằng khẩu vị của bạn'
                : 'Kéo cần gạt để NOAN chọn món'}
          </Text>
        </View>

        <View style={styles.loadingSteps}>
          <View style={[styles.loadingStep, (spinning || finishing) && styles.loadingStepActive]} />
          <View style={[styles.loadingStep, (spinning || finishing) && styles.loadingStepActive]} />
          <View style={[styles.loadingStep, finishing && styles.loadingStepActive]} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hủy chọn món"
          style={styles.cancelBtn}
          onPress={onCancel}
        >
          <Text style={styles.cancelTxt}>Huỷ</Text>
        </Pressable>

        <Text style={styles.loadingHint}>
          {finishing
            ? 'Đang mở món ăn của bạn...'
            : spinning
              ? 'Một món phù hợp đang đến...'
              : 'Kéo cần gạt xuống hoặc chạm để bắt đầu'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultHeader: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  plainBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  resultBrand: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerSpacer: { width: 44, height: 44 },
  brand: { width: 92, height: 32 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  setupScroll: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, marginBottom: 4 },
  setupTitle: { fontSize: 28, fontWeight: '900', color: INK, letterSpacing: -0.5 },
  setupSub: { fontSize: 14, fontWeight: '500', color: MUTED, marginTop: 4 },
  setupMascot: { width: 76, height: 76, marginLeft: 8 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#5D490F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: INK },
  cardSub: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 14 },

  mealGrid: { flexDirection: 'row', gap: 8 },
  mealChip: {
    flex: 1,
    height: 76,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  mealChipOn: { backgroundColor: '#FFFDF0', borderColor: YELLOW, borderWidth: 2 },
  mealChipTxt: { fontSize: 13, fontWeight: '600', color: MUTED, textAlign: 'center' },
  mealChipTxtOn: { color: INK, fontWeight: '800' },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },

  budgetRow: { flexDirection: 'row', gap: 8 },
  budgetChip: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  budgetChipOn: { backgroundColor: '#FFFDF0', borderColor: YELLOW, borderWidth: 2 },
  budgetChipTxt: { fontSize: 13, fontWeight: '600', color: MUTED, textAlign: 'center' },
  budgetChipTxtOn: { color: INK, fontWeight: '800' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#5D490F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTxt: { flex: 1, fontSize: 14.5, fontWeight: '700', color: INK },
  profileLink: { fontSize: 13.5, fontWeight: '700', color: '#8C7A5B' },

  errorBox: {
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
  },
  errorTxt: { fontSize: 13, color: '#B91C1C', lineHeight: 18 },
  errorActions: { flexDirection: 'row', gap: 8 },
  errorBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnTxt: { fontSize: 14, fontWeight: '800', color: INK },
  errorBtnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnGhostTxt: { fontSize: 14, fontWeight: '700', color: INK },

  setupFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: CREAM,
  },
  cta: {
    height: 54,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontSize: 17, fontWeight: '800', color: INK },
  ctaHint: { fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 8 },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 20, 15, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: '#2A1A10',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 10,
  },
  overlayCopy: { paddingRight: 104 },
  livePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  livePill: {
    backgroundColor: '#FFB800',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 5.5,
  },
  sparkleRay: {
    marginLeft: 3,
    marginTop: -8,
  },
  livePillText: {
    color: '#3C2415',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  overlayMascot: {
    position: 'absolute',
    top: -28,
    right: 14,
    width: 122,
    height: 128,
    zIndex: 10,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3C2415',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  overlaySub: {
    fontSize: 14,
    color: '#8D7B70',
    marginTop: 2,
    fontWeight: '500',
  },

  machineCaption: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  machineCaptionTxt: {
    color: '#3C2415',
    fontSize: 14.5,
    fontWeight: '800',
  },
  loadingSteps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadingStep: {
    width: 32,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EFE8DC',
  },
  loadingStepActive: {
    backgroundColor: '#FFB800',
  },
  cancelBtn: {
    alignSelf: 'center',
    minWidth: 110,
    height: 44,
    marginTop: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5EFE6',
    borderRadius: 22,
  },
  cancelBtnPressed: { opacity: 0.72 },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3C2415',
  },
  loadingHint: {
    textAlign: 'center',
    color: '#8D7B70',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },

  pressed: { opacity: 0.72 },
  resultWordmark: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#48210B',
  },
  resultScroll: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  resultTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
    color: '#2A1A10',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  resultSub: {
    fontSize: 15,
    color: '#6B4A32',
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  resultDishCardContainer: {
    position: 'relative',
    width: '100%',
    marginTop: 4,
  },
  confettiRingWrap: {
    position: 'absolute',
    top: -38,
    right: -12,
    width: 240,
    height: 280,
    zIndex: 6,
  },
  mascotWrap: {
    position: 'absolute',
    top: -34,
    right: -8,
    width: '44%',
    aspectRatio: 2 / 3,
    zIndex: 20,
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  mascotSunburst: {
    position: 'absolute',
    top: -35,
    right: -15,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255, 238, 185, 0.45)',
    zIndex: 5,
  },
  confettiTopLeft1: {
    position: 'absolute',
    top: -16,
    left: 14,
    width: 14,
    height: 7,
    borderRadius: 2,
    backgroundColor: '#F8BD26',
    transform: [{ rotate: '25deg' }],
    zIndex: 12,
  },
  confettiTopLeft2: {
    position: 'absolute',
    top: 14,
    left: -8,
    width: 12,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#F8BD26',
    transform: [{ rotate: '-35deg' }],
    zIndex: 12,
  },
  confettiTopLeft3: {
    position: 'absolute',
    top: -32,
    left: 60,
    width: 10,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: '#F8BD26',
    transform: [{ rotate: '15deg' }],
    zIndex: 12,
  },
  confettiTopLeft4: {
    position: 'absolute',
    top: 40,
    left: -16,
    width: 9,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: '#FFD752',
    transform: [{ rotate: '45deg' }],
    zIndex: 12,
  },
  resultDishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    shadowColor: '#2A1A10',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
    overflow: 'visible',
    zIndex: 2,
  },
  resultPhotoStage: {
    position: 'relative',
    height: 255,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF2C9',
  },
  resultDishInfo: {
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  resultDishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultDishTextCol: {
    flex: 1,
    marginRight: 12,
  },
  dishName: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.3,
  },
  resultMetaLine: {
    fontSize: 14.5,
    color: '#7E6E65',
    fontWeight: '500',
    marginTop: 4,
  },
  heartBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF2C9',
    height: '100%',
    width: '100%',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 242, 201, 0.35)',
  },
  chooseBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFC928',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#E6AC00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  chooseTxt: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.2,
  },
  againBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: '#2A1A10',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  againTxt: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2A1A10',
    letterSpacing: -0.2,
  },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  taglineTxt: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#A8988B',
    letterSpacing: 0.2,
  },
  whyCard: {
    marginTop: 14,
    backgroundColor: WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: '#5D490F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  whyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whyTitle: { fontSize: 16, fontWeight: '800', color: INK },
  whyBody: { fontSize: 13.5, color: '#444444', lineHeight: 20, marginTop: 4 },
  whyMascot: { width: 48, height: 48, marginLeft: 8 },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE0',
    marginTop: 2,
  },
  detailLinkTitle: { fontSize: 14, fontWeight: '700', color: INK },
  detailLinkSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  priceNote: { fontSize: 11.5, color: '#8A8A8A', marginTop: 10 },
});
