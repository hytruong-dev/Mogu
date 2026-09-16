import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import { AppImage } from '../components/ui/app-image';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../components/ui/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Flame,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  Navigation,
  Play,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Sun,
  UtensilsCrossed,
  Users,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { dishesApi, type Review } from '../services/api/dishes';

// ── Tokens ──────────────────────────────────────────────────────────────────
const CREAM = '#FFF9E8';
const WHITE = '#FFFFFF';
const INK = '#161616';
const MUTED = '#5F5F5F';
const YELLOW = '#FFD54F';
const YELLOW_D = '#F5B900';
const YELLOW_L = '#FFF2B8';
const BORDER = '#E9E1D2';

const MASCOT = require('../assets/images/home/mogu-serving.png');
const MASCOT_COOL = require('../assets/images/logo/mogu-mascot.png');
const BRAND = require('../assets/images/logo/mogu-wordmark-header.png');

const shadow = {
  shadowColor: '#5D490F', shadowOpacity: 0.09,
  shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 3,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ING_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 32 - 16) / 3);

// ── Types ────────────────────────────────────────────────────────────────────
export type FoodDetailPage = 'overview' | 'nutrition' | 'recipe' | 'community' | 'confirmed' | 'location' | 'result' | 'cooking';

type Explanation = {
  summary: string;
  compatibilityPercent: number;
  factors: string[];
  nutritionHighlight?: string | null;
  matchTags?: string[] | null;
  tip?: string | null;
  fallbackApplied?: string[];
} | null;

type DishIngredient = { rawText: string; ingredientName: string | null; imageUrl: string | null; quantity: number | null; unit: string | null; groupLabel: string | null; isOptional: boolean };
type DishAllergen = { id: string; name: string; code: string; level: string };
type DishNutrition = { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG: number | null; servingName: string | null };
type DishRecipeStep = { stepOrder: number; instruction: string; durationMin: number | null; imageUrl: string | null };

type Props = {
  initialPage?: FoodDetailPage;
  dishId?: string;
  dishName?: string;
  dishImage?: ImageSourcePropType;
  ratingAvg?: number;
  ratingCount?: number;
  meal?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  shortDescription?: string | null;
  originText?: string | null;
  nutrition?: DishNutrition | null;
  ingredients?: DishIngredient[];
  allergens?: DishAllergen[];
  recipeSteps?: DishRecipeStep[];
  difficulty?: string | null;
  mealTypes?: Array<{ code: string; name: string }>;
  explanation?: Explanation;
  onClose: () => void;
  /** Quay lại bước random / random lại (khác với đóng về Home) */
  onRandomAgain?: () => void;
  onFinish?: () => void;
};

