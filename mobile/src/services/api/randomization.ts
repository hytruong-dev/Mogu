/**
 * BA-006 Randomization API client
 * Backward-compatible với BA-004 dishesApi.getRandom
 */
import { apiRequest } from './client';

// ── Types ───────────────────────────────────────────────────────────────────────

export interface RandomizationContext {
  currentMealSlot: string;
  suggestedMealSlot: string;
  profileSnapshot: {
    allergenCodes: string[];
    dietTypeCodes: string[];
    hardDietTypeCodes: string[];
    preferenceCodes: string[];
  } | null;
  recentDishIds: string[];
  savedDishIds: string[];
  stats: {
    totalRandom30d: number;
    selectedCount: number;
    selectionRate: number;
  };
  availableGoals: Array<{ id: string; code: string; name: string }>;
  algorithmVersion: string;
  profileVersion: number;
}

export interface RandomDishIngredient {
  rawText: string;
  ingredientName: string | null;
  imageUrl: string | null;
  quantity: number | null;
  unit: string | null;
  groupLabel: string | null;
  isOptional: boolean;
}

export interface RandomDishAllergen {
  id: string;
  name: string;
  code: string;
  level: string;
}

export interface RandomDishNutrition {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  servingName: string | null;
}

export interface RandomDishRecipeStep {
  stepOrder: number;
  instruction: string;
  durationMin: number | null;
  imageUrl: string | null;
}

export interface EatOutPriceDto {
  min: number;
  max: number;
  source: 'NEARBY' | 'DISH';
  sampleCount?: number;
}

export interface RandomDish {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  dineOutPriceMin?: number | null;
  dineOutPriceMax?: number | null;
  eatOutPrice?: EatOutPriceDto | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  originText: string | null;
  ratingAvg: number;
  ratingCount: number;
  difficulty: string | null;
  region: { id: string; name: string } | null;
  mealTypes: Array<{ code: string; name: string }>;
  nutrition: RandomDishNutrition | null;
  ingredients: RandomDishIngredient[];
  allergens: RandomDishAllergen[];
  recipeSteps: RandomDishRecipeStep[];
}

export type RandomFailReasonCode =
  | 'NO_NEARBY_DISH'
  | 'NEARBY_LOOKUP_FAILED'
  | 'INSUFFICIENT_CANDIDATES'
  | 'LOCATION_REQUIRED';

export interface RandomizationExplanation {
  summary: string;
  compatibilityPercent: number;
  factors: string[];
  nutritionHighlight?: string | null;
  matchTags?: string[] | null;
  tip?: string | null;
  fallbackApplied: string[];
  relaxableCriteria: string[];
  /** Có khi dish = null */
  failReasonCode?: RandomFailReasonCode | null;
}

/** Quán (từ backend PlacesService.map) */
export interface ApiPlace {
  id: string;
  provider: string;
  providerPlaceId?: string | null;
  name: string;
  addressShort?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceMeters?: number | null;
  thumbnailUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceRange?: string | null;
  openStatus?: 'OPEN' | 'CLOSED' | 'UNKNOWN' | null;
  sourceUrl?: string | null;
  isVerified?: boolean;
  categoryTags?: string[];
  menuMatchStatus?: 'CONFIRMED' | 'LIKELY' | 'UNKNOWN' | null;
  dishPriceVnd?: number | null;
  sourceItemName?: string | null;
}

/**
 * STRICT: chỉ trả món có quán trong bán kính (không mở rộng, không fallback) — mặc định khi gửi location.
 * PREFER: ưu tiên món gần, cascade 3→5→10km rồi bỏ ràng buộc (dùng cho weekly plan).
 * OFF: bỏ qua vị trí.
 */
export type LocationMode = 'STRICT' | 'PREFER' | 'OFF';

export interface RandomizationNearby {
  mode?: LocationMode;
  requestedRadiusKm: number;
  /** Bán kính thực sự tìm được món (null = không có món trong bán kính / đã random toàn bộ ở PREFER) */
  radiusKm: number | null;
  /** Số quán bán món đã chọn trong bán kính (hoặc tổng số quán quanh user khi dish = null) */
  placeCount: number;
  /** Số quán bán món đã chọn đang mở cửa */
  openCount?: number;
  nearestMeters: number | null;
  /** Số món có quán bán trong bán kính yêu cầu (trước khi lọc hồ sơ) */
  dishCountInRadius?: number;
  fallback: boolean;
  /** HIT | FETCHED | TIMEOUT | SKIPPED — trạng thái làm nóng dữ liệu quán quanh user */
  warmup?: string | null;
  places: ApiPlace[];
}

export interface RandomizationResult {
  randomizationId: string | null;
  dish: RandomDish | null;
  reason: { summary: string; factors: string[] } | null;
  explanation: RandomizationExplanation;
  scoreBreakdown?: Record<string, number>;
  nearby?: RandomizationNearby | null;
}

// ── Request DTOs ────────────────────────────────────────────────────────────────

