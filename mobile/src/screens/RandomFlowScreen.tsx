/**
 * RandomFlowScreen — Quick setup → loading in-place → compact result
 * Theo docs/MOBILE_RANDOM_UX_REDESIGN_2026.md
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Sunrise,
  Utensils,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react-native';
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
import { FoodDetailFlowScreen } from './FoodDetailFlowScreen';
import {
  RandomProfileSheet,
  type ProfileSnapshot,
} from '../components/organisms/RandomProfileSheet';
import type { CatalogItem } from '../services/api/types';

const YELLOW = '#FFC31A';
const CREAM = '#FFF9EB';
const WHITE = '#FFFFFF';
const INK = '#101010';
const MUTED = '#686868';
const BORDER = '#E9E1D2';

const BRAND = require('../assets/images/logo/mogu-wordmark-header.png');
const MASCOT = require('../assets/images/logo/mogu-mascot.png');
const LOADING_MASCOT = require('../assets/images/random/random-loading.png');
const PHO_RESULT = require('../assets/images/random/pho-result.jpg');
const BUN_RIEU = require('../assets/images/random/bun-rieu.jpg');
const BANH_CUON = require('../assets/images/random/banh-cuon.jpg');
const CHAO_GA = require('../assets/images/random/chao-ga.jpg');

function getDishFallbackImage(name?: string) {
  const n = (name ?? '').toLowerCase();
  if (n.includes('bún') || n.includes('chả') || n.includes('nem')) return BUN_RIEU;
  if (n.includes('bánh')) return BANH_CUON;
  if (n.includes('cháo') || n.includes('cơm') || n.includes('gà')) return CHAO_GA;
  return PHO_RESULT;
}

/** Hero ảnh món — luôn hiện fallback local, phủ ảnh remote khi tải xong */
function ResultDishPhoto({
  uri,
  dishName,
}: {
  uri?: string | null;
  dishName?: string;
}) {
  const fallback = getDishFallbackImage(dishName);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(Boolean(uri));

  useEffect(() => {
    setRemoteFailed(false);
    setRemoteLoading(Boolean(uri));
  }, [uri]);

  const showRemote = Boolean(uri) && !remoteFailed;

  return (
    <View style={styles.photoWrap}>
      {/* Luôn có ảnh local làm nền — tránh khung trống vàng */}
      <Image source={fallback} style={styles.photo} resizeMode="cover" />

      {showRemote ? (
        <Image
          key={uri!}
          source={{ uri: uri! }}
          style={[styles.photo, StyleSheet.absoluteFill]}
          resizeMode="cover"
          onLoadStart={() => setRemoteLoading(true)}
          onLoad={() => setRemoteLoading(false)}
          onError={() => {
            setRemoteFailed(true);
            setRemoteLoading(false);
          }}
        />
      ) : null}

      {remoteLoading && showRemote ? (
        <View style={[StyleSheet.absoluteFill, styles.photoLoader]} pointerEvents="none">
          <ActivityIndicator size="small" color={YELLOW} />
        </View>
      ) : null}
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
  const [phase, setPhase] = useState<Phase>('setup');
  const [meal, setMeal] = useState<MealKey | null>(null);
  const [budget, setBudget] = useState<BudgetKey>('Không giới hạn');
  const [mealSource, setMealSource] = useState<'AUTO_TIME' | 'USER_SELECTED'>('USER_SELECTED');
  const [mealReady, setMealReady] = useState(false);

  const [profileSnap, setProfileSnap] = useState<ProfileSnapshot | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [noCandidateMessage, setNoCandidateMessage] = useState<string | null>(null);

  const [ba006Result, setBa006Result] = useState<RandomizationResult | null>(null);
  const [resolvedImage, setResolvedImage] = useState<ImageSourcePropType | undefined>();
  const [showDetail, setShowDetail] = useState(false);
  const [saved, setSaved] = useState(false);

  const requestSeq = useRef(0);
  const cancelledRef = useRef(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDishIdRef = useRef<string | null>(null);

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
          goalCodes: me.preferences?.primaryGoal?.code
            ? [me.preferences.primaryGoal.code]
            : [],
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
            globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
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
  };

  const cancelRequest = () => {
    cancelledRef.current = true;
    requestSeq.current += 1;
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
      setShowOverlay(false);
      clearOverlayTimer();
      overlayTimer.current = setTimeout(() => {
        if (requestSeq.current === seq && !cancelledRef.current) setShowOverlay(true);
      }, 250);

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
                  mode === 'again' && lastDishIdRef.current
                    ? [lastDishIdRef.current]
                    : undefined,
              });

        if (cancelledRef.current || requestSeq.current !== seq) return;

        setBa006Result(result);
        if (result?.dish) {
          lastDishIdRef.current = result.dish.id;
          if (result.randomizationId) {
            recordRecommendationEvent(result.randomizationId, 'IMPRESSION').catch(() => undefined);
          }
          setPhase('result');
          setShowDetail(false);
          stopLoading();
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
    const reason =
      explanation?.summary?.trim() ||
      'Phù hợp bữa và ngân sách bạn chọn.';
    const fromResolved =
      resolvedImage && typeof resolvedImage === 'object' && 'uri' in resolvedImage
        ? (resolvedImage as { uri?: string }).uri
        : undefined;
    const dishImageUri =
      normalizeImageUrl(dish.imageUrl) ?? normalizeImageUrl(fromResolved) ?? null;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => setPhase('setup')} style={styles.iconBtn} hitSlop={8}>
            <ArrowLeft size={22} color={INK} />
          </Pressable>
          <Image source={BRAND} style={styles.brand} resizeMode="contain" />
          <Pressable onPress={() => setSaved((v) => !v)} style={styles.iconBtn} hitSlop={8}>
            <Bookmark
              size={20}
              color={saved ? '#C08000' : INK}
              fill={saved ? YELLOW : 'transparent'}
            />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultScroll}
          bounces={false}
        >
          <Text style={styles.resultTitle}>Mogu chọn cho bạn</Text>
          <Text style={styles.resultSub}>
            {meal ?? 'Bữa ăn'} · {budget}
          </Text>

          <ResultDishPhoto uri={dishImageUri || null} dishName={dish.name} />

          <Text style={styles.dishName}>{dish.name}</Text>
          <View style={styles.chipRow}>
            <View style={styles.metaChip}>
              <Wallet size={14} color={MUTED} />
              <Text style={styles.metaChipTxt}>{priceLabel}</Text>
            </View>
            <View style={styles.metaChip}>
              <Clock3 size={14} color={MUTED} />
              <Text style={styles.metaChipTxt}>{timeLabel}</Text>
            </View>
            <View style={styles.metaChip}>
              <Utensils size={14} color={MUTED} />
              <Text style={styles.metaChipTxt}>{meal ?? 'Bữa'}</Text>
            </View>
          </View>

          {budgetRelaxed ? (
            <Text style={styles.budgetWarn}>Mogu đã nới ngân sách để tìm món</Text>
          ) : null}

          <View style={styles.whyCard}>
            <View style={styles.whyTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.whyTitle}>Vì sao món này?</Text>
                <Text style={styles.whyBody}>{reason}</Text>
              </View>
              <Image source={MASCOT} style={styles.whyMascot} resizeMode="contain" />
            </View>
            <Pressable style={styles.detailLink} onPress={() => setShowDetail(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLinkTitle}>Xem chi tiết</Text>
                <Text style={styles.detailLinkSub}>
                  Nguyên liệu, dinh dưỡng và toàn bộ lý do đề xuất.
                </Text>
              </View>
              <ChevronRight size={18} color={MUTED} />
            </Pressable>
            <Text style={styles.priceNote}>ℹ️  Giá món ăn có thể thay đổi tùy quán</Text>
          </View>
        </ScrollView>

        <View style={styles.resultFooter}>
          <Pressable
            style={styles.againBtn}
            onPress={() => {
              if (ba006Result?.randomizationId) {
                recordRecommendationEvent(ba006Result.randomizationId, 'RETRY').catch(
                  () => undefined,
                );
              }
              void runRandom('again');
            }}
            disabled={loading}
          >
            <RotateCcw size={18} color={INK} />
            <Text style={styles.againTxt}>Đổi món</Text>
          </Pressable>
          <Pressable
            style={styles.chooseBtn}
            onPress={() => {
              if (ba006Result?.randomizationId) {
                selectRandomization(ba006Result.randomizationId).catch(() => undefined);
              }
              onClose();
            }}
            disabled={loading}
          >
            <Text style={styles.chooseTxt}>Chọn món này</Text>
          </Pressable>
        </View>

        {showOverlay && loading ? (
          <LoadingOverlay meal={meal} budget={budget} onCancel={cancelRequest} />
        ) : null}
      </SafeAreaView>
    );
  }

  const errorBanner = fetchError ?? noCandidateMessage;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <Image source={BRAND} style={styles.brand} resizeMode="contain" />
        <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
          <X size={22} color={INK} />
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
            <Text style={styles.setupSub}>Chọn nhanh, Mogu lo phần còn lại.</Text>
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
                    <View style={styles.mealCheck}>
                      <Check size={11} color={INK} strokeWidth={3} />
                    </View>
                  ) : (
                    <Icon size={20} color={MUTED} strokeWidth={1.8} />
                  )}
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
                    <View style={styles.mealCheck}>
                      <Check size={11} color={INK} strokeWidth={3} />
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
                  void runRandom('fresh');
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
          onPress={() => void runRandom('fresh')}
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
        <LoadingOverlay meal={meal} budget={budget} onCancel={cancelRequest} />
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

