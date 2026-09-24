/**
 * Food Detail Flow V2 — khớp docs/MOBILE_FOOD_DETAIL_UX_REDESIGN_2026.md
 */
import { useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RotateCcw } from 'lucide-react-native';
import { OverviewPage } from './food-detail/OverviewPage';
import { RecipePage } from './food-detail/RecipePage';
import { CookingPage } from './food-detail/CookingPage';
import { NearbyPage } from './food-detail/NearbyPage';
import type { FoodDetailFlowProps, FoodDetailPage } from './food-detail/types';
import { CREAM, INK, MUTED, WHITE, YELLOW, BORDER } from './food-detail/tokens';
import { formatKcalLabel, formatPriceLabel, formatTimeLabel } from './food-detail/utils';

export type { FoodDetailPage, FoodDetailFlowProps };
export type { FoodDetailFlowProps as Props };

export function FoodDetailFlowScreen({
  initialPage = 'overview',
  dishId,
  dishName = 'Món ăn',
  dishImage,
  isSaved,
  meal = 'Bữa ăn',
  priceMin,
  priceMax,
  prepMinutes,
  cookMinutes,
  servings,
  shortDescription,
  nutrition,
  ingredients = [],
  allergens = [],
  recipeSteps = [],
  difficulty,
  videoUrl,
  nearbyPlaces = [],
  explanation,
  onClose,
  onRandomAgain,
  onFinish,
}: FoodDetailFlowProps) {
  const [page, setPage] = useState<FoodDetailPage>(initialPage);
  const history = useRef<FoodDetailPage[]>([]);
  const image: ImageSourcePropType | undefined = dishImage;

  const go = (next: FoodDetailPage) => {
    history.current.push(page);
    setPage(next);
  };
  const back = () => {
    const prev = history.current.pop();
    if (prev) setPage(prev);
    else onClose();
  };

  const priceLabel = formatPriceLabel(priceMin, priceMax);
  const timeLabel = formatTimeLabel(prepMinutes, cookMinutes);
  const kcal = formatKcalLabel(nutrition?.calories ?? null);

  if (page === 'nutrition' || page === 'recipe') {
    return (
      <RecipePage
        dishId={dishId}
        dishName={dishName}
        image={image}
        isSavedInitial={isSaved}
        servings={servings}
        timeLabel={timeLabel}
        difficulty={difficulty}
        nutrition={nutrition}
        ingredients={ingredients}
        recipeSteps={recipeSteps}
        videoUrl={videoUrl}
        onBack={back}
        onStartCook={() => go('cooking')}
      />
    );
  }

  if (page === 'cooking') {
    return (
      <CookingPage
        dishName={dishName}
        image={image}
        ingredients={ingredients}
        recipeSteps={recipeSteps}
        onBack={back}
        onFinish={onFinish ?? onClose}
      />
    );
  }

  if (page === 'location') {
    return (
      <NearbyPage
        dishName={dishName}
        places={nearbyPlaces}
        onBack={back}
      />
    );
  }

  if (page === 'confirmed') {
    return (
      <ConfirmedSimple
        dishName={dishName}
        image={image}
        onClose={onFinish ?? onClose}
        onBack={back}
      />
    );
  }

  if (page === 'result') {
    return (
      <ResultSimple
        dishName={dishName}
        image={image}
        meal={meal}
        priceLabel={priceLabel}
        timeLabel={timeLabel}
        kcal={kcal}
        summary={explanation?.summary}
        onBack={onClose}
        onAgain={onRandomAgain ?? onClose}
        onChoose={() => go('overview')}
      />
    );
  }

  return (
    <OverviewPage
      dishId={dishId}
      dishName={dishName}
      image={image}
      isSavedInitial={isSaved}
      shortDescription={shortDescription}
      priceLabel={priceLabel}
      timeLabel={timeLabel}
      nutrition={nutrition}
      allergens={allergens}
      ingredientCount={ingredients.length}
      stepCount={recipeSteps.length}
      onBack={back}
      onCook={() => go('nutrition')}
      onNearby={() => go('location')}
    />
  );
}

function ResultSimple({
  dishName,
  image,
  meal,
  priceLabel,
  timeLabel,
  kcal,
  summary,
  onBack,
  onAgain,
  onChoose,
}: {
  dishName: string;
  image?: ImageSourcePropType;
  meal: string;
  priceLabel: string | null;
  timeLabel: string | null;
  kcal: string | null;
  summary?: string;
  onBack: () => void;
  onAgain: () => void;
  onChoose: () => void;
}) {
  const meta = [meal, priceLabel, timeLabel, kcal].filter(Boolean).join(' · ');
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.top}>
        <Pressable onPress={onBack} style={s.iconBtn}>
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <Pressable onPress={onAgain} style={s.iconBtn}>
          <RotateCcw size={20} color={INK} />
        </Pressable>
          </View>
      <View style={s.center}>
        <Text style={s.eyebrow}>Mogu chọn cho bạn</Text>
        {image ? (
          <Image source={image} style={s.resultImg} resizeMode="cover" />
        ) : (
          <View style={[s.resultImg, { backgroundColor: BORDER }]} />
        )}
        <Text style={s.resultName}>{dishName}</Text>
        {meta ? <Text style={s.meta}>{meta}</Text> : null}
        {summary ? <Text style={s.summary}>{summary}</Text> : null}
          </View>
      <Pressable onPress={onChoose} style={s.cta}>
        <Text style={s.ctaText}>Xem chi tiết món</Text>
              </Pressable>
    </SafeAreaView>
  );
}

function ConfirmedSimple({
  dishName,
  image,
  onClose,
  onBack,
}: {
  dishName: string;
  image?: ImageSourcePropType;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.top}>
        <Pressable onPress={onBack} style={s.iconBtn}>
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <View style={s.iconBtn} />
      </View>
      <View style={s.center}>
        {image ? (
          <Image source={image} style={s.resultImg} resizeMode="cover" />
        ) : null}
        <Text style={s.resultName}>{dishName}</Text>
        <Text style={s.summary}>Đã chọn món. Chúc bạn ngon miệng!</Text>
            </View>
      <Pressable onPress={onClose} style={s.cta}>
        <Text style={s.ctaText}>Hoàn tất</Text>
        </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', height: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: MUTED },
  resultImg: { width: 220, height: 160, borderRadius: 16 },
  resultName: { fontSize: 24, fontWeight: '800', color: INK, textAlign: 'center' },
  meta: { fontSize: 14, color: MUTED, textAlign: 'center' },
  summary: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  cta: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: INK },
});
