import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Text,
  View,
} from 'react-native';
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
  onFinish?: () => void;
};

// ── Root ─────────────────────────────────────────────────────────────────────
export function FoodDetailFlowScreen({
  initialPage = 'overview',
  dishId,
  dishName = 'Phở bò',
  dishImage,
  ratingAvg,
  ratingCount,
  meal = 'Bữa trưa',
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
  onFinish,
}: Props) {
  const [page, setPage] = useState<FoodDetailPage>(initialPage);
  const history = useRef<FoodDetailPage[]>([]);
  const image: ImageSourcePropType =
    dishImage ?? require('../assets/images/random/pho-result.jpg');

  const go = (next: FoodDetailPage) => { history.current.push(page); setPage(next); };
  const back = () => {
    const prev = history.current.pop();
    if (prev) setPage(prev);
    else onClose();
  };

  // Shared dish info
  const totalPrepMin = (prepMinutes ?? 0) + (cookMinutes ?? 0);
  const priceLabel = priceMin && priceMax
    ? `${Math.round(priceMin / 1000)}K–${Math.round(priceMax / 1000)}K`
    : priceMax ? `${Math.round(priceMax / 1000)}K` : '45K–65K';
  const timeLabel = totalPrepMin > 0 ? `${totalPrepMin} phút` : '25 phút';
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
        onAgain={onClose}
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
  image: ImageSourcePropType;
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
          <Image source={image} style={s.resultPhoto} resizeMode="cover" />
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
        <View style={{ flex: 1 }}>
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
  image: ImageSourcePropType; dishId?: string; dishName: string; meal: string;
  ratingAvg?: number; ratingCount?: number; priceLabel: string; timeLabel: string;
  shortDescription?: string | null; originText?: string | null;
  nutrition?: DishNutrition | null; ingredients?: DishIngredient[]; allergens?: DishAllergen[];
  explanation?: Explanation; compat?: number | null;
  onBack(): void; onNutrition(): void; onLocation(): void; onChoose(): void;
}) {
  const [saved, setSaved] = useState(false);
  const displayRating = ratingAvg != null && ratingAvg > 0 ? ratingAvg : null;
  const displayCount = ratingCount ?? 0;

  // Data thuc tu API
  const desc = shortDescription ?? null;
  const origin = originText ?? null;
  const kcalNum = nutrition?.calories ?? null;
  const kcalStr = kcalNum ? (Math.round(Number(kcalNum)) + ' kcal') : '420 kcal';
  const displayIngredients = (ingredients ?? []).slice(0, 6);
  const displayAllergens = allergens ?? [];
  const hasAllergens = displayAllergens.length > 0;

  return (
    <SafeAreaView style={s.safe}>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Hero full-width */}
        <View style={s.heroWrap}>
          <Image source={image} style={s.heroImg} />
          {compat != null && (
            <View style={s.ovMatchBadge}>
              <Sparkles size={12} color={INK} />
              <Text style={s.matchText}>{`Phù hợp ${compat}%`}</Text>
            </View>
          )}
          <View style={s.regionBadge}>
            <MapPin size={13} color={MUTED} />
            {origin ? <Text style={s.regionText}>{origin}</Text> : null}
          </View>
        </View>

        <View style={s.pad}>
          <Text style={s.dishTitle}>{dishName}</Text>

          {/* Rating */}
          <View style={[s.row, { gap: 5, marginTop: 6 }]}>
            {displayRating != null ? (
              <>
                <Star size={17} color={YELLOW_D} fill={YELLOW} />
                <Text style={s.ratingNum}>{displayRating.toFixed(1)}</Text>
                <Text style={s.ratingCount}>{'· ' + displayCount.toLocaleString() + ' đánh giá'}</Text>
              </>
            ) : (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={15} color={i <= 4 ? YELLOW_D : BORDER} fill={i <= 4 ? YELLOW : 'transparent'} />
                ))}
                <Text style={s.ratingCount}>{'Chưa có đánh giá'}</Text>
              </>
            )}
          </View>

          {desc ? <Text style={s.desc}>{desc}</Text> : null}

          {/* 3 stat chips */}
          <View style={s.ov3Stats}>
            <OvStat icon={<Sun size={17} color={MUTED} />} label={meal} />
            <View style={s.ovStatDivider} />
            <OvStat icon={<View style={s.ovDiamond} />} label={priceLabel} />
            <View style={s.ovStatDivider} />
            <OvStat icon={<Clock3 size={17} color={MUTED} />} label={timeLabel} />
          </View>

          {/* Thong tin nhanh */}
          <View style={s.quickInfoCard}>
            <Text style={s.quickInfoTitle}>{'Thông tin nhanh'}</Text>
            <View style={s.qiRow}>
              <MapPin size={15} color={MUTED} />
              <Text style={s.qiLabel}>{'Nguồn gốc'}</Text>
              <Text style={s.qiDot}>{'·'}</Text>
              <Text style={s.qiValue}>{origin ?? 'Việt Nam'}</Text>
            </View>
            <View style={s.qiRow}>
              <Flame size={15} color={MUTED} />
              <Text style={s.qiLabel}>{'Ấm nóng'}</Text>
              <Zap size={14} color={MUTED} style={{ marginLeft: 10 }} />
              <Text style={s.qiLabel}>{'Đủ năng lượng'}</Text>
              <UtensilsCrossed size={14} color={MUTED} style={{ marginLeft: 10 }} />
              <Text style={s.qiLabel}>{'Món nước'}</Text>
            </View>
            <View style={s.allergyBox}>
              <AlertTriangle size={16} color="#E5A800" />
              <View style={{ flex: 1 }}>
                <Text style={s.allergyTitle}>{'Lưu ý dị ứng'}</Text>
                <Text style={s.allergyBody}>{hasAllergens ? ('Có thể chứa: ' + displayAllergens.map((a: any) => a.name).join(', ')) : 'Chưa có thông tin dị ứng'}</Text>
              </View>
              <Image source={MASCOT_COOL} style={s.allergyMascot} resizeMode="contain" />
            </View>
          </View>

          {/* Thanh phan chinh */}
          <View style={s.ingredientSection}>
            <Text style={s.sectionLabel}>{'Thành phần chính'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
              {(displayIngredients.length > 0 ? displayIngredients : [
                { rawText: 'Banh', imageUrl: null }, { rawText: 'Thit', imageUrl: null },
                { rawText: 'Rau', imageUrl: null }, { rawText: 'Gia vi', imageUrl: null },
              ]).map((ing: any, idx: number) => {
                const ingName = (ing.ingredientName ?? ing.rawText)
                  .replace(/\s*\d.*$/, '').replace(/\(.*\)/, '').trim();
                const EMOJIS = ['🍜', '🥩', '🌿', '🫙',
                  '🧂', '🥚', '🧅', '🌶',
                  '🫒', '🍋', '🦶', '🍌'];
                return (
                  <View key={idx} style={s.ingCard}>
                    <View style={s.ingCircle}>
                      {ing.imageUrl ? (
                        <Image
                          source={{ uri: ing.imageUrl }}
                          style={{ width: 60, height: 60, borderRadius: 30 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={s.ingEmoji}>{EMOJIS[idx % EMOJIS.length]}</Text>
                      )}
                    </View>
                    <Text style={s.ingName} numberOfLines={2}>{ingName}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* NavCards */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <NavCard
              icon={<View style={s.navIco}><BarChart3 size={20} color={INK} /></View>}
              title={'Dinh dưỡng & cách nấu'}
              sub={kcalStr + ' · Xem cách chế biến'}
              onPress={onNutrition}
            />
            <NavCard
              icon={<View style={s.navIco}><MapPin size={20} color={INK} /></View>}
              title={'Địa điểm gần bạn'}
              sub={'12 quán · Gần nhất 1,2 km'}
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
//  SCREEN 2 - NutritionPage  "Công thức [món]"  (Recipe Overview)
// ─────────────────────────────────────────────────────────────────────────────
function NutritionPage({
  image, dishName, priceLabel, timeLabel,
  nutrition, ingredients = [], recipeSteps = [], difficulty,
  prepMinutes, cookMinutes,
  onBack, onLocation, onChoose, onCook,
}: {
  image: ImageSourcePropType; dishName: string; priceLabel: string; timeLabel: string;
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

  const kcal = nutrition?.calories ? Math.round(Number(nutrition.calories)) : null;
  const protein = nutrition?.proteinG ? Math.round(Number(nutrition.proteinG)) : null;
  const carbs = nutrition?.carbsG ? Math.round(Number(nutrition.carbsG)) : null;
  const fat = nutrition?.fatG ? Math.round(Number(nutrition.fatG)) : null;
  const fiber = nutrition?.fiberG ? Math.round(Number(nutrition.fiberG)) : null;
  const serving = nutrition?.servingName ?? `${servings} khẩu phần`;
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Dish Hero Card ─────────────────────────────────────── */}
        <View style={s.recHeroCard}>
          <Image source={image} style={s.recHeroImg} resizeMode="cover" />
          <View style={s.recHeroInfo}>
            <Text style={s.recHeroName}>{dishName}</Text>
            <View style={{ gap: 6 }}>
              <View style={s.recHeroRow}>
                <Users size={15} color={MUTED} />
                <Text style={s.recHeroTxt}>{servings} khẩu phần</Text>
              </View>
              <View style={s.recHeroRow}>
                <Clock3 size={15} color={MUTED} />
                <Text style={s.recHeroTxt}>{timeStr}</Text>
              </View>
              <View style={s.recHeroRow}>
                <BarChart3 size={15} color={MUTED} />
                <Text style={s.recHeroTxt}>{diffLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Dinh dưỡng ─────────────────────────────────────────── */}
        <View style={s.pad}>
          <Text style={s.sectionLabel}>Dinh dưỡng tham khảo</Text>
          <View style={s.nutCard}>
            <View style={s.nutKcalRow}>
              <View className='flex flex-col items-center justify-center'>
                <Text style={s.nutKcalBig}>{kcal ?? '420'}</Text>
                <Text style={s.nutKcalUnit} className='text-center w-full'>kcal</Text>
              </View>
              <View style={s.nutMacroRow}>
                <NutMacro label="Protein" value={protein != null ? protein + 'g' : '28g'} color="#E06B6B" />
                <NutMacro label="Tinh bột" value={carbs != null ? carbs + 'g' : '52g'} color="#E5A800" />
                <NutMacro label="Chất béo" value={fat != null ? fat + 'g' : '12g'} color="#F07A35" />
                <NutMacro label="Chất xơ" value={fiber != null ? fiber + 'g' : '4g'} color="#4CAF50" />
              </View>
            </View>
            <View style={s.nutDisclaimer}>
              <Text style={s.nutDisclaimerTxt}>ⓘ Giá trị có thể thay đổi theo khẩu phần.</Text>
            </View>
          </View>

          {/* ── Nguyên liệu ─────────────────────────────────────── */}
          <View style={[s.row, { justifyContent: 'space-between', marginTop: 24, marginBottom: 14 }]}>
            <Text style={s.sectionLabel}>Nguyên liệu</Text>
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
          <View className='grid grid-cols-4 gap-2'>
            {(ingredients.length > 0 ? ingredients : [
              { rawText: '500g bánh phở', ingredientName: 'Bánh phở', imageUrl: null, quantity: 500, unit: 'g', groupLabel: null, isOptional: false },
              { rawText: '400g thịt bò', ingredientName: 'Thịt bò', imageUrl: null, quantity: 400, unit: 'g', groupLabel: null, isOptional: false },
              { rawText: '1,5 lít nước dùng', ingredientName: null, imageUrl: null, quantity: null, unit: null, groupLabel: null, isOptional: false },
            ]).map((ing: DishIngredient, idx: number) => {
              const ingName = (ing.ingredientName ?? ing.rawText).replace(/\(.*?\)/g, '').trim();
              return (
                <View key={idx} className='flex items-center justify-center flex-col gap-1 border border-primary rounded-lg p-2 ' >
                  <View style={s.ingRowImg}>
                    {ing.imageUrl ? (
                      <Image source={{ uri: ing.imageUrl }} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 26 }}>{EMOJIS[idx % EMOJIS.length]}</Text>
                    )}
                  </View>
                  <Text style={s.ingRowTxt} className='text-center' numberOfLines={2}>{ing.rawText || ingName}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Cách chế biến ───────────────────────────────────── */}
          <View style={[s.row, { justifyContent: 'space-between', marginTop: 28, marginBottom: 14 }]}>
            <Text style={s.sectionLabel}>Cách chế biến</Text>
            <Text style={s.stepProgress}>{completedCount}/{totalSteps} bước hoàn thành</Text>
          </View>

          {steps.length > 0 ? steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const done = checkedSteps.includes(step.n);
            return (
              <Pressable key={step.n} style={s.recStep} onPress={() => toggleStep(step.n)}>
                {/* Timeline line */}
                <View style={s.recStepLeft}>
                  <View style={[s.recStepDot, done && s.recStepDotDone]}>
                    <Text style={[s.recStepN, done && { color: '#fff' }]}>{step.n}</Text>
                  </View>
                  {!isLast && <View style={s.recStepLine} />}
                </View>
                <View style={[s.recStepBody, !isLast && { paddingBottom: 24 }]}>
                  <Text style={[s.recStepTitle, done && { color: MUTED }]}>{step.title}</Text>
                  {/* {!!step.body && <Text style={s.recStepDesc}>{step.body}</Text>} */}
                  {step.durationMin != null && (
                    <View style={[s.row, { gap: 4, marginTop: 6 }]}>
                      <Clock3 size={13} color={MUTED} />
                      <Text style={s.recStepTime}>{step.durationMin} phút</Text>
                    </View>
                  )}
                  {/* {!!step.tip && (
                    <View style={s.recStepTip}>
                      <Text style={s.recStepTipTxt}>💡 {step.tip}</Text>
                    </View>
                  )} */}
                </View>
              </Pressable>
            );
          }) : (
            <Text style={{ color: MUTED, fontSize: 14, marginBottom: 12 }}>Chưa có hướng dẫn chế biến.</Text>
          )}

          {/* ── Video hướng dẫn ─────────────────────────────────── */}
          <Text style={[s.sectionLabel, { marginTop: 28 }]}>Video hướng dẫn</Text>
          <Pressable style={[s.videoCard, { marginTop: 12 }]}>
            <Image source={image} style={s.videoImg} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.28)' }]} />
            <View style={s.playBtn}>
              <Play size={24} color="#fff" fill="#fff" />
            </View>
            <View style={s.videoMascotWrap}>
              <Image source={MASCOT} style={s.videoMascot} resizeMode="contain" />
            </View>
            <Text style={s.videoTitle}>{'Nấu ' + dishName + ' tại nhà'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer – Bắt đầu nấu */}
      <View style={s.footer}>
        <PrimaryBtn label="Bắt đầu nấu" icon={<UtensilsCrossed size={18} color={INK} />} onPress={onCook} />
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
  image: ImageSourcePropType; dishName: string;
  ingredients?: DishIngredient[];
  recipeSteps?: DishRecipeStep[];
  onBack(): void; onFinish(): void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [showStepList, setShowStepList] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
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

  const fallbackSteps = steps.length > 0 ? steps : [
    { n: 1, title: 'Sơ chế nguyên liệu', body: 'Chuẩn bị và sơ chế các nguyên liệu cần thiết.', tip: null, durationMin: 15, imageUrl: null },
    { n: 2, title: 'Chế biến', body: 'Thực hiện nấu theo hướng dẫn.', tip: null, durationMin: 30, imageUrl: null },
    { n: 3, title: 'Hoàn thiện và trình bày', body: 'Nêm nếm lại và trình bày món ăn.', tip: null, durationMin: 5, imageUrl: null },
  ];

  const currentStep = fallbackSteps[stepIdx] ?? fallbackSteps[0];
  const totalSteps = fallbackSteps.length;
  const progress = (stepIdx + 1) / totalSteps;

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

  const stepImage: ImageSourcePropType = currentStep.imageUrl
    ? { uri: currentStep.imageUrl }
    : image;

  const EMOJIS = ['🥩', '🌿', '🍜', '🧅', '🫙', '🌶️', '🥬', '🧄', '🍋', '🫒'];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.ovHeader}>
        <RoundBtn onPress={onBack}><ArrowLeft size={22} color={INK} /></RoundBtn>
        <Text style={s.ovHeaderTitle}>Đang nấu</Text>
        <RoundBtn onPress={() => setShowExitDialog(true)}>
          <Text style={{ fontSize: 18, color: INK }}>✕</Text>
        </RoundBtn>
      </View>

      {/* Progress */}
      <View style={s.cookProgress}>
        <Text style={s.cookProgressLabel}>Bước {stepIdx + 1}/{totalSteps}</Text>
        <View style={s.cookProgressBarBg}>
          <View style={[s.cookProgressBarFill, { width: (progress * 100) + '%' as any }]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Step image/video */}
        <View style={s.cookImgWrap}>
          <Image source={stepImage} style={s.cookImg} resizeMode="cover" />
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
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </View>

        <View style={s.pad}>
          {/* Step title + body */}
          <View style={[s.row, { gap: 14, marginTop: 20, alignItems: 'flex-start' }]}>
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
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>Nguyên liệu cho bước này</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {ingredients.slice(0, 8).map((ing, idx) => {
                  const ingName = (ing.ingredientName ?? ing.rawText)
                    .replace(/\s*\d.*$/, '').replace(/\(.*?\)/g, '').trim()
                    .split(' ').slice(0, 2).join(' ');
                  return (
                    <View key={idx} style={s.cookIngCard}>
                      <View style={s.cookIngImg}>
                        {ing.imageUrl ? (
                          <Image source={{ uri: ing.imageUrl }} style={{ width: 52, height: 52, borderRadius: 10 }} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 24 }}>{EMOJIS[idx % EMOJIS.length]}</Text>
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
              <Clock3 size={22} color={MUTED} />
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
          {!!currentStep.tip && (
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

      {/* Step list modal */}
      {showStepList && (
        <Pressable style={s.cookModalBackdrop} onPress={() => setShowStepList(false)}>
          <Pressable style={s.cookStepListModal} onPress={(e) => e.stopPropagation()}>
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>Các bước thực hiện</Text>
              <Pressable onPress={() => setShowStepList(false)}>
                <Text style={{ fontSize: 18, color: MUTED }}>✕</Text>
              </Pressable>
            </View>
            {fallbackSteps.map((st, idx) => (
              <Pressable
                key={st.n}
                style={[s.cookListItem, idx === stepIdx && s.cookListItemActive]}
                onPress={() => { setStepIdx(idx); setShowStepList(false); }}
              >
                <View style={[s.recStepDot, idx < stepIdx && s.recStepDotDone, idx === stepIdx && s.recStepDotActive]}>
                  <Text style={[s.recStepN, (idx <= stepIdx) && { color: idx === stepIdx ? INK : '#fff' }]}>{st.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.recStepTitle, idx < stepIdx && { color: MUTED }]}>{st.title}</Text>
                  {st.durationMin && <Text style={s.recStepTime}>{st.durationMin} phút</Text>}
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      )}

      {/* Exit dialog */}
      {showExitDialog && (
        <Pressable style={s.cookModalBackdrop} onPress={() => setShowExitDialog(false)}>
          <Pressable style={s.cookExitDialog} onPress={(e) => e.stopPropagation()}>
            <Text style={s.cookExitTitle}>Bạn muốn lưu tiến độ nấu hiện tại?</Text>
            <Pressable style={s.cookExitSave} onPress={() => { setShowExitDialog(false); onBack(); }}>
              <Text style={s.cookExitSaveTxt}>Lưu và thoát</Text>
            </Pressable>
            <Pressable style={s.cookExitContinue} onPress={() => setShowExitDialog(false)}>
              <Text style={s.cookExitContinueTxt}>Tiếp tục nấu</Text>
            </Pressable>
            <Pressable style={s.cookExitDiscard} onPress={() => { setShowExitDialog(false); onBack(); }}>
              <Text style={s.cookExitDiscardTxt}>Thoát không lưu</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
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
  image: ImageSourcePropType; dishName: string; onBack(): void; onChoose(): void;
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
            <Image source={image} style={s.locDishImg} resizeMode="cover" />
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
              <Image source={image} style={s.shopImg} resizeMode="cover" />
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
  image: ImageSourcePropType; dishName: string; meal: string;
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
        <Image source={image} style={{ width: '100%', height: '55%' }} resizeMode="cover" />
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
          <Switch
            value={remind} onValueChange={setRemind}
            trackColor={{ false: '#E0DDD5', true: '#34C759' }}
            thumbColor={WHITE}
          />
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
      <LinearGradient colors={['#FFD12F', '#FFD94F', '#FFD12F']} style={s.primaryGrad} className='flex flex-row gap-2 items-center justify-center'>
        {icon && <View >{icon}</View>}
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
  heroWrap: { height: 300, marginHorizontal: 0, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  regionBadge: {
    position: 'absolute', right: 14, bottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  regionText: { fontSize: 13, fontWeight: '500', color: MUTED },

  /* overview text */
  dishTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', color: INK, marginTop: 18 },
  ratingNum: { fontSize: 16, fontWeight: '700', color: INK },
  ratingCount: { fontSize: 14, color: MUTED },
  desc: { fontSize: 14, lineHeight: 22, color: '#555', marginVertical: 10 },

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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 0, ...shadow,
  },
  navIco: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: YELLOW_L, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 15, fontWeight: '600', color: INK },
  navSub: { fontSize: 13, color: MUTED, marginTop: 2 },

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
  primaryBtn: { height: 54, borderRadius: 18, overflow: 'hidden', ...shadow },
  primaryGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: 17, fontWeight: '700', color: INK },

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
    flexDirection: 'row', gap: 10,
  },
  againBtn: {
    flex: 1, height: 54, borderRadius: 18, borderWidth: 1.5, borderColor: '#C8C0B4',
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, ...shadow,
  },
  againTxt: { fontSize: 15, fontWeight: '700', color: INK },

  // ── OverviewPage ──
  ovHeader: {
    height: 60, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ovHeaderTitle: { fontSize: 17, fontWeight: '700', color: INK },
  ovMatchBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: YELLOW, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  ov3Stats: {
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 14, paddingVertical: 14, ...shadow,
  },
  ovStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ovStatLabel: { fontSize: 14, fontWeight: '600', color: INK },
  ovStatDivider: { width: 1, height: 30, backgroundColor: BORDER },

  quickInfoCard: {
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 10, ...shadow, marginBottom: 16,
  },
  quickInfoTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 2 },
  quickInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickInfoLabel: { fontSize: 14, color: MUTED, flex: 1 },
  quickInfoValue: { fontSize: 14, fontWeight: '600', color: INK },
  quickInfoChip: {
    backgroundColor: '#F0F7FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  quickInfoChipTxt: { fontSize: 12, color: '#2979FF', fontWeight: '500' },

  allergyBox: {
    backgroundColor: '#FFF8E1', borderRadius: 14, borderWidth: 1, borderColor: '#FFE082',
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 4,
  },
  allergyTitle: { fontSize: 14, fontWeight: '700', color: '#5D490F', marginBottom: 2 },
  allergyBody: { fontSize: 13, color: '#7A6120' },
  allergyMascot: { width: 44, height: 44 },

  ingredientSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: INK },
  ingCard: { alignItems: 'center', marginRight: 14, width: 72 },
  ingImgWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  ingName: { fontSize: 12, color: INK, textAlign: 'center', marginTop: 6, fontWeight: '500' },

  // ingCircle: round white bg like design (dùng thay ingImgWrap)
  ingCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: WHITE, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', ...shadow,
    overflow: 'hidden',
  },
  ingEmoji: { fontSize: 32 },

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
    backgroundColor: WHITE, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    marginTop: 12, ...shadow,
  },
  nutKcalRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 0 },
  nutKcal: { fontSize: 52, fontWeight: '800', color: INK, lineHeight: 58 },
  nutKcalUnit: { fontSize: 16, color: MUTED, alignSelf: 'flex-end' },
  nutMacroRow: { flex: 1, flexDirection: 'row' },
  nutMacroCell: { flex: 1, alignItems: 'center', gap: 2 },
  nutMacroVal: { fontSize: 18, fontWeight: '700' },
  nutMacroLbl: { fontSize: 11, color: MUTED },
  nutDisclaimer: { borderTopWidth: 1, borderTopColor: BORDER, paddingHorizontal: 16, paddingVertical: 10 },
  nutDisclaimerTxt: { fontSize: 12, color: MUTED },

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
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: WHITE, margin: 16, borderRadius: 16,
    padding: 12, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  recHeroImg: { width: 100, height: 100, borderRadius: 12 },
  recHeroInfo: { flex: 1, gap: 8 },
  recHeroName: { fontSize: 16, fontWeight: '700', color: INK, lineHeight: 22 },
  recHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recHeroTxt: { fontSize: 13, color: MUTED },
  recHeroChevron: { padding: 4 },

  /* Serving control */
  servingCtrl: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: BORDER },
  servingBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' },
  servingBtnTxt: { fontSize: 16, fontWeight: '600', color: INK },
  servingCount: { fontSize: 13, fontWeight: '600', color: INK, minWidth: 60, textAlign: 'center' },

  /* Ingredient row (list style) */
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  ingRowImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ingRowTxt: { flex: 1, fontSize: 14, color: INK, lineHeight: 20 },
  ingRowCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  ingCheckCircle: { width: 10, height: 10, borderRadius: 5 },

  /* Step progress */
  stepProgress: { fontSize: 12, color: MUTED, fontWeight: '500' },

  /* Recipe step (timeline) */
  recStep: { flexDirection: 'row', gap: 12 },
  recStepLeft: { alignItems: 'center', width: 36 },
  recStepDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
  },
  recStepDotDone: { backgroundColor: '#4CAF50' },
  recStepDotActive: { backgroundColor: YELLOW_D },
  recStepN: { fontSize: 15, fontWeight: '700', color: INK },
  recStepLine: { width: 2, flex: 1, backgroundColor: BORDER, marginVertical: 4 },
  recStepBody: { flex: 1, paddingBottom: 4 },
  recStepTitle: { fontSize: 15, fontWeight: '700', color: INK, lineHeight: 22 },
  recStepDesc: { fontSize: 13, color: '#444', lineHeight: 20, marginTop: 4 },
  recStepTime: { fontSize: 12, color: MUTED },
  recStepTip: { backgroundColor: '#FFFBEC', borderRadius: 10, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: YELLOW_D },
  recStepTipTxt: { fontSize: 12, color: '#6B4F00', lineHeight: 18 },

  /* Kcal big */
  nutKcalBig: { fontSize: 40, fontWeight: '800', color: INK, lineHeight: 56 },

  /* ── Cooking Mode ──────────────────────────────────────────────────────── */
  cookProgress: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  cookProgressLabel: { fontSize: 12, fontWeight: '600', color: MUTED },
  cookProgressBarBg: { height: 6, borderRadius: 3, backgroundColor: BORDER },
  cookProgressBarFill: { height: 6, borderRadius: 3, backgroundColor: YELLOW_D },

  cookImgWrap: { height: 240, position: 'relative', overflow: 'hidden' },
  cookImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cookDurBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  cookDurTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cookPlayBtn: {
    position: 'absolute', top: '50%', left: '50%',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    marginTop: -28, marginLeft: -28,
  },

  cookStepBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cookStepBadgeTxt: { fontSize: 18, fontWeight: '800', color: INK },
  cookStepTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: INK, lineHeight: 28, paddingTop: 6 },
  cookStepBody: { fontSize: 14, color: '#333', lineHeight: 22, marginTop: 12 },

  /* Cook ingredient chips */
  cookIngCard: { alignItems: 'center', marginRight: 14, width: 68 },
  cookIngImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  cookIngName: { fontSize: 11, color: INK, textAlign: 'center', lineHeight: 15 },

  /* Timer */
  cookTimerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 14, padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cookTimerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cookTimerLabel: { fontSize: 12, color: MUTED, marginBottom: 2 },
  cookTimerVal: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: 1 },
  cookTimerBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: WHITE,
  },
  cookTimerBtnActive: { backgroundColor: YELLOW, borderColor: YELLOW_D },
  cookTimerBtnTxt: { fontSize: 13, fontWeight: '600', color: INK },

  /* Tip box */
  cookTipBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEC', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#F0D890' },
  cookTipIco: { fontSize: 16 },
  cookTipTxt: { flex: 1, fontSize: 13, color: '#6B4F00', lineHeight: 19 },

  /* Cook footer */
  cookFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, gap: 12,
  },
  cookStepListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
  },
  cookStepListTxt: { fontSize: 14, fontWeight: '600', color: INK },
  cookNextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 14, backgroundColor: YELLOW, gap: 6,
  },
  cookNextTxt: { fontSize: 15, fontWeight: '700', color: INK },

  /* Modal backdrop */
  cookModalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    zIndex: 99,
  },
  /* Step list modal */
  cookStepListModal: {
    backgroundColor: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  cookListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  cookListItemActive: { backgroundColor: YELLOW_L, borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 0 },

  /* Exit dialog */
  cookExitDialog: {
    backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  cookExitTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center', marginBottom: 8 },
  cookExitSave: { height: 50, borderRadius: 14, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  cookExitSaveTxt: { fontSize: 15, fontWeight: '700', color: INK },
  cookExitContinue: { height: 50, borderRadius: 14, backgroundColor: CREAM, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  cookExitContinueTxt: { fontSize: 15, fontWeight: '600', color: INK },
  cookExitDiscard: { height: 50, alignItems: 'center', justifyContent: 'center' },
  cookExitDiscardTxt: { fontSize: 14, color: '#E53935' },

});