function LoadingOverlay({
  meal,
  budget,
  onCancel,
}: {
  meal: MealKey | null;
  budget: BudgetKey;
  onCancel: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Image source={LOADING_MASCOT} style={styles.overlayMascot} resizeMode="contain" />
        <Text style={styles.overlayTitle}>Mogu đang chọn món…</Text>
        <Text style={styles.overlaySub}>
          {meal ?? 'Bữa'} · {budget}
        </Text>
        <ActivityIndicator color={YELLOW} style={{ marginTop: 14 }} />
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelTxt}>Huỷ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { width: 88, height: 32 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  setupScroll: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, marginBottom: 4 },
  setupTitle: { fontSize: 28, fontWeight: '900', color: INK, letterSpacing: -0.5 },
  setupSub: { fontSize: 14, color: MUTED, marginTop: 4 },
  setupMascot: { width: 72, height: 72, marginLeft: 8 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: INK },
  cardSub: { fontSize: 12.5, color: MUTED, marginTop: 2, marginBottom: 12 },

  mealGrid: { flexDirection: 'row', gap: 8 },
  mealChip: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  mealChipOn: { backgroundColor: YELLOW, borderColor: YELLOW },
  mealChipTxt: { fontSize: 13, fontWeight: '600', color: MUTED, textAlign: 'center' },
  mealChipTxtOn: { color: INK, fontWeight: '800' },
  mealCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  budgetRow: { flexDirection: 'row', gap: 8 },
  budgetChip: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 4,
  },
  budgetChipOn: { backgroundColor: YELLOW, borderColor: YELLOW },
  budgetChipTxt: { fontSize: 12.5, fontWeight: '600', color: MUTED, textAlign: 'center' },
  budgetChipTxtOn: { color: INK, fontWeight: '800' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: INK },
  profileLink: { fontSize: 14, fontWeight: '700', color: '#C08000' },

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
  ctaTxt: { fontSize: 16, fontWeight: '800', color: INK },
  ctaHint: { fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 8 },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(247,242,232,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  overlayCard: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  overlayMascot: { width: 96, height: 96, marginBottom: 8 },
  overlayTitle: { fontSize: 18, fontWeight: '800', color: INK },
  overlaySub: { fontSize: 13, color: MUTED, marginTop: 4 },
  cancelBtn: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 20 },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: MUTED },

  resultScroll: { paddingHorizontal: 16, paddingBottom: 110 },
  resultTitle: { fontSize: 24, fontWeight: '900', color: INK, marginTop: 4 },
  resultSub: { fontSize: 14, color: MUTED, marginTop: 2, marginBottom: 12 },
  photoWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFF2C9',
    height: 200,
    width: '100%',
  },
  photo: { width: '100%', height: 200 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 242, 201, 0.35)',
  },
  dishName: {
    fontSize: 26,
    fontWeight: '900',
    color: INK,
    marginTop: 12,
    letterSpacing: -0.4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3EFE6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipTxt: { fontSize: 13, fontWeight: '600', color: INK },
  budgetWarn: {
    marginTop: 8,
    fontSize: 13,
    color: '#B45309',
    fontWeight: '600',
  },
  whyCard: {
    marginTop: 14,
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 10,
  },
  whyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whyTitle: { fontSize: 15, fontWeight: '800', color: INK },
  whyBody: { fontSize: 13.5, color: '#444', lineHeight: 19, marginTop: 4 },
  whyMascot: { width: 56, height: 56 },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0E9D8',
  },
  detailLinkTitle: { fontSize: 14, fontWeight: '700', color: INK },
  detailLinkSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  priceNote: { fontSize: 12, color: MUTED },

  resultFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: CREAM,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  againBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C8C0B4',
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  againTxt: { fontSize: 15, fontWeight: '700', color: INK },
  chooseBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseTxt: { fontSize: 15, fontWeight: '800', color: INK },
});
