/**
 * DishDetailLoaderScreen — tải món từ API rồi render FoodDetailFlowScreen V2.
 * Không dùng ảnh/dữ liệu mock.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dishesApi } from '../services/api/dishes';
import { normalizeImageUrl } from '../services/api/randomization';
import { formatApiErrorWithCode } from '../lib/api-error';
import { DetailSkeleton } from '../components/skeletons/ScreenSkeletons';
import { FoodDetailFlowScreen } from './FoodDetailFlowScreen';

/** Session-level debounce: 1 view log per dishId */
const viewedDishIds = new Set<string>();

type Props = {
  route: { params: { dishId: string; title?: string; mealLabel?: string } };
  navigation: { goBack: () => void };
};

function buildDishImageUrl(dish: any): string | null {
  if (dish?.imageUrl) return normalizeImageUrl(dish.imageUrl);
  if (dish?.thumbnailUrl) return normalizeImageUrl(dish.thumbnailUrl);
  const media = (dish?.media ?? []) as Array<{
    publicUrl?: string;
    storageKey?: string;
    bucket?: string;
    isPrimary?: boolean;
  }>;
  const primary = media.find((m) => m.isPrimary) ?? media[0];
  if (!primary) return null;
  if (primary.publicUrl) return normalizeImageUrl(primary.publicUrl);
  if (primary.storageKey) {
    const base = (
      globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const bucket = primary.bucket ?? 'dish-images';
    if (base) return `${base}/storage/v1/object/public/${bucket}/${primary.storageKey}`;
  }
  return null;
}

export default function DishDetailLoaderScreen({ route, navigation }: Props) {
  const { dishId, mealLabel } = route.params;
  const [dish, setDish] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loggedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loggedRef.current = false;
    setLoading(true);
    setError(null);
    dishesApi
      .getById(dishId)
      .then((d) => {
        if (cancelled) return;
        setDish(d);
        if (!loggedRef.current) {
          loggedRef.current = true;
          dishesApi.logView(dishId, 'food_detail').catch(() => undefined);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(formatApiErrorWithCode(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dishId]);

  const mapped = useMemo(() => {
    if (!dish) return null;
    const imageUrl = buildDishImageUrl(dish);
    const nutritionRaw = dish.nutrition ?? dish.nutritionProfiles?.[0] ?? null;
    const ingredients = (dish.dishIngredients ?? dish.ingredients ?? []).map((ing: any) => ({
      id: ing.ingredientId ?? ing.ingredient?.id ?? ing.id,
      rawText: ing.rawText ?? ing.name ?? '',
      ingredientName: ing.ingredient?.name ?? ing.parsedName ?? ing.ingredientName ?? null,
      imageUrl: normalizeImageUrl(ing.ingredient?.imageUrl ?? ing.imageUrl ?? null),
      quantity: ing.quantity != null ? Number(ing.quantity) : null,
      unit: ing.unit ?? null,
      groupLabel: ing.groupLabel ?? null,
      isOptional: Boolean(ing.isOptional),
      note: ing.note ?? null,
    }));
    const allergens = (dish.dishAllergens ?? dish.allergens ?? []).map((a: any) => ({
      id: String(a.allergen?.id ?? a.id ?? a.code ?? a.allergenCode ?? ''),
      name: a.allergen?.name ?? a.name ?? a.allergenName ?? '',
      code: a.allergen?.code ?? a.code ?? a.allergenCode ?? '',
      level: a.level ?? 'UNKNOWN',
    }));
    const recipeSteps = (dish.recipeSteps ?? []).map((rs: any) => ({
      id: rs.id,
      stepOrder: rs.stepOrder,
      title: rs.title ?? null,
      instruction: rs.instruction ?? '',
      durationMin: rs.durationMin ?? null,
      imageUrl: normalizeImageUrl(rs.imageUrl ?? null),
      videoUrl: rs.videoUrl ?? null,
      ingredientIds: rs.ingredientIds ?? undefined,
    }));
    const mealTypes = (dish.mealTypes ?? []).map((m: any) => ({
      code: m.mealTypeTag?.code ?? m.code,
      name: m.mealTypeTag?.name ?? m.name,
    }));
    const mealFromTypes = mealTypes[0]?.name;
    return {
      dishId: dish.id,
      dishName: dish.name,
      dishImage: imageUrl ? { uri: imageUrl } : undefined,
      ratingAvg: dish.ratingAvg != null ? Number(dish.ratingAvg) : undefined,
      ratingCount: dish.ratingCount != null ? Number(dish.ratingCount) : undefined,
      isSaved: Boolean(dish.isSaved),
      meal: mealLabel ?? mealFromTypes ?? 'Bữa ăn',
      priceMin: dish.priceMin != null ? Number(dish.priceMin) : null,
      priceMax: dish.priceMax != null ? Number(dish.priceMax) : null,
      prepMinutes: dish.prepMinutes ?? null,
      cookMinutes: dish.cookMinutes ?? null,
      servings: dish.servings != null ? Number(dish.servings) : null,
      shortDescription: dish.shortDescription ?? dish.description ?? null,
      originText: dish.originText ?? dish.region?.name ?? null,
      nutrition: nutritionRaw
        ? {
            calories: nutritionRaw.calories != null ? Number(nutritionRaw.calories) : null,
            proteinG: nutritionRaw.proteinG != null ? Number(nutritionRaw.proteinG) : null,
            carbsG:
              nutritionRaw.carbsG != null
                ? Number(nutritionRaw.carbsG)
                : nutritionRaw.carbG != null
                  ? Number(nutritionRaw.carbG)
                  : null,
            fatG: nutritionRaw.fatG != null ? Number(nutritionRaw.fatG) : null,
            fiberG: nutritionRaw.fiberG != null ? Number(nutritionRaw.fiberG) : null,
            sugarG: nutritionRaw.sugarG != null ? Number(nutritionRaw.sugarG) : null,
            sodiumMg: nutritionRaw.sodiumMg != null ? Number(nutritionRaw.sodiumMg) : null,
            cholesterolMg:
              nutritionRaw.cholesterolMg != null ? Number(nutritionRaw.cholesterolMg) : null,
            saturatedFatG:
              nutritionRaw.saturatedFatG != null ? Number(nutritionRaw.saturatedFatG) : null,
            servingName: nutritionRaw.servingName ?? null,
          }
        : null,
      ingredients,
      allergens,
      recipeSteps,
      difficulty: dish.difficulty ?? null,
      videoUrl: dish.videoUrl ?? dish.recipeVideoUrl ?? null,
      nearbyPlaces: [],
      mealTypes,
    };
  }, [dish, mealLabel]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF9E8' }} edges={['top']}>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !mapped) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#FFF9E8',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        edges={['top']}
      >
        <Text style={{ color: '#B91C1C', textAlign: 'center', fontWeight: '600' }}>
          {error ?? 'Không tìm thấy món ăn'}
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 16,
            backgroundColor: '#FFD54F',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontWeight: '700' }}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <FoodDetailFlowScreen
      dishId={mapped.dishId}
      dishName={mapped.dishName}
      dishImage={mapped.dishImage}
      ratingAvg={mapped.ratingAvg}
      ratingCount={mapped.ratingCount}
      isSaved={mapped.isSaved}
      meal={mapped.meal}
      priceMin={mapped.priceMin}
      priceMax={mapped.priceMax}
      prepMinutes={mapped.prepMinutes}
      cookMinutes={mapped.cookMinutes}
      servings={mapped.servings}
      shortDescription={mapped.shortDescription}
      originText={mapped.originText}
      nutrition={mapped.nutrition}
      ingredients={mapped.ingredients}
      allergens={mapped.allergens}
      recipeSteps={mapped.recipeSteps}
      difficulty={mapped.difficulty}
      videoUrl={mapped.videoUrl}
      nearbyPlaces={mapped.nearbyPlaces}
      mealTypes={mapped.mealTypes}
      onClose={() => navigation.goBack()}
      onFinish={() => navigation.goBack()}
    />
  );
}