export interface MealSlotDto {
  slot?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'ANY';
  selectionSource?: string;
}

export interface BudgetDto {
  mode?: 'EXPLICIT_RANGE' | 'ECONOMY_PROFILE' | 'PROFILE_DEFAULT' | 'UNLIMITED';
  minVnd?: number;
  maxVnd?: number;
}

export interface RuntimeOverridesDto {
  goalCodes?: string[];
  dietTypeCodes?: string[];
  weatherCode?: string;
  radiusKm?: number;
  locationMode?: LocationMode;
}

export interface RandomizationRequestDto {
  source?: 'RANDOM_FLOW' | 'RANDOM_AGAIN' | 'HOME_QUICK_RANDOM' | 'WEEKLY_PLAN_SWAP';
  meal?: MealSlotDto;
  budget?: BudgetDto;
  runtimeOverrides?: RuntimeOverridesDto;
  location?: { latitude: number; longitude: number };
  excludeDishIds?: string[];
  // Legacy (backward-compat)
  mealTypeCode?: string;
  goalCodes?: string[];
  maxBudget?: number;
}

export type RecommendationEventType =
  | 'IMPRESSION' | 'OPEN_DETAIL' | 'SELECT' | 'RETRY'
  | 'SAVE' | 'SHARE' | 'DISLIKE' | 'NOT_RELEVANT'
  | 'TOO_EXPENSIVE' | 'TOO_FAR' | 'ALLERGY_CONCERN' | 'DISMISS';

// ── API functions ───────────────────────────────────────────────────────────────

/** BA-006 §4.1 — Lấy context cá nhân hóa trước khi random */
export async function getRandomizationContext(): Promise<RandomizationContext> {
  return apiRequest<RandomizationContext>('/randomization-context');
}

/** BA-006 §4.2 — Random món ăn */
export async function randomizeDish(
  dto: RandomizationRequestDto,
  idempotencyKey?: string,
): Promise<RandomizationResult> {
  const key = idempotencyKey ?? `rand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return apiRequest<RandomizationResult>('/dish-randomizations', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(dto),
  });
}

/** BA-006 §4.3 — Retry random (giữ tiêu chí, loại trừ kết quả cũ) */
export async function retryRandomization(
  randomizationId: string,
  keepCriteria = true,
): Promise<RandomizationResult> {
  return apiRequest<RandomizationResult>(`/dish-randomizations/${randomizationId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ keepCriteria, excludePreviousResult: true }),
  });
}

/** Docs 02 — Xác nhận chọn món (PUT selection) */
export async function selectRandomization(randomizationId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/dish-randomizations/${randomizationId}/selection`, {
    method: 'PUT',
    body: JSON.stringify({}),
  });
}

/** BA-006 §4.5 — Ghi nhận feedback event */
export async function recordRecommendationEvent(
  randomizationId: string,
  eventType: RecommendationEventType,
  reasonCode?: string,
  metadata?: Record<string, any>,
): Promise<void> {
  await apiRequest<void>(`/dish-randomizations/${randomizationId}/events`, {
    method: 'POST',
    body: JSON.stringify({ eventType, reasonCode, metadata }),
  });
}

// ── Image URL helpers ──────────────────────────────────────────────────────────

/**
 * Đảm bảo imageUrl luôn là URL đầy đủ khi có EXPO_PUBLIC_SUPABASE_URL.
 * Backend thường trả URL đầy đủ; path tương đối chỉ resolve khi env được cấu hình.
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const storageBase = (
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
  ).replace(/\/$/, '');

  if (trimmed.startsWith('/storage/')) {
    return `${storageBase}${trimmed}`;
  }
  if (trimmed.startsWith('storage/')) {
    return `${storageBase}/${trimmed}`;
  }
  if (trimmed.startsWith('dishes/')) {
    return `${storageBase}/storage/v1/object/public/dish-images/${trimmed}`;
  }
  if (trimmed.startsWith('ingredient-images/') || trimmed.startsWith('ingredients/')) {
    const subPath = trimmed.replace(/^ingredient-images\//, '');
    return `${storageBase}/storage/v1/object/public/ingredient-images/${subPath}`;
  }
  return trimmed;
}

// ── Meal slot helpers ──────────────────────────────────────────────────────────

export function mealKeyToSlot(key: string): 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'ANY' {
  const map: Record<string, 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'ANY'> = {
    'Sáng': 'BREAKFAST',
    'Trưa': 'LUNCH',
    'Tối': 'DINNER',
    'Bữa phụ': 'SNACK',
    'Bất kỳ': 'ANY',
  };
  return map[key] ?? 'ANY';
}

export function budgetKeyToDto(key: string): BudgetDto {
  if (key === 'Dưới 40K') return { mode: 'EXPLICIT_RANGE', maxVnd: 40000 };
  if (key === '40K–80K' || key === '40K-80K')
    return { mode: 'EXPLICIT_RANGE', minVnd: 40000, maxVnd: 80000 };
  return { mode: 'UNLIMITED' };
}
