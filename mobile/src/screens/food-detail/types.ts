import type { ImageSourcePropType } from 'react-native';

export type FoodDetailPage =
  | 'overview'
  | 'nutrition'
  | 'recipe'
  | 'community'
  | 'confirmed'
  | 'location'
  | 'result'
  | 'cooking';

export type Explanation = {
  summary: string;
  compatibilityPercent: number;
  factors: string[];
  nutritionHighlight?: string | null;
  matchTags?: string[] | null;
  tip?: string | null;
  fallbackApplied?: string[];
} | null;

export type DishIngredient = {
  id?: string;
  rawText: string;
  ingredientName: string | null;
  imageUrl: string | null;
  quantity: number | null;
  unit: string | null;
  groupLabel: string | null;
  isOptional: boolean;
  note?: string | null;
};

export type DishAllergen = {
  id: string;
  name: string;
  code: string;
  level: string;
};

export type DishNutrition = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  cholesterolMg?: number | null;
  saturatedFatG?: number | null;
  servingName: string | null;
};

export type DishRecipeStep = {
  id?: string;
  stepOrder: number;
  title?: string | null;
  instruction: string;
  durationMin: number | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  ingredientIds?: string[];
};

export type AllergenAssessmentStatus = 'CONTAINS' | 'NOT_DETECTED' | 'UNKNOWN';

export type AllergenAssessment = {
  status: AllergenAssessmentStatus;
  allergens: DishAllergen[];
  label: string;
  detail?: string;
};

export type NearbyPlace = {
  placeId: string;
  name: string;
  coordinates?: { lat: number; lng: number } | null;
  distanceMeters?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  priceRange?: string | null;
  openStatus?: 'OPEN' | 'CLOSED' | 'UNKNOWN' | null;
  imageUrl?: string | null;
  menuMatchStatus?: 'CONFIRMED' | 'LIKELY' | 'UNKNOWN' | null;
  directionsDeepLink?: string | null;
};

export type FoodDetailFlowProps = {
  initialPage?: FoodDetailPage;
  dishId?: string;
  dishName?: string;
  dishImage?: ImageSourcePropType;
  ratingAvg?: number;
  ratingCount?: number;
  isSaved?: boolean;
  meal?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  servings?: number | null;
  shortDescription?: string | null;
  originText?: string | null;
  nutrition?: DishNutrition | null;
  ingredients?: DishIngredient[];
  allergens?: DishAllergen[];
  recipeSteps?: DishRecipeStep[];
  difficulty?: string | null;
  videoUrl?: string | null;
  nearbyPlaces?: NearbyPlace[];
  mealTypes?: Array<{ code: string; name: string }>;
  explanation?: Explanation;
  onClose: () => void;
  onRandomAgain?: () => void;
  onFinish?: () => void;
};