// ── Root ─────────────────────────────────────────────────────────────────────
export function FoodDetailFlowScreen({
  initialPage = 'overview',
  dishId,
  dishName = 'Món ăn',
  dishImage,
  ratingAvg,
  ratingCount,
  meal = 'Bữa ăn',
  priceMin,
  priceMax,
  prepMinutes,
  cookMinutes,
  shortDescription,
  originText,
  nutrition,
  ingredients = [],
  allergens = [],
  recipeSteps = [],
  difficulty,
  mealTypes = [],
  explanation,
  onClose,
  onRandomAgain,
  onFinish,
}: Props) {
  const [page, setPage] = useState<FoodDetailPage>(initialPage);
  const history = useRef<FoodDetailPage[]>([]);
  const image: ImageSourcePropType | undefined = dishImage;

  const go = (next: FoodDetailPage) => { history.current.push(page); setPage(next); };
  const back = () => {
    const prev = history.current.pop();
    if (prev) setPage(prev);
    else onClose();
  };

  // Shared dish info — chỉ hiển thị khi có dữ liệu thật
  const totalPrepMin = (prepMinutes ?? 0) + (cookMinutes ?? 0);
  const priceLabel =
    priceMin != null && priceMax != null
      ? `${Math.round(priceMin / 1000)}K–${Math.round(priceMax / 1000)}K`
      : priceMax != null
        ? `~${Math.round(priceMax / 1000)}K`
        : priceMin != null
          ? `~${Math.round(priceMin / 1000)}K`
          : '—';
  const timeLabel = totalPrepMin > 0 ? `${totalPrepMin} phút` : '—';
  const compat = explanation?.compatibilityPercent;

  if (page === 'confirmed') {
    return (
      <ConfirmedPage
        image={image} dishName={dishName} meal={meal}
        onClose={onFinish ?? onClose}
        onChange={back}
      />
    );
  }
  if (page === 'nutrition') {
    return (
      <NutritionPage
        image={image} dishName={dishName}
        priceLabel={priceLabel} timeLabel={timeLabel}
        nutrition={nutrition}
        ingredients={ingredients}
        recipeSteps={recipeSteps}
        difficulty={difficulty}
        prepMinutes={prepMinutes}
        cookMinutes={cookMinutes}
        onBack={back}
        onLocation={() => go('location')}
        onChoose={() => go('confirmed')}
        onCook={() => go('cooking')}
      />
    );
  }
  if (page === 'cooking') {
    return (
      <CookingModePage
        image={image} dishName={dishName}
        ingredients={ingredients}
        recipeSteps={recipeSteps}
        onBack={back}
        onFinish={onFinish ?? onClose}
      />
    );
  }
  if (page === 'location') {
    return (
      <LocationPage
        image={image} dishName={dishName}
        onBack={back}
        onChoose={() => go('confirmed')}
      />
    );
  }
  // màn 4 → result (initial sau random) rồi overview
  if (page === 'result') {
    return (
      <ResultPage
        image={image} dishName={dishName} meal={meal}
        priceLabel={priceLabel} timeLabel={timeLabel}
        kcal={nutrition?.calories ?? null}
        explanation={explanation}
        compat={compat}
        onBack={onClose}
        onAgain={onRandomAgain ?? onClose}
        onChoose={() => go('overview')}
      />
    );
  }
  // 'overview' (default — màn 1)
  return (
    <OverviewPage
      image={image} dishId={dishId} dishName={dishName} meal={meal}
      ratingAvg={ratingAvg} ratingCount={ratingCount}
      priceLabel={priceLabel} timeLabel={timeLabel}
      shortDescription={shortDescription}
      originText={originText}
      nutrition={nutrition}
      ingredients={ingredients}
      allergens={allergens}
      explanation={explanation} compat={compat}
      onBack={back}
      onNutrition={() => go('nutrition')}
      onLocation={() => go('location')}
      onChoose={() => go('confirmed')}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCREEN 4 — ResultPage  "Món hôm nay của bạn là..."
// ══════════════════════════════════════════════════════════════════════════════
function ResultPage({
  image, dishName, meal, priceLabel, timeLabel, kcal, explanation, compat,
  onBack, onAgain, onChoose,
}: {
  image?: ImageSourcePropType;
  dishName: string; meal: string; priceLabel: string; timeLabel: string;
  kcal: number | null;
  explanation?: Explanation; compat?: number | null;
  onBack(): void; onAgain(): void; onChoose(): void;
}) {
  const [saved, setSaved] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const imgScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, speed: 13, bounciness: 6, useNativeDriver: true }),
      Animated.spring(imgScale, { toValue: 1, speed: 11, bounciness: 5, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp, imgScale]);

  // Lấy factors trực tiếp từ explanation (không cần parse lại)
  const factors = explanation?.factors ?? [];

  const kcalDisplay = kcal != null ? `${Math.round(kcal)} kcal` : '—';

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Image source={BRAND} style={s.brand} resizeMode="contain" />
        <View style={s.row}>
          <RoundBtn onPress={() => undefined}><Share2 size={20} color={INK} /></RoundBtn>
          <RoundBtn onPress={() => setSaved(v => !v)}>
            <Bookmark size={20} color={saved ? YELLOW_D : INK} fill={saved ? YELLOW : 'transparent'} />
          </RoundBtn>
        </View>
      </View>

      {/* ── Progress 3 bars ── */}
      <View style={s.progressRow}>
        <View style={s.progressBar} />
        <View style={s.progressBar} />
        <View style={[s.progressBar, s.progressBarActive]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ── Mascot + tên ── */}
        <Animated.View style={[s.resultIntro, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          <Image source={MASCOT_COOL} style={s.resultMascot} resizeMode="contain" />
          <Text style={s.resultLead}>{'Món hôm nay của bạn là'}</Text>
          <Text style={s.resultDishName}>{dishName + '!'}</Text>
        </Animated.View>

        {/* ── Ảnh món ── */}
        <Animated.View style={[s.resultPhotoWrap, { transform: [{ scale: imgScale }] }]}>
          <DishHeroImage image={image} style={s.resultPhoto} />
          {compat != null && (
            <View style={s.resultMatchBadge}>
              <Sparkles size={13} color={INK} />
              <Text style={s.resultMatchTxt}>
                {'Phù hợp '}
                <Text style={{ fontWeight: '900' }}>{compat + '%'}</Text>
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── 4 stat chips giống design: icon top, value to, label nhỏ ── */}
        <Animated.View style={[s.resultStatCard, { opacity: fadeIn }]}>
          <Res4Stat icon={<MapPin size={20} color={MUTED} />} top={'Khoảng'} bot={priceLabel} />
          <Res4Stat icon={<Flame size={20} color="#E5A800" />} top={'Năng lượng'} bot={kcalDisplay} />
          <Res4Stat icon={<Clock3 size={20} color={MUTED} />} top={'Thời gian'} bot={timeLabel} />
          <Res4Stat icon={<UtensilsCrossed size={20} color={MUTED} />} top={'Bữa ăn'} bot={meal} />
        </Animated.View>

        {/* ── Card "Vì sao Mogu chọn?" ── */}
        <Animated.View style={[s.resultWhyCard, { opacity: fadeIn }]}>
          {/* Tiêu đề */}
          <View style={s.resultWhyHeader}>
            <View style={s.resultWhyIconWrap}>
              <Sparkles size={16} color={INK} />
    </View>
            <Text style={s.resultWhyTitle}>{'Vì sao Mogu chọn món này?'}</Text>
          </View>

          {/* Summary từ AI — cụ thể, không chung chung */}
          <Text style={s.resultWhyBody}>
            {explanation?.summary ?? 'Phù hợp khẩu vị, giàu dinh dưỡng và dễ tìm quanh bạn.'}
          </Text>

          {/* Nutrition highlight nếu có */}
          {!!explanation?.nutritionHighlight && (
            <View style={s.nutHighlightRow}>
              <Flame size={14} color="#E5A800" />
              <Text style={s.nutHighlightTxt}>{explanation.nutritionHighlight}</Text>
            </View>
          )}

          {/* Factors chi tiết — dạng bullet list */}
          {factors.length > 0 && (
            <View style={s.factorsList}>
              {factors.map((f, i) => (
                <View key={i} style={s.factorListItem}>
                  <View style={s.factorBullet} />
                  <Text style={s.factorListTxt}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Match tags — chips nhỏ */}
          {(explanation?.matchTags?.length ?? 0) > 0 && (
            <View style={s.resultFactorRow}>
              {(explanation!.matchTags!).map((tag, i) => <FactorChip key={i} label={tag} />)}
            </View>
          )}

          {/* Tip nếu có */}
          {!!explanation?.tip && (
            <View style={s.tipBox}>
              <Text style={s.tipLabel}>{'💡 Mẹo'}</Text>
              <Text style={s.tipTxt}>{explanation.tip}</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Footer: Chọn món + Random lại (flex row) ── */}
      <View style={s.resultFooter}>
        <Pressable style={s.againBtn} onPress={onAgain}>
          <RotateCcw size={18} color={INK} />
          <Text style={s.againTxt}>{'Random lại'}</Text>
        </Pressable>
        <View style={s.chooseBtnWrap}>
          <PrimaryBtn label={'Chọn món này'} icon={<Check size={18} color={INK} />} onPress={onChoose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Stat chip 4 ô — icon, label nhỏ, value to */
function Res4Stat({ icon, top, bot }: { icon: ReactNode; top: string; bot: string }) {
  return (
    <View style={s.res4StatItem}>
      {icon}
      <Text style={s.res4StatTop}>{top}</Text>
      <Text style={s.res4StatBot}>{bot}</Text>
    </View>
  );
}

function DishHeroImage({
  image,
  style,
  resizeMode = 'cover',
}: {
  image?: ImageSourcePropType;
  style?: object;
  resizeMode?: 'cover' | 'contain';
}) {
  return (
    <AppImage
      source={image}
      style={style as any}
      resizeMode={resizeMode}
      contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
      cachePolicy="memory-disk"
      transition={250}
      showLoader
    />
  );
}

function FactorChip({ label }: { label: string }) {
  return (
    <View style={s.factorChip}>
      <Text style={s.factorChipTxt}>{label}</Text>
          </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCREEN 1 — OverviewPage  "Chi tiết món ăn"
// ══════════════════════════════════════════════════════════════════════════════
function OverviewPage({
  image, dishId, dishName, meal, ratingAvg, ratingCount,
  priceLabel, timeLabel,
  shortDescription, originText, nutrition, ingredients, allergens,
  explanation, compat,
  onBack, onNutrition, onLocation, onChoose,
}: {
  image?: ImageSourcePropType; dishId?: string; dishName: string; meal: string;
  ratingAvg?: number; ratingCount?: number; priceLabel: string; timeLabel: string;
  shortDescription?: string | null; originText?: string | null;
  nutrition?: DishNutrition | null; ingredients?: DishIngredient[]; allergens?: DishAllergen[];
  explanation?: Explanation; compat?: number | null;
  onBack(): void; onNutrition(): void; onLocation(): void; onChoose(): void;
}) {
  const [saved, setSaved] = useState(false);
  const displayRating = ratingAvg != null && ratingAvg > 0 ? ratingAvg : null;
  const displayCount = ratingCount ?? 0;

  // Data thuc tu API — không fallback mock
  const desc = shortDescription ?? null;
  const origin = originText ?? null;
  const kcalNum = nutrition?.calories ?? null;
  const kcalStr = kcalNum != null ? `${Math.round(Number(kcalNum))} kcal` : null;
  const displayIngredients = (ingredients ?? []).slice(0, 8);
  const displayAllergens = allergens ?? [];
  const hasAllergens = displayAllergens.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.ovHeader}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Text style={s.ovHeaderTitle}>{'Chi tiết món ăn'}</Text>
        <View style={s.row}>
          <RoundBtn onPress={() => setSaved(v => !v)}>
            <Bookmark size={20} color={saved ? YELLOW_D : INK} fill={saved ? YELLOW : 'transparent'} />
          </RoundBtn>
          <RoundBtn onPress={() => undefined}><Share2 size={20} color={INK} /></RoundBtn>
          </View>
          </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
      >
        {/* Hero full-width */}
        <View style={s.heroWrap}>
          <DishHeroImage image={image} style={s.heroImg} />
          {compat != null && (
            <View style={s.ovMatchBadge}>
              <Sparkles size={12} color={INK} />
              <Text style={s.matchText}>{`Phù hợp ${compat}%`}</Text>
            </View>
          )}
          {origin ? (
            <View style={s.regionBadge}>
              <MapPin size={13} color={MUTED} />
              <Text style={s.regionText}>{origin}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.pad, s.ovBody]}>
          <View>
            <Text style={s.dishTitle}>{dishName}</Text>

            {/* Rating */}
            <View style={[s.row, { gap: 5, marginTop: 4 }]}>
              {displayRating != null ? (
                <>
                  <Star size={14} color={YELLOW_D} fill={YELLOW} />
                  <Text style={s.ratingNum}>{displayRating.toFixed(1)}</Text>
                  <Text style={s.ratingCount}>{'· ' + displayCount.toLocaleString() + ' đánh giá'}</Text>
                </>
              ) : (
                <Text style={s.ratingCount}>{'Chưa có đánh giá'}</Text>
              )}
            </View>

            {desc ? <Text style={s.desc} numberOfLines={2}>{desc}</Text> : null}

            {/* 3 stat chips */}
            <View style={s.ov3Stats}>
              <OvStat icon={<Sun size={15} color={MUTED} />} label={meal} />
              <View style={s.ovStatDivider} />
              <OvStat icon={<View style={s.ovDiamond} />} label={priceLabel} />
              <View style={s.ovStatDivider} />
              <OvStat icon={<Clock3 size={15} color={MUTED} />} label={timeLabel} />
            </View>

            {/* Thong tin nhanh */}
            <View style={s.quickInfoCard}>
              <Text style={s.quickInfoTitle}>{'Thông tin nhanh'}</Text>
              {origin ? (
                <View style={s.qiRow}>
                  <MapPin size={15} color={MUTED} />
                  <Text style={s.qiLabel}>{'Nguồn gốc'}</Text>
                  <Text style={s.qiDot}>{'·'}</Text>
                  <Text style={s.qiValue}>{origin}</Text>
                </View>
              ) : null}
              {kcalStr ? (
                <View style={s.qiRow}>
                  <Flame size={15} color={MUTED} />
                  <Text style={s.qiLabel}>{kcalStr}</Text>
                </View>
              ) : null}
              <View style={s.allergyBox}>
                <AlertTriangle size={16} color="#E5A800" />
                <View style={{ flex: 1 }}>
                  <Text style={s.allergyTitle}>{'Lưu ý dị ứng'}</Text>
                  <Text style={s.allergyBody}>{hasAllergens ? ('Có thể chứa: ' + displayAllergens.map((a: any) => a.name).filter(Boolean).join(', ')) : 'Chưa có thông tin dị ứng'}</Text>
                </View>
                <Image source={MASCOT_COOL} style={s.allergyMascot} resizeMode="contain" />
              </View>
            </View>

            {/* Thanh phan chinh */}
            <View style={s.ingredientSection}>
              <Text style={s.sectionLabel}>{'Thành phần chính'}</Text>
              {displayIngredients.length === 0 ? (
                <Text style={[s.desc, { marginTop: 6 }]}>Chưa có dữ liệu nguyên liệu</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {displayIngredients.map((ing: any, idx: number) => {
                    const ingName = (ing.ingredientName ?? ing.rawText ?? '')
                      .replace(/\s*\d.*$/, '').replace(/\(.*\)/, '').trim() || 'Nguyên liệu';
                    return (
                      <View key={idx} style={s.ingCard}>
                        <View style={s.ingCircle}>
                          {ing.imageUrl ? (
                            <Image
                              source={{ uri: ing.imageUrl }}
                              style={{ width: 44, height: 44, borderRadius: 22 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Leaf size={16} color="#7CB342" strokeWidth={1.6} />
                          )}
                        </View>
                        <Text style={s.ingName} numberOfLines={1}>{ingName}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>

          {/* NavCards — đẩy xuống đáy màn */}
          <View style={{ gap: 8, marginTop: 12 }}>
            <NavCard
              icon={<View style={s.navIco}><BarChart3 size={18} color={INK} /></View>}
              title={'Dinh dưỡng & cách nấu'}
              sub={kcalStr ? `${kcalStr} · Xem cách chế biến` : 'Xem cách chế biến'}
              onPress={onNutrition}
            />
            <NavCard
              icon={<View style={s.navIco}><MapPin size={18} color={INK} /></View>}
              title={'Địa điểm gần bạn'}
              sub={'Xem gợi ý quanh bạn'}
              onPress={onLocation}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OvStat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={s.ovStat}>
      {icon}
      <Text style={s.ovStatLabel}>{label}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCREEN 2 — NutritionPage "Dinh dưỡng & cách nấu"
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
//  Helper: parse & scale ingredient for display
// ─────────────────────────────────────────────────────────────────────────────
function parseIngredientDisplay(ing: DishIngredient, servings: number) {
  const baseServings = 4;
  const factor = servings / baseServings;

  const raw = (ing.rawText || ing.ingredientName || '').trim();

  // Extract note inside parentheses: e.g. (đã cắt miếng vừa ăn, ngâm muối...)
  let note = '';
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    note = parenMatch[1].trim();
  }

  // Clean name
  let name = (ing.ingredientName || raw).replace(/\(.*?\)/g, '').trim();
  // Strip leading numbers or quantity units if name was rawText
  name = name.replace(/^[\d.,\/\s]+(g|kg|ml|l|muỗng canh|muỗng cà phê|thìa|trái|quả|củ|tép|lá|gói|bát|chén|lát|khoanh)?\s*/i, '').trim();
  if (!name) name = ing.ingredientName || raw || 'Nguyên liệu';

  // Quantity & Unit
  let qtyDisplay = '';
  if (ing.quantity != null && Number.isFinite(Number(ing.quantity))) {
    const scaled = Math.round(Number(ing.quantity) * factor * 10) / 10;
    const unitStr = ing.unit ? (ing.unit.length <= 2 ? ing.unit : ' ' + ing.unit) : '';
    qtyDisplay = `${scaled}${unitStr}`;
  } else {
    const match = raw.match(/^([\d.,]+)\s*(g|kg|ml|l|muỗng canh|muỗng cà phê|thìa|trái|quả|củ|tép|lá|gói|bát|chén|lát|khoanh)?/i);
    if (match) {
      const parsedNum = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(parsedNum)) {
        const scaled = Math.round(parsedNum * factor * 10) / 10;
        const unit = match[2] ? (match[2].length <= 2 ? match[2] : ' ' + match[2]) : '';
        qtyDisplay = `${scaled}${unit}`;
      }
    }
  }

  return { name, note, qtyDisplay };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN 2 - NutritionPage  "Công thức [món]"  (Recipe Overview)
// ─────────────────────────────────────────────────────────────────────────────
function NutritionPage({
  image, dishName, priceLabel, timeLabel,
  nutrition, ingredients = [], recipeSteps = [], difficulty,
  prepMinutes, cookMinutes,
  onBack, onLocation, onChoose, onCook,
}: {
  image?: ImageSourcePropType; dishName: string; priceLabel: string; timeLabel: string;
  nutrition?: DishNutrition | null;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  difficulty?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  onBack(): void; onLocation(): void; onChoose(): void; onCook(): void;
}) {
  const [servings, setServings] = useState(4);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);

  const kcal = nutrition?.calories ? Math.round(Number(nutrition.calories)) : null;
  const protein = nutrition?.proteinG ? Math.round(Number(nutrition.proteinG)) : null;
  const carbs = nutrition?.carbsG ? Math.round(Number(nutrition.carbsG)) : null;
  const fat = nutrition?.fatG ? Math.round(Number(nutrition.fatG)) : null;
  const fiber = nutrition?.fiberG ? Math.round(Number(nutrition.fiberG)) : null;
  const totalMin = (prepMinutes ?? 0) + (cookMinutes ?? 0);
  const timeStr = totalMin > 0
    ? (totalMin >= 60 ? Math.floor(totalMin / 60) + 'h' + (totalMin % 60 > 0 ? ' ' + (totalMin % 60) + ' phút' : '') : totalMin + ' phút')
    : '90 phút';
  const DIFF_LABEL: Record<string, string> = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
  const diffLabel = difficulty ? (DIFF_LABEL[difficulty] ?? difficulty) : 'Trung bình';

  const steps = recipeSteps.map((rs) => {
    const lines = rs.instruction.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const rawTitle = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*/g, '') ?? ('Bước ' + rs.stepOrder);
    // Remove leading "X. " numbering from AI title
    const title = rawTitle.replace(/^\d+\.\s*/, '');
    const body = lines.slice(1).join(' ').replace(/\*\*/g, '').replace(/💡\s*Mẹo[^:]*:\s*/gi, '').trim();
    // Extract tip: look for 💡 or "Mẹo:" pattern
    const tipMatch = rs.instruction.match(/💡[^:]*:\s*([^\n]+)/);
    const tip = tipMatch ? tipMatch[1].trim() : null;
    return { n: rs.stepOrder, title, body, tip, durationMin: rs.durationMin, imageUrl: rs.imageUrl };
  });

  const toggleStep = (n: number) =>
    setCheckedSteps((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]);

  const toggleIngredient = (idx: number) =>
    setCheckedIngredients((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]);

  const completedCount = checkedSteps.length;
  const totalSteps = steps.length;

  const EMOJIS = ['🥩', '🌿', '🍜', '🧅', '🫙', '🌶️', '🥬', '🧄', '🍋', '🫒'];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.ovHeader}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Text style={s.ovHeaderTitle}>{'Công thức ' + dishName}</Text>
        <RoundBtn onPress={() => undefined}><Bookmark size={20} color={INK} /></RoundBtn>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>

        {/* ── Dish Hero Card ─────────────────────────────────────── */}
        <View style={s.recHeroCard}>
          <DishHeroImage image={image} style={s.recHeroImg} />
          <View style={s.recHeroInfo}>
            <Text style={s.recHeroName} numberOfLines={2}>{dishName}</Text>
            <View style={s.recHeroBadgeRow}>
              <View style={s.recHeroBadge}>
                <Users size={12} color="#666" />
                <Text style={s.recHeroBadgeTxt}>{servings} khẩu phần</Text>
              </View>
              <View style={s.recHeroBadge}>
                <Clock3 size={12} color="#666" />
                <Text style={s.recHeroBadgeTxt}>{timeStr}</Text>
              </View>
              <View style={s.recHeroBadge}>
                <BarChart3 size={12} color="#666" />
                <Text style={s.recHeroBadgeTxt}>{diffLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Dinh dưỡng ─────────────────────────────────────────── */}
        <View style={s.pad}>
          <Text style={s.sectionLabel}>Dinh dưỡng tham khảo</Text>
          <View style={s.nutCard}>
            <View style={s.nutKcalRow}>
              <View style={s.nutKcalBox}>
                <Text style={s.nutKcalVal}>{kcal ?? '—'}</Text>
                <Text style={s.nutKcalLbl}>kcal / phần</Text>
              </View>
              <View style={s.nutDivider} />
              <View style={s.nutMacroGrid}>
                <NutMacro label="Protein" value={protein != null ? protein + 'g' : '—'} color="#E06B6B" />
                <NutMacro label="Tinh bột" value={carbs != null ? carbs + 'g' : '—'} color="#E5A800" />
                <NutMacro label="Chất béo" value={fat != null ? fat + 'g' : '—'} color="#F07A35" />
                <NutMacro label="Chất xơ" value={fiber != null ? fiber + 'g' : '—'} color="#4CAF50" />
              </View>
            </View>
            <View style={s.nutDisclaimer}>
              <Text style={s.nutDisclaimerTxt}>ⓘ Giá trị ước tính theo 1 khẩu phần tiêu chuẩn.</Text>
            </View>
          </View>

          {/* ── Nguyên liệu ─────────────────────────────────────── */}
          <View style={[s.row, { justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }]}>
            <View style={[s.row, { gap: 6 }]}>
              <Text style={s.sectionLabel}>Nguyên liệu</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{ingredients.length} loại</Text>
              </View>
            </View>
            <View style={s.servingCtrl}>
              <Pressable style={s.servingBtn} onPress={() => setServings(Math.max(1, servings - 1))}>
                <Text style={s.servingBtnTxt}>−</Text>
              </Pressable>
              <Text style={s.servingCount}>{servings} người</Text>
              <Pressable style={s.servingBtn} onPress={() => setServings(servings + 1)}>
                <Text style={s.servingBtnTxt}>+</Text>
              </Pressable>
            </View>
          </View>

          {ingredients.length === 0 ? (
            <View style={s.ingEmptyWrap}>
              <Text style={[s.desc, { padding: 14 }]}>Chưa có dữ liệu nguyên liệu</Text>
            </View>
          ) : (
            <View style={s.ingGridWrap}>
              {ingredients.map((ing: DishIngredient, idx: number) => {
                const { name, qtyDisplay } = parseIngredientDisplay(ing, servings);
                const isChecked = checkedIngredients.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    style={[
                      s.ingGridCard,
                      { width: ING_CARD_WIDTH },
                      isChecked && s.ingGridCardChecked,
                    ]}
                    onPress={() => toggleIngredient(idx)}
                  >
                    {/* [Ảnh] */}
                    <View style={s.ingGridThumb}>
                      {ing.imageUrl ? (
                        <AppImage
                          uri={ing.imageUrl}
                          style={s.ingGridThumbImg}
                          contentFit="cover"
                          showLoader={false}
                          fallbackIcon={<Text style={s.ingGridEmoji}>{EMOJIS[idx % EMOJIS.length]}</Text>}
                        />
                      ) : (
                        <Text style={s.ingGridEmoji}>{EMOJIS[idx % EMOJIS.length]}</Text>
                      )}
                    </View>

                    {/* [Tên] */}
                    <Text
                      style={[s.ingGridName, isChecked && s.ingGridNameDone]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>

                    {/* [Số lượng] */}
                    {!!qtyDisplay && (
                      <View style={[s.ingGridQtyBadge, isChecked && s.ingGridQtyBadgeChecked]}>
                        <Text style={[s.ingGridQtyTxt, isChecked && s.ingGridQtyTxtChecked]}>
                          {qtyDisplay}
                        </Text>
                      </View>
                    )}

                    {isChecked && (
                      <View style={s.ingGridCheckBadge}>
                        <Check size={8} color="#fff" strokeWidth={3.5} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Cách chế biến ───────────────────────────────────── */}
          <View style={[s.row, { justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }]}>
            <Text style={s.sectionLabel}>Cách chế biến</Text>
            <View style={s.stepProgressBadge}>
              <Text style={s.stepProgressTxt}>{completedCount}/{totalSteps} bước</Text>
            </View>
          </View>

          {steps.length > 0 ? (
            <View style={s.recStepContainer}>
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                const done = checkedSteps.includes(step.n);
                return (
                  <Pressable key={step.n} style={s.recStep} onPress={() => toggleStep(step.n)}>
                    {/* Timeline line */}
                    <View style={s.recStepLeft}>
                      <View style={[s.recStepDot, done && s.recStepDotDone]}>
                        {done ? (
                          <Check size={12} color="#fff" strokeWidth={3} />
                        ) : (
                          <Text style={s.recStepN}>{step.n}</Text>
                        )}
                      </View>
                      {!isLast && <View style={s.recStepLine} />}
                    </View>
                    <View style={[s.recStepBody, !isLast && { paddingBottom: 14 }]}>
                      <View style={s.recStepHeader}>
                        <Text
                          style={[s.recStepTitle, done && s.recStepTitleDone]}
                          numberOfLines={2}
                        >
                          {step.title}
                        </Text>
                        {step.durationMin != null && (
                          <View style={s.recStepTimeBadge}>
                            <Clock3 size={11} color="#92400E" />
                            <Text style={s.recStepTime}>{step.durationMin} phút</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>Chưa có hướng dẫn chế biến.</Text>
          )}

          {/* ── Video hướng dẫn ─────────────────────────────────── */}
          <Text style={[s.sectionLabel, { marginTop: 22 }]}>Video hướng dẫn</Text>
          <Pressable style={[s.videoCard, { marginTop: 10, height: 140 }]}>
            <DishHeroImage image={image} style={s.videoImg} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.28)' }]} />
            <View style={s.playBtn}>
              <Play size={22} color="#fff" fill="#fff" />
            </View>
            <View style={s.videoMascotWrap}>
              <Image source={MASCOT} style={s.videoMascot} resizeMode="contain" />
            </View>
            <Text style={s.videoTitle}>{'Nấu ' + dishName + ' tại nhà'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer – Bắt đầu nấu ăn (giống nút hình 2) */}
      <View style={s.recipeFooter}>
        <TouchableOpacity
          activeOpacity={0.87}
          style={s.startCookBtn}
          onPress={onCook}
        >
          <Text style={s.startCookTxt}>Bắt đầu nấu ăn</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COOKING MODE PAGE  "Đang nấu"
// ─────────────────────────────────────────────────────────────────────────────
function CookingModePage({
  image, dishName, ingredients = [], recipeSteps = [],
  onBack, onFinish,
}: {
  image?: ImageSourcePropType; dishName: string;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  onBack(): void; onFinish(): void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [showStepList, setShowStepList] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = recipeSteps.map((rs) => {
    const lines = rs.instruction.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const rawTitle = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*/g, '') ?? ('Bước ' + rs.stepOrder);
    const title = rawTitle.replace(/^\d+\.\s*/, '');
    const body = lines.slice(1).join('\n').replace(/\*\*/g, '').trim();
    const tipMatch = rs.instruction.match(/💡[^:]*:\s*([^\n]+)/);
    const tip = tipMatch ? tipMatch[1].trim() : null;
    return { n: rs.stepOrder, title, body, tip, durationMin: rs.durationMin, imageUrl: rs.imageUrl };
  });

  const fallbackSteps = steps;

  const currentStep = fallbackSteps[stepIdx] ?? fallbackSteps[0];
  const totalSteps = fallbackSteps.length;
  const progress = totalSteps > 0 ? (stepIdx + 1) / totalSteps : 0;

  if (totalSteps === 0) {
  return (
      <SafeAreaView style={s.safe}>
        <View style={s.ovHeader}>
          <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
          <Text style={s.ovHeaderTitle}>Nấu {dishName}</Text>
          <View style={{ width: 40 }} />
          </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: MUTED, textAlign: 'center' }}>Chưa có bước nấu cho món này</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Timer
  useEffect(() => {
    if (currentStep?.durationMin && currentStep.durationMin > 0) {
      setTimerSec(currentStep.durationMin * 60);
    } else {
      setTimerSec(0);
    }
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [stepIdx]);

  useEffect(() => {
    if (timerRunning && timerSec > 0) {
      timerRef.current = setInterval(() => setTimerSec((s) => Math.max(0, s - 1)), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerSec]);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s2 = (sec % 60).toString().padStart(2, '0');
    return h + ':' + m + ':' + s2;
  };

  const goNext = () => {
    if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
    else onFinish();
  };

  const stepImage: ImageSourcePropType | undefined = currentStep.imageUrl
    ? { uri: currentStep.imageUrl }
    : image;

  const EMOJIS = ['🥩', '🌿', '🍜', '🧅', '🫙', '🌶️', '🥬', '🧄', '🍋', '🫒'];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.ovHeader}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Text style={s.ovHeaderTitle}>Đang nấu</Text>
        <RoundBtn onPress={onBack}>
          <Text style={{ fontSize: 18, color: INK }}>✕</Text>
        </RoundBtn>
      </View>

      {/* Progress */}
      <View style={s.cookProgress}>
        <Text style={s.cookProgressLabel}>Bước {stepIdx + 1}/{totalSteps}</Text>
        <Progress
          value={progress * 100}
          className="h-1 bg-border"
          indicatorClassName="bg-primary"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 85 }}>

        {/* Step image/video */}
        <View style={s.cookImgWrap}>
          <DishHeroImage image={stepImage} style={s.cookImg} />
          {/* Duration badge */}
          {currentStep.durationMin && (
            <View style={s.cookDurBadge}>
              <Text style={s.cookDurTxt}>
                {currentStep.durationMin >= 60
                  ? Math.floor(currentStep.durationMin / 60) + '–' + (Math.floor(currentStep.durationMin / 60) + 1) + ' giờ'
                  : currentStep.durationMin + ' phút'}
              </Text>
            </View>
          )}
          {/* Play overlay */}
          <View style={s.cookPlayBtn}>
            <Play size={20} color="#fff" fill="#fff" />
          </View>
        </View>

        <View style={s.pad}>
          {/* Step title + body */}
          <View style={[s.row, { gap: 10, marginTop: 10, alignItems: 'center' }]}>
            <View style={s.cookStepBadge}>
              <Text style={s.cookStepBadgeTxt}>{currentStep.n}</Text>
            </View>
            <Text style={s.cookStepTitle}>{currentStep.title}</Text>
          </View>
          {!!currentStep.body && (
            <Text style={s.cookStepBody}>{currentStep.body}</Text>
          )}

          {/* Ingredients for this step */}
          {ingredients.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 10, fontSize: 13 }]}>Nguyên liệu cho bước này</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {ingredients.slice(0, 8).map((ing, idx) => {
                  const ingName = (ing.ingredientName ?? ing.rawText)
                    .replace(/\s*\d.*$/, '').replace(/\(.*?\)/g, '').trim()
                    .split(' ').slice(0, 2).join(' ');
                  return (
                    <View key={idx} style={s.cookIngCard}>
                      <View style={s.cookIngImg}>
                        {ing.imageUrl ? (
                          <AppImage
                            uri={ing.imageUrl}
                            style={{ width: 42, height: 42, borderRadius: 8 }}
                            contentFit="cover"
                            showLoader={false}
                            fallbackIcon={<Text style={{ fontSize: 20 }}>{EMOJIS[idx % EMOJIS.length]}</Text>}
                          />
                        ) : (
                          <Text style={{ fontSize: 20 }}>{EMOJIS[idx % EMOJIS.length]}</Text>
                        )}
                      </View>
                      <Text style={s.cookIngName} numberOfLines={2}>{ingName}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Timer */}
          <View style={s.cookTimerCard}>
            <View style={s.cookTimerLeft}>
              <Clock3 size={18} color={MUTED} />
              <View>
                <Text style={s.cookTimerLabel}>Hẹn giờ nấu</Text>
                <Text style={s.cookTimerVal}>{formatTimer(timerSec || ((currentStep.durationMin ?? 2) * 60))}</Text>
              </View>
            </View>
            <Pressable
              style={[s.cookTimerBtn, timerRunning && s.cookTimerBtnActive]}
              onPress={() => setTimerRunning(!timerRunning)}
            >
              <Text style={s.cookTimerBtnTxt}>{timerRunning ? 'Dừng' : 'Bắt đầu hẹn giờ'}</Text>
            </Pressable>
          </View>

          {/* Tip */}
          {!!currentStep.tip && !currentStep.body?.includes(currentStep.tip) && (
            <View style={s.cookTipBox}>
              <Text style={s.cookTipIco}>💡</Text>
              <Text style={s.cookTipTxt}>{currentStep.tip}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.cookFooter}>
        <Pressable style={s.cookStepListBtn} onPress={() => setShowStepList(true)}>
          <Text style={{ fontSize: 15, color: INK }}>☰</Text>
          <Text style={s.cookStepListTxt}>Xem các bước</Text>
        </Pressable>
        <Pressable style={s.cookNextBtn} onPress={goNext}>
          <Text style={s.cookNextTxt}>
            {stepIdx < totalSteps - 1 ? 'Hoàn thành bước ' + (stepIdx + 1) : 'Hoàn thành'}
          </Text>
          <ChevronRight size={18} color={INK} />
        </Pressable>
      </View>

      {/* Step list drawer */}
      <Drawer open={showStepList} onOpenChange={setShowStepList} snapHeight={480}>
        <DrawerHeader className="flex-row items-center justify-between px-4">
          <DrawerTitle>Các bước thực hiện</DrawerTitle>
          <DrawerClose onPress={() => setShowStepList(false)} />
        </DrawerHeader>
        <DrawerContent className="max-h-[400px] px-4 pb-6">
          <ScrollView showsVerticalScrollIndicator={false}>
            {fallbackSteps.map((st, idx) => (
              <Pressable
                key={st.n}
                style={[s.cookListItem, idx === stepIdx && s.cookListItemActive]}
                onPress={() => {
                  setStepIdx(idx);
                  setShowStepList(false);
                }}
              >
                <View
                  style={[
                    s.recStepDot,
                    idx < stepIdx && s.recStepDotDone,
                    idx === stepIdx && s.recStepDotActive,
                  ]}
                >
                  <Text
                    style={[
                      s.recStepN,
                      idx <= stepIdx && { color: idx === stepIdx ? INK : '#fff' },
                    ]}
                  >
                    {st.n}
                  </Text>
                </View>
                <View style={s.cookItemInfo}>
                  <Text
                    style={[
                      s.cookItemTitle,
                      idx === stepIdx && s.cookItemTitleActive,
                      idx < stepIdx && s.cookItemTitleDone,
                    ]}
                    numberOfLines={1}
                  >
                    {st.title}
                  </Text>
                  {st.durationMin != null && (
                    <Text style={s.cookItemTime}>{st.durationMin} phút</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </DrawerContent>
      </Drawer>
    </SafeAreaView>
  );
}

function NutMacro({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.nutMacroCell}>
      <Text style={[s.nutMacroVal, { color }]}>{value}</Text>
      <Text style={s.nutMacroLbl}>{label}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCREEN 3 — LocationPage "Địa điểm gần bạn"
// ══════════════════════════════════════════════════════════════════════════════
function LocationPage({
  image, dishName, onBack, onChoose,
}: {
  image?: ImageSourcePropType; dishName: string; onBack(): void; onChoose(): void;
}) {
  const reviews: Review[] = [];
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.ovHeader}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Text style={s.ovHeaderTitle}>Địa điểm gần bạn</Text>
        <RoundBtn onPress={() => undefined}><Settings2 size={20} color={INK} /></RoundBtn>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* ── Mini dish card ── */}
        <View style={[s.pad, { marginTop: 8 }]}>
          <View style={s.locDishCard}>
            <DishHeroImage image={image} style={s.locDishImg} />
            <View style={{ flex: 1 }}>
              <Text style={s.locDishName}>{dishName}</Text>
            </View>
            <Text style={s.locRadius}>Trong bán kính 3 km</Text>
          </View>
        </View>

        {/* ── Map preview ── */}
        <View style={s.mapWrap}>
          {/* Giả lập map bằng gradient vàng nhạt */}
          <View style={s.mapBg}>
            {/* Circles */}
            {[120, 80, 40].map((r, i) => (
              <View key={i} style={[s.mapCircle, { width: r * 2, height: r * 2, borderRadius: r, opacity: 0.25 - i * 0.06 }]} />
            ))}
            {/* Center dot */}
            <View style={s.mapCenterDot} />
            {/* M pins */}
            {[
              { top: 40, left: 120 },
              { top: 55, left: 220 },
              { top: 120, left: 80 },
            ].map((pos, i) => (
              <View key={i} style={[s.mapPin, { top: pos.top, left: pos.left }]}>
                <Text style={s.mapPinTxt}>M</Text>
            </View>
          ))}
            {/* Radius labels */}
            <View style={[s.mapLabel, { bottom: 12, left: 80 }]}><Text style={s.mapLabelTxt}>1 km</Text></View>
            <View style={[s.mapLabel, { bottom: 12, left: 130 }]}><Text style={s.mapLabelTxt}>2 km</Text></View>
            <View style={[s.mapLabel, { bottom: 12, left: 180 }]}><Text style={s.mapLabelTxt}>3 km</Text></View>
        </View>
        </View>

        <View style={s.pad}>
          {/* ── Quán phù hợp ── */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Quán phù hợp</Text>
          {[
            { name: 'Phở Thìn', rating: 4.7, dist: '1,2 km', price: '50K–65K', open: true },
            { name: 'Phở Gia Truyền', rating: 4.6, dist: '2,4 km', price: '45K–60K', open: true },
          ].map((shop) => (
            <Pressable key={shop.name} style={s.shopCard}>
              <DishHeroImage image={image} style={s.shopImg} />
              <View style={{ flex: 1 }}>
                <Text style={s.shopName}>{shop.name}</Text>
                <View style={[s.row, { gap: 6, marginTop: 3 }]}>
                  <Star size={14} color={YELLOW_D} fill={YELLOW} />
                  <Text style={s.shopRating}>{shop.rating}</Text>
                  <Text style={s.shopDist}>· {shop.dist} ·</Text>
                  {shop.open && <Text style={s.shopOpen}>Đang mở</Text>}
                </View>
                <Text style={s.shopPrice}>{shop.price}</Text>
              </View>
              <ChevronRight size={18} color={MUTED} />
        </Pressable>
          ))}

          {/* Xem tất cả */}
          <Pressable style={s.seeAllBtn}>
            <Text style={s.seeAllTxt}>Xem tất cả địa điểm</Text>
            <ChevronRight size={16} color={MUTED} />
          </Pressable>

          {/* ── Đánh giá cộng đồng ── */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Đánh giá cộng đồng</Text>
          <View style={s.communityCard}>
            <View style={s.communityLeft}>
              <Text style={s.communityScore}>4,8<Text style={s.communityScoreOf}>/5</Text></Text>
              <View style={[s.row, { gap: 3, marginTop: 4 }]}>
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} color={i <= 4 ? YELLOW_D : BORDER} fill={i <= 4 ? YELLOW : 'transparent'} />)}
          </View>
              <Text style={s.communityCount}>1.285 đánh giá</Text>
        </View>
            <View style={s.communityReviews}>
              {[
                { name: 'Hương Giang', text: 'Nước dùng đậm đà, thịt bò mềm ngọt, quán sạch sẽ.', ago: '2 ngày trước' },
                { name: 'Minh Quân', text: 'Phở thơm ngon, giá hợp lý, nhân viên nhiệt tình.', ago: '3 ngày trước' },
              ].map((r) => (
                <View key={r.name} style={s.communityReviewItem}>
                  <View style={[s.row, { gap: 8, marginBottom: 4 }]}>
                    <View style={s.avatarCircle}><Text style={s.avatarTxt}>{r.name[0]}</Text></View>
                    <View>
                      <Text style={s.reviewAuthor}>{r.name}</Text>
                      <View style={[s.row, { gap: 2 }]}>
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={11} color={YELLOW_D} fill={YELLOW} />)}
                        <Text style={[s.shopDist, { marginLeft: 4 }]}>{r.ago}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.reviewComment}>{r.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Viết đánh giá */}
          <Pressable style={s.writeReviewBtn2}>
            <Text style={s.writeReviewTxt}>Viết đánh giá</Text>
        </Pressable>

          {/* ── Món tương tự ── */}
          <Text style={[s.sectionLabel, { marginTop: 24 }]}>Món tương tự</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {[
              { name: 'Bún bò Huế', price: '45K–60K', emoji: '🍜' },
              { name: 'Bún riêu', price: '40K–55K', emoji: '🦀' },
              { name: 'Hủ tiếu bò', price: '45K–60K', emoji: '🍝' },
            ].map((d) => (
              <Pressable key={d.name} style={s.similarCard}>
                <View style={s.similarImgWrap}>
                  <Text style={{ fontSize: 32 }}>{d.emoji}</Text>
            </View>
                <Text style={s.similarName}>{d.name}</Text>
                <Text style={s.similarPrice}>{d.price}</Text>
                <View style={[s.row, { gap: 4, marginTop: 4 }]}>
                  <ChevronRight size={13} color={MUTED} />
                </View>
              </Pressable>
          ))}
        </ScrollView>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <PrimaryBtn label="Chỉ đường đến quán" icon={<Navigation size={18} color={INK} />} onPress={onChoose} />
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ConfirmedPage  (màn xác nhận sau khi chọn món)
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmedPage({
  image, dishName, meal, onClose, onChange,
}: {
  image?: ImageSourcePropType; dishName: string; meal: string;
  onClose(): void; onChange(): void;
}) {
  const [time, setTime] = useState('Bây giờ');
  const [remind, setRemind] = useState(true);
  const slide = useRef(new Animated.Value(300)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, speed: 14, bounciness: 8, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Background: ảnh món mờ + overlay ở phần trên */}
      <View style={StyleSheet.absoluteFill}>
        <DishHeroImage image={image} style={{ width: '100%', height: '55%' }} />
        <View style={[StyleSheet.absoluteFill, { height: '55%', backgroundColor: 'rgba(0,0,0,0.38)' }]} />
      </View>

      {/* Header trong suốt */}
      <View style={s.header}>
        <RoundBtn onPress={onChange}><ArrowLeft size={22} color={WHITE} /></RoundBtn>
        <Image source={BRAND} style={s.brand} resizeMode="contain" />
        <View style={s.row}>
          <RoundBtn onPress={() => undefined}><Bookmark size={20} color={WHITE} /></RoundBtn>
          <RoundBtn onPress={() => undefined}><Share2 size={20} color={WHITE} /></RoundBtn>
            </View>
      </View>

      {/* Tên + rating nổi trên ảnh */}
      <Animated.View style={[s.heroInfo, { opacity: fade }]}>
        <View style={s.matchBadge}>
          <Star size={13} color={INK} fill={INK} />
          <Text style={s.matchText}>Phù hợp 92%</Text>
        </View>
        <Text style={s.heroName}>{dishName}</Text>
        <View style={[s.row, { gap: 6, marginTop: 4 }]}>
          <Star size={16} color={YELLOW} fill={YELLOW} />
          <Text style={s.heroRating}>4,8 · 1.248 đánh giá</Text>
        </View>
        <Text style={s.heroDesc}>Nước dùng trong, thơm gia vị, thịt bò mềm và bánh phở dai nhẹ.</Text>
        <View style={[s.row, { gap: 10, marginTop: 12 }]}>
          <QuickPill icon={<Users size={16} color={WHITE} />} label={meal} />
          <QuickPill icon={<View style={s.tagDiamond} />} label="45K–65K" />
          <QuickPill icon={<Clock3 size={16} color={WHITE} />} label="25 phút" />
          </View>
        </Animated.View>

      {/* Sheet trượt lên từ dưới */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
        {/* Mascot + confirmed */}
        <View style={s.confirmedTop}>
          <View style={s.confirmedMascotRow}>
            <Image source={MASCOT} style={s.confirmedMascot} resizeMode="contain" />
            <View style={s.confirmedCheck}>
              <Star size={18} color={WHITE} fill={WHITE} />
            </View>
          </View>
          <Text style={s.confirmedTitle}>Đã chọn {dishName}!</Text>
          <Text style={s.confirmedSub}>Đã thêm vào bữa ăn hôm nay.</Text>
        </View>

        {/* Time picker */}
        <View style={s.timeRow}>
          {['Bây giờ', '12:30', 'Chọn giờ'].map(t => (
            <Pressable key={t} style={[s.timeChip, time === t && s.timeChipOn]} onPress={() => setTime(t)}>
              <Clock3 size={17} color={time === t ? INK : MUTED} />
              <Text style={[s.timeLabel, time === t && s.timeLabelOn]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* Remind toggle */}
        <View style={s.remindRow}>
          <Text style={s.remindLabel}>Nhắc tôi ghi lại bữa ăn</Text>
          <Switch checked={remind} onCheckedChange={setRemind} />
        </View>

        {/* Buttons */}
        <PrimaryBtn label="Hoàn tất" icon={<Check size={18} color={INK} />} onPress={onClose} />
        <Pressable style={s.outlineBtn}>
          <MapPin size={19} color={MUTED} />
          <Text style={s.outlineText}>Xem địa điểm gần đây</Text>
        </Pressable>
        <Pressable onPress={onChange}>
          <Text style={s.changeText}>Thay đổi món</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
//  Shared components
// ══════════════════════════════════════════════════════════════════════════════
function RoundBtn({ children, onPress }: { children: ReactNode; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.roundBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
    >
      {children}
    </Pressable>
  );
}


function QuickPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={s.quickPill}>
      {icon}
      <Text style={s.quickPillTxt}>{label}</Text>
    </View>
  );
}

function NavCard({ icon, title, sub, onPress }: {
  icon: ReactNode; title: string; sub: string; onPress(): void;
}) {
  return (
    <Pressable style={s.navCard} onPress={onPress}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={s.navTitle}>{title}</Text>
        <Text style={s.navSub}>{sub}</Text>
    </View>
      <ChevronRight size={20} color={MUTED} />
    </Pressable>
  );
}


function PrimaryBtn({ label, icon, onPress }: { label: string; icon?: ReactNode; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      <LinearGradient colors={['#FFD12F', '#FFD94F', '#FFD12F']} style={s.primaryGrad}>
        {icon ? <View>{icon}</View> : null}
        <Text style={s.primaryTxt}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  pad: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },

  /* header */
  header: {
    height: 60, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { width: 100, height: 44 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  /* result 'page' uses matchBadge too */
  matchBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: YELLOW, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 8,
  },
  matchText: { fontSize: 12, fontWeight: '600', color: INK },

  /* hero (overview) */
  heroWrap: { height: 168, marginHorizontal: 0, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  regionBadge: {
    position: 'absolute', right: 12, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  regionText: { fontSize: 12, fontWeight: '500', color: MUTED },

  /* overview text */
  dishTitle: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: INK, marginTop: 10 },
  ratingNum: { fontSize: 14, fontWeight: '700', color: INK },
  ratingCount: { fontSize: 12.5, color: MUTED },
  desc: { fontSize: 12.5, lineHeight: 17, color: '#555', marginVertical: 6 },

  /* 4-stat row */
  statsRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  statChip: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4, gap: 2, ...shadow,
  },
  statTop: { fontSize: 14, fontWeight: '800', color: INK, textAlign: 'center' },
  statBot: { fontSize: 11, color: MUTED, textAlign: 'center' },

  /* accordion */
  accordion: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 14,
    marginVertical: 4, ...shadow,
  },
  accordionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: YELLOW_L, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  accordionTitle: { fontSize: 15, fontWeight: '700', color: INK },
  accordionBody: { fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 18 },

  /* explanation factors */
  factorsBox: {
    borderRadius: 14, borderWidth: 1, borderColor: '#EDE8DF',
    backgroundColor: '#FFFDF7', padding: 14, marginTop: 4, gap: 8,
  },
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factorDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFC31A', marginTop: 6 },
  factorText: { fontSize: 13, color: '#444', lineHeight: 19, flex: 1 },
  fallbackNote: { fontSize: 11.5, color: '#999', fontStyle: 'italic', marginTop: 4 },

  /* nav card */
  navCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 0, ...shadow,
  },
  navIco: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: YELLOW_L, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 14, fontWeight: '700', color: INK },
  navSub: { fontSize: 12, color: MUTED, marginTop: 1 },

  /* footer */
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20,
    backgroundColor: CREAM,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
    ...shadow,
  },
  primaryGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryTxt: { fontSize: 15, fontWeight: '700', color: INK },

  randomBtnFlex: {
    height: 56, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#C8C0B4',
    backgroundColor: WHITE,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 18,
    ...shadow,
  },
  randomBtnText: { fontSize: 15, fontWeight: '700', color: INK },

  /* unused kept for compat */
  randomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40 },
  randomText: { fontSize: 14, color: MUTED },

  // ── ConfirmedPage ──
  heroInfo: {
    position: 'absolute', top: 70, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 8,
  },
  heroName: { fontSize: 30, fontWeight: '700', color: WHITE, marginTop: 6 },
  heroRating: { fontSize: 14, color: 'rgba(255,255,255,0.88)' },
  heroDesc: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.82)', marginTop: 6 },

  quickPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  quickPillTxt: { fontSize: 13, color: WHITE, fontWeight: '500' },
  tagDiamond: {
    width: 12, height: 12, backgroundColor: WHITE,
    transform: [{ rotate: '45deg' }], borderRadius: 2,
  },

  /* sheet */
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAFAF5',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 30,
    gap: 14,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 }, elevation: 24,
  },
  confirmedTop: { alignItems: 'center', gap: 6, marginBottom: 4 },
  confirmedMascotRow: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  confirmedMascot: { width: 76, height: 76 },
  confirmedCheck: {
    position: 'absolute', right: -4, bottom: -4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#34C759', borderWidth: 2, borderColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmedTitle: { fontSize: 24, fontWeight: '700', color: INK, textAlign: 'center' },
  confirmedSub: { fontSize: 14, color: MUTED, textAlign: 'center' },

  timeRow: { flexDirection: 'row', gap: 8 },
  timeChip: {
    flex: 1, height: 48, borderRadius: 999, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  timeChipOn: { backgroundColor: YELLOW_L, borderColor: YELLOW_D },
  timeLabel: { fontSize: 13, fontWeight: '500', color: MUTED },
  timeLabelOn: { color: INK, fontWeight: '600' },

  remindRow: {
    height: 60, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
  },
  remindLabel: { fontSize: 15, fontWeight: '500', color: INK },

  outlineBtn: {
    height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  outlineText: { fontSize: 15, fontWeight: '600', color: MUTED },
  changeText: { fontSize: 14, color: MUTED, textDecorationLine: 'underline', textAlign: 'center' },

  // ── NutritionPage ──
  miniHeroCard: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    backgroundColor: WHITE, borderRadius: 20, padding: 12,
    borderWidth: 1, borderColor: BORDER, ...shadow,
  },
  miniHeroImg: { width: 130, height: 110, borderRadius: 14, resizeMode: 'cover' },
  miniDishName: { fontSize: 18, fontWeight: '700', color: INK, marginTop: 6 },
  miniRating: { fontSize: 13, color: MUTED },
  miniChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F2EC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  miniChipTxt: { fontSize: 12, color: MUTED },
  miniDiamond: {
    width: 10, height: 10, backgroundColor: MUTED,
    transform: [{ rotate: '45deg' }], borderRadius: 2,
  },

  bigCard: {
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', ...shadow,
  },
  bigCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  bigCardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: INK },

  macroRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  calorieBox: {
    width: 80, alignItems: 'center',
    borderRightWidth: 1, borderRightColor: BORDER, marginRight: 10,
  },
  calorieNum: { fontSize: 44, fontWeight: '700', color: INK, lineHeight: 48 },
  calorieUnit: { fontSize: 14, color: MUTED },
  macroGrid: { flex: 1, flexDirection: 'row' },
  macroCell: { flex: 1, alignItems: 'center', gap: 4 },
  macroIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF6E0', alignItems: 'center', justifyContent: 'center',
  },
  macroLabel: { fontSize: 11, color: MUTED },
  macroValue: { fontSize: 16, fontWeight: '700', color: INK },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  stepNum: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  stepNumTxt: { fontSize: 16, fontWeight: '700', color: INK },
  stepTxt: { fontSize: 14, color: INK, flex: 1 },

  videoCard: { height: 200, marginHorizontal: 14, marginTop: 14, borderRadius: 16, overflow: 'hidden' },
  videoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  playBtn: {
    position: 'absolute', alignSelf: 'center', top: 68,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  videoTitle: {
    position: 'absolute', left: 14, bottom: 14,
    color: WHITE, fontSize: 16, fontWeight: '700',
  },

  recipeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, marginHorizontal: 14, marginTop: 10, marginBottom: 14,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
  },
  recipeBtnTxt: { fontSize: 14, fontWeight: '600', color: MUTED },

  // ── ResultPage ──
  progressRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: 2,
  },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E0DDD5' },
  progressBarActive: { backgroundColor: YELLOW_D },

  resultIntro: {
    alignItems: 'center',
    paddingTop: 10, paddingBottom: 4, paddingHorizontal: 20,
  },
  resultMascot: { width: 84, height: 84, marginBottom: 6 },
  resultLead: { fontSize: 15, color: MUTED, fontWeight: '500', letterSpacing: 0.1 },
  resultDishName: {
    fontSize: 38, fontWeight: '900', color: INK,
    textAlign: 'center', marginTop: 2, lineHeight: 44,
  },

  resultPhotoWrap: {
    marginHorizontal: 16, borderRadius: 22, overflow: 'hidden',
    marginTop: 10, marginBottom: 12,
  },
  resultPhoto: { width: '100%', height: 210, resizeMode: 'cover' },
  resultMatchBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: YELLOW, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  resultMatchTxt: { fontSize: 13, fontWeight: '600', color: INK },

  // 4-stat card giống design
  resultStatCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: WHITE, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  res4StatItem: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  res4StatTop: { fontSize: 12, color: MUTED, fontWeight: '500', textAlign: 'center' },
  res4StatBot: { fontSize: 15, fontWeight: '800', color: INK, textAlign: 'center' },

  resultWhyCard: {
    marginHorizontal: 16, backgroundColor: WHITE, borderRadius: 20,
    padding: 18, ...shadow, marginBottom: 8, gap: 12,
  },
  resultWhyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  resultWhyIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: YELLOW_L,
    alignItems: 'center', justifyContent: 'center',
  },
  resultWhyTitle: { fontSize: 16, fontWeight: '800', color: INK, flex: 1 },
  resultWhyBody: { fontSize: 14, color: '#444', lineHeight: 22 },

  nutHighlightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFF8E1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  nutHighlightTxt: { fontSize: 13, color: '#7A5F00', lineHeight: 19, flex: 1 },

  factorsList: { gap: 8 },
  factorListItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  factorBullet: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: YELLOW_D, marginTop: 6, flexShrink: 0,
  },
  factorListTxt: { fontSize: 13.5, color: '#333', lineHeight: 20, flex: 1 },

  resultFactorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  factorChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#F5F2EA', borderWidth: 1, borderColor: '#E8E3D8',
  },
  factorChipTxt: { fontSize: 12.5, color: '#666', fontWeight: '500' },

  tipBox: {
    backgroundColor: '#F0FAF5', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#4CAF50',
  },
  tipLabel: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginBottom: 4 },
  tipTxt: { fontSize: 13, color: '#1B5E20', lineHeight: 19 },

  diamond: { width: 12, height: 12, backgroundColor: MUTED, transform: [{ rotate: '45deg' }], borderRadius: 2 },

  resultFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
    backgroundColor: CREAM, borderTopWidth: 1, borderTopColor: BORDER,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  againBtn: {
    flex: 1, height: 54, borderRadius: 18, borderWidth: 1.5, borderColor: '#C8C0B4',
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, ...shadow,
  },
  againTxt: { fontSize: 15, fontWeight: '700', color: INK },
  chooseBtnWrap: { flex: 1 },

  // ── OverviewPage ──
  ovHeader: {
    height: 52, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ovHeaderTitle: { fontSize: 16.5, fontWeight: '700', color: INK },
  ovBody: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  ovMatchBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  ov3Stats: {
    backgroundColor: WHITE, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 8, paddingVertical: 10, ...shadow,
  },
  ovStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ovStatLabel: { fontSize: 12, fontWeight: '600', color: INK },
  ovStatDivider: { width: 1, height: 18, backgroundColor: BORDER },

  quickInfoCard: {
    backgroundColor: WHITE, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 12, gap: 6, ...shadow, marginBottom: 10,
  },
  quickInfoTitle: { fontSize: 13.5, fontWeight: '700', color: INK, marginBottom: 2 },
  quickInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickInfoLabel: { fontSize: 12, color: MUTED, flex: 1 },
  quickInfoValue: { fontSize: 12, fontWeight: '600', color: INK },
  quickInfoChip: {
    backgroundColor: '#F0F7FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  quickInfoChipTxt: { fontSize: 11.5, color: '#2979FF', fontWeight: '500' },

  allergyBox: {
    backgroundColor: '#FFF8E1', borderRadius: 10, borderWidth: 1, borderColor: '#FFE082',
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginTop: 4,
  },
  allergyTitle: { fontSize: 12, fontWeight: '700', color: '#5D490F', marginBottom: 1 },
  allergyBody: { fontSize: 11.5, color: '#7A6120', lineHeight: 15 },
  allergyMascot: { width: 30, height: 30 },

  ingredientSection: { marginBottom: 4 },
  sectionLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  ingCard: { alignItems: 'center', marginRight: 10, width: 58 },
  ingImgWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  ingCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: WHITE, borderWidth: 1.2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', ...shadow,
    overflow: 'hidden',
  },
  ingEmoji: { fontSize: 20 },
  ingName: { fontSize: 11, color: INK, textAlign: 'center', marginTop: 4, fontWeight: '500' },

  // qiRow: inline row cho Thông tin nhanh
  qiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' },
  qiLabel: { fontSize: 13, color: MUTED, fontWeight: '500' },
  qiDot: { fontSize: 13, color: MUTED, marginHorizontal: 2 },
  qiValue: { fontSize: 13, fontWeight: '600', color: INK },

  // ovDiamond: hình kim cương đúng design
  ovDiamond: {
    width: 14, height: 14,
    backgroundColor: INK,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },

  // navCardGap: khoảng cách giữa NavCards
  navCardGap: { height: 10 },

  // ── NutritionPage ──
  nutHeroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    backgroundColor: WHITE, borderRadius: 20, padding: 12,
    borderWidth: 1, borderColor: BORDER, ...shadow,
  },
  nutHeroLeft: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  nutHeroImg: { width: '100%', height: '100%' },
  nutDishName: { fontSize: 17, fontWeight: '700', color: INK },
  nutServing: { fontSize: 14, color: MUTED, marginTop: 2 },
  nutServingBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: YELLOW_L, alignItems: 'center', justifyContent: 'center',
  },
  nutCard: {
    backgroundColor: WHITE, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    marginTop: 8, ...shadow,
  },
  nutKcalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  nutKcalBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  nutKcalVal: { fontSize: 26, fontWeight: '800', color: INK, lineHeight: 30 },
  nutKcalLbl: { fontSize: 10, fontWeight: '600', color: MUTED, marginTop: 1 },
  nutDivider: { width: 1, height: 34, backgroundColor: BORDER, marginHorizontal: 6 },
  nutMacroGrid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  nutMacroCell: { alignItems: 'center', gap: 2 },
  nutMacroVal: { fontSize: 14, fontWeight: '700' },
  nutMacroLbl: { fontSize: 10, color: MUTED },
  nutDisclaimer: { borderTopWidth: 1, borderTopColor: '#F2EFE8', paddingHorizontal: 12, paddingVertical: 6 },
  nutDisclaimerTxt: { fontSize: 10.5, color: MUTED },

  nutStep: {
    flexDirection: 'row', gap: 14, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  nutStepNum: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nutStepNumTxt: { fontSize: 16, fontWeight: '800', color: INK },
  nutStepTitle: { fontSize: 15, fontWeight: '700', color: INK },
  nutStepDesc: { fontSize: 13, color: MUTED, lineHeight: 20, marginTop: 3 },

  nutExtraRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 4 },
  nutExtraChip: {
    flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nutExtraTxt: { fontSize: 13, fontWeight: '600', color: INK },

  videoMascotWrap: { position: 'absolute', bottom: 8, right: 12 },
  videoMascot: { width: 48, height: 48 },

  // ── LocationPage ──
  locDishCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: WHITE, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER, ...shadow,
  },
  locDishImg: { width: 44, height: 44, borderRadius: 22 },
  locDishName: { fontSize: 16, fontWeight: '700', color: INK, flex: 1 },
  locRadius: { fontSize: 13, color: MUTED },
  mapWrap: { marginHorizontal: 16, marginTop: 14, borderRadius: 20, overflow: 'hidden', height: 200 },
  mapBg: {
    flex: 1, backgroundColor: '#FFF8DC',
    alignItems: 'center', justifyContent: 'center',
  },
  mapCircle: {
    position: 'absolute', borderWidth: 2, borderColor: YELLOW_D, backgroundColor: 'transparent',
  },
  mapCenterDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#2979FF', borderWidth: 3, borderColor: WHITE,
  },
  mapPin: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: WHITE,
  },
  mapPinTxt: { fontSize: 14, fontWeight: '800', color: INK },
  mapLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  mapLabelTxt: { fontSize: 11, color: MUTED, fontWeight: '500' },

  shopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: WHITE, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER, marginTop: 10, ...shadow,
  },
  shopImg: { width: 60, height: 60, borderRadius: 14 },
  shopName: { fontSize: 15, fontWeight: '700', color: INK },
  shopRating: { fontSize: 14, fontWeight: '600', color: INK },
  shopDist: { fontSize: 13, color: MUTED },
  shopOpen: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  shopPrice: { fontSize: 13, color: MUTED, marginTop: 3 },

  seeAllBtn: {
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, ...shadow,
  },
  seeAllTxt: { fontSize: 14, fontWeight: '600', color: INK },

  communityCard: {
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', gap: 14, padding: 16, marginTop: 12, ...shadow,
  },
  communityLeft: { alignItems: 'center', minWidth: 70 },
  communityScore: { fontSize: 32, fontWeight: '800', color: INK },
  communityScoreOf: { fontSize: 18, fontWeight: '500', color: MUTED },
  communityCount: { fontSize: 12, color: MUTED, marginTop: 4, textAlign: 'center' },
  communityReviews: { flex: 1, gap: 12 },
  communityReviewItem: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  avatarCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: YELLOW_L, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: INK },

  writeReviewBtn2: {
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center',
    marginTop: 12, ...shadow,
  },

  similarCard: { width: 110, marginRight: 12, alignItems: 'flex-start' },
  similarImgWrap: {
    width: 110, height: 80, borderRadius: 14,
    backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  similarName: { fontSize: 13, fontWeight: '700', color: INK, marginTop: 8 },
  similarPrice: { fontSize: 12, color: MUTED, marginTop: 2 },

  // ── Review section ──
  reviewSection: {
    marginTop: 20,
    backgroundColor: WHITE,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    padding: 16, ...shadow,
  },
  reviewSectionTitle: { fontSize: 16, fontWeight: '700', color: INK },
  writeReviewBtn: {
    backgroundColor: YELLOW_L, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  writeReviewTxt: { fontSize: 13, fontWeight: '600', color: YELLOW_D },

  reviewForm: {
    backgroundColor: '#FAFAF5', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: BORDER,
  },
  reviewFormLabel: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 8 },
  reviewInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: INK,
    backgroundColor: WHITE, minHeight: 80, textAlignVertical: 'top',
    marginBottom: 10,
  },
  submitReviewBtn: {
    height: 44, borderRadius: 12, backgroundColor: YELLOW,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitReviewTxt: { fontSize: 14, fontWeight: '700', color: INK },

  reviewCard: {
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingTop: 12, paddingBottom: 8,
  },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: INK },
  reviewComment: { fontSize: 13, color: '#444', lineHeight: 20, marginTop: 4 },
  reviewDate: { fontSize: 11, color: MUTED, marginTop: 4 },

  emptyReview: { alignItems: 'center', paddingVertical: 16 },
  emptyReviewTxt: { fontSize: 13, color: MUTED, textAlign: 'center' },

  /* ── Recipe Overview (NutritionPage redesign) ─────────────────────────── */
  recHeroCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    borderRadius: 14, padding: 10, gap: 10,
    borderWidth: 1, borderColor: BORDER, ...shadow,
  },
  recHeroImg: { width: 72, height: 72, borderRadius: 10 },
  recHeroInfo: { flex: 1, gap: 5 },
  recHeroName: { fontSize: 15, fontWeight: '700', color: INK, lineHeight: 20 },
  recHeroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  recHeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8F5EC', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  recHeroBadgeTxt: { fontSize: 11, fontWeight: '600', color: '#555' },

  /* Count badge */
  countBadge: {
    backgroundColor: '#F0EFEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: '600', color: MUTED },

  /* Serving control */
  servingCtrl: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: WHITE, borderRadius: 16,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: BORDER,
  },
  servingBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center',
  },
  servingBtnTxt: { fontSize: 14, fontWeight: '600', color: INK },
  servingCount: { fontSize: 12, fontWeight: '600', color: INK, minWidth: 50, textAlign: 'center' },

  /* Ingredients Grid */
  ingEmptyWrap: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    ...shadow,
  },
  ingGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  ingGridCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#EFEAE0',
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadow,
  },
  ingGridCardChecked: {
    backgroundColor: '#F7F6F2',
    borderColor: '#81C784',
  },
  ingGridThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF9E8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ingGridThumbImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  ingGridEmoji: {
    fontSize: 20,
  },
  ingGridName: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    marginTop: 5,
  },
  ingGridNameDone: {
    color: MUTED,
    textDecorationLine: 'line-through',
  },
  ingGridQtyBadge: {
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  ingGridQtyBadgeChecked: {
    backgroundColor: '#EAE8E2',
  },
  ingGridQtyTxt: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B45309',
    textAlign: 'center',
  },
  ingGridQtyTxtChecked: {
    color: MUTED,
  },
  ingGridCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Step progress badge */
  stepProgressBadge: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6,
  },
  stepProgressTxt: { fontSize: 11, fontWeight: '700', color: '#2563EB' },

  /* Recipe step (timeline) - Compact: only title & duration */
  recStepContainer: {
    marginTop: 2,
  },
  recStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  recStepLeft: { alignItems: 'center', width: 26 },
  recStepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  recStepDotDone: { backgroundColor: '#4CAF50' },
  recStepDotActive: { backgroundColor: YELLOW_D },
  recStepN: { fontSize: 12, fontWeight: '800', color: INK },
  recStepLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: BORDER, marginVertical: 2 },
  recStepBody: { flex: 1, paddingBottom: 12 },
  recStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 24,
  },
  recStepTitle: { fontSize: 13.5, fontWeight: '700', color: INK, flex: 1 },
  recStepTitleDone: { color: MUTED, textDecorationLine: 'line-through' },
  recStepTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  recStepTime: { fontSize: 11, fontWeight: '700', color: '#92400E' },

  /* Recipe Footer (giống nút hình 2) */
  recipeFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CREAM,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  startCookBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startCookTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },

  /* ── Cooking Mode ──────────────────────────────────────────────────────── */
  cookProgress: { paddingHorizontal: 16, paddingVertical: 4, gap: 4 },
  cookProgressLabel: { fontSize: 11.5, fontWeight: '600', color: MUTED },
  cookProgressBarBg: { height: 4, borderRadius: 2, backgroundColor: BORDER },
  cookProgressBarFill: { height: 4, borderRadius: 2, backgroundColor: YELLOW_D },

  cookImgWrap: { height: 145, position: 'relative', overflow: 'hidden' },
  cookImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cookDurBadge: {
    position: 'absolute', top: 8, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cookDurTxt: { color: '#fff', fontSize: 11.5, fontWeight: '600' },
  cookPlayBtn: {
    position: 'absolute', top: '50%', left: '50%',
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    marginTop: -22, marginLeft: -22,
  },

  cookStepBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cookStepBadgeTxt: { fontSize: 14, fontWeight: '800', color: INK },
  cookStepTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: INK, lineHeight: 22, paddingTop: 2 },
  cookStepBody: { fontSize: 13, color: '#333', lineHeight: 18.5, marginTop: 6 },

  /* Cook ingredient chips */
  cookIngCard: { alignItems: 'center', marginRight: 10, width: 54 },
  cookIngImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 4 },
  cookIngName: { fontSize: 10.5, color: INK, textAlign: 'center', lineHeight: 14 },

  /* Timer */
  cookTimerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cookTimerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cookTimerLabel: { fontSize: 11, color: MUTED },
  cookTimerVal: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: 0.5 },
  cookTimerBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE,
  },
  cookTimerBtnActive: { backgroundColor: YELLOW, borderColor: YELLOW_D },
  cookTimerBtnTxt: { fontSize: 11.5, fontWeight: '600', color: INK },

  /* Tip box */
  cookTipBox: { flexDirection: 'row', gap: 6, backgroundColor: '#FFFBEC', borderRadius: 10, padding: 8, marginTop: 8, borderWidth: 1, borderColor: '#F0D890' },
  cookTipIco: { fontSize: 14 },
  cookTipTxt: { flex: 1, fontSize: 12, color: '#6B4F00', lineHeight: 16 },

  /* Cook footer */
  cookFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, gap: 10,
  },
  cookStepListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
  },
  cookStepListTxt: { fontSize: 13.5, fontWeight: '600', color: INK },
  cookNextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, borderRadius: 14, backgroundColor: YELLOW, gap: 6,
  },
  cookNextTxt: { fontSize: 14.5, fontWeight: '700', color: INK },

  /* Modal backdrop */
  cookModalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    zIndex: 99,
  },
  /* Step list modal */
  cookStepListModal: {
    backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, paddingBottom: 32,
  },
  cookListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F2EFE9',
  },
  cookListItemActive: { backgroundColor: '#FFF8E1', borderRadius: 12, borderBottomWidth: 0 },
  cookItemInfo: {
    flex: 1, minWidth: 0, justifyContent: 'center', gap: 2,
  },
  cookItemTitle: {
    fontSize: 14, fontWeight: '700', color: INK, lineHeight: 20, includeFontPadding: false,
  },
  cookItemTitleActive: {
    color: INK, fontWeight: '800',
  },
  cookItemTitleDone: {
    color: MUTED,
  },
  cookItemTime: {
    fontSize: 11.5, fontWeight: '600', color: '#B45309', lineHeight: 16, includeFontPadding: false,
  },

});
