export type NextStep = 'verify_otp' | 'onboarding' | 'onboarding_resume' | 'home' | 'HOME';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number; // Unix timestamp (ms) — thời điểm token hết hạn
};

export type AuthUser = {
  id?: string;
  userId?: string;
  email?: string;
  displayName?: string | null;
  onboardingStatus?: string;
  onboardingStep?: number;
  profileVersion?: number;
  [key: string]: unknown;
};

export type AuthResult = { session: Session; user: AuthUser; nextStep: NextStep };

export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type?: string;
  displayOrder: number;
};

export type OnboardingCatalog = {
  version: string;
  goals: CatalogItem[];
  dietaryPreferences: { taste: CatalogItem[]; diet: CatalogItem[] };
  allergens: CatalogItem[];
};

export type OnboardingState = {
  onboardingStatus: string;
  currentStep: number;
  totalSteps: number;
  profileVersion: number;
  draft: Record<string, unknown>;
};

// ─── BA-003: Home Dashboard ───────────────────────────────────────────────────

export type Greeting = {
  phrase: string;
  name: string;
  full: string;
};

export type RecommendationItem = {
  dishId: string;
  name: string;
  imageUrl: string | null;
  calories: number;
  prepMinutes: number;
  priceRange: string | null;
  reasonShort: string;
  isSaved: boolean;
};

export type NutritionSummary = {
  date: string;
  dataStatus: 'no_data' | 'partial' | 'complete';
  caloriesConsumed?: number;
  calorieTarget?: number;
  proteinG?: number;
  waterMl?: number;
};

export type HomeWidgets = {
  greeting?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: { text: string; timeOfDay: string } | null;
  };
  weather?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: { condition: string; temperatureC: number; suggestionText: string } | null;
  };
  weeklyPlan?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: {
      planId?: string;
      status?: string;
      todayMealsCount: number;
      completedMealsCount: number;
      remainingBudgetVnd: number;
    } | null;
  };
  nutrition?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: {
      consumedKcal: number;
      targetKcal: number;
      remainingKcal: number;
      waterMl: number;
      waterTargetMl: number;
    } | null;
  };
  recommendations?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: Array<{
      id: string;
      name: string;
      imageUrl?: string;
      energyKcal: number;
      priceMin?: number;
      cookingTimeMinutes: number;
      isSaved: boolean;
    }> | null;
  };
  notifications?: {
    status: 'ok' | 'unavailable' | 'no_data' | 'error';
    data?: { unreadCount: number } | null;
  };
};

export type HomeDashboard = {
  generatedAt: string;
  localDate: string;
  cacheTtl: number;
  profileVersion: number;

  widgets?: HomeWidgets;

  greetingStatus: 'ok' | 'error';
  greeting: Greeting | null;

  recommendationsStatus: 'ok' | 'error' | 'empty';
  recommendations: RecommendationItem[];

  nutritionStatus: 'ok' | 'error' | 'empty';
  nutritionSummary: NutritionSummary | null;

  notificationStatus: 'ok' | 'error';
  unreadCount: number;
};

// ─── BA-003: Recommendations ──────────────────────────────────────────────────

export type RecommendationListResponse = {
  data: RecommendationItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

// ─── BA-003: Dishes ───────────────────────────────────────────────────────────

export type SaveDishResponse = {
  dishId: string;
  saved: true;
  savedAt: string;
};

export type UnsaveDishResponse = {
  dishId: string;
  saved: false;
};

// ─── BA-003: Nutrition ────────────────────────────────────────────────────────

export type NutritionToday = {
  date: string;
  dataStatus: 'no_data' | 'partial' | 'complete';
  caloriesConsumed?: number;
  calorieTarget?: number;
  proteinG?: number;
  mealsLogged?: number;
};

// ─── BA-003: Notifications ────────────────────────────────────────────────────

export type UnreadCountResponse = {
  count: number;
};

export type NotificationItem = {
  id: string;
  type: 'SYSTEM' | 'PROMO' | 'REMINDER' | 'ACHIEVEMENT';
  title: string;
  body: string;
  deepLink: string | null;
  imageUrl: string | null;
  status: 'UNREAD' | 'READ';
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  data: NotificationItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

// ─── Weather ──────────────────────────────────────────────────────────────────

export type WeatherIconCode = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'unknown';

export type WeatherData = {
  tempC: number;
  description: string;
  iconCode: WeatherIconCode;
};

// ─── BA-003: Goals Catalog ────────────────────────────────────────────────────

export type GoalItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
};

export type GoalCatalogResponse = {
  version: string;
  goals: GoalItem[];
};

// ─────────────────────────────────────────────────────────────────────────────

// ─── BA-004: Dishes ───────────────────────────────────────────────────────────

export type DishStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'PENDING_PUBLICATION';

export type Dish = {
  id: string;
  name: string;
  slug: string;
  status: DishStatus;
  description: string | null;
  thumbnailUrl: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  priceMin: number | null;
  priceMax: number | null;
  isSaved?: boolean;
  version: number;

  // Nutrition (from nutritionProfiles)
  calories?: number;
  proteinG?: number;
  carbG?: number;
  fatG?: number;

  // Relations
  region?: { id: string; code: string; name: string } | null;
  province?: { id: string; name: string } | null;
  category?: { id: string; code: string; name: string } | null;
  categories?: { id: string; code: string; name: string }[];
  mealTypes?: { id: string; code: string; name: string }[];
  allergens?: { allergenCode: string; allergenName?: string }[];
  media?: { storageKey: string; mediaType: string; bucket?: string; isPrimary?: boolean }[];
  nutritionProfiles?: { calories?: number; proteinG?: number; carbG?: number; fatG?: number }[];
};

export type DishListResponse = {
  data: Dish[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type DishSearchParams = {
  q?: string;
  status?: DishStatus;
  regionCode?: string;
  categoryCode?: string;
  categoryCodes?: string[];
  mealTypeCode?: string;
  mealTypeCodes?: string[];
  dietTypeCodes?: string[];
  goalCodes?: string[];
  maxBudget?: number;
  sort?: 'relevance' | 'popular' | 'newest';
  cursor?: string;
  limit?: number;
};

// ─── BA-004: Reviews ──────────────────────────────────────────────────────────

export type Review = {
  id: string;
  dishId: string;
  userId: string;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export type ReviewListResponse = {
  data: Review[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

// Mapping đúng với RandomizationRequestDto backend
export type RandomDishRequest = {
  mealTypeCode?: string;       // 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
  goalCodes?: string[];        // ['LOSE_WEIGHT', 'GAIN_MUSCLE', ...]
  dietTypeCodes?: string[];    // chế độ ăn bổ sung
  excludeDishIds?: string[];   // UUIDs món đã thấy (tránh lặp)
  maxBudget?: number;          // ngân sách tối đa (VND)
  weatherCode?: string;        // 'RAIN' | 'SUNNY' | ...
};

export type RandomDishResponse = {
  randomizationId: string;
  dish: Dish;
  reason: string | { short: string; detail?: string };
  scoreBreakdown?: Record<string, number>;
};

export type SavedDishesResponse = {
  data: Dish[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

// ── BA-005: Weekly Meal Plan types ─────────────────────────────────────────────

export type WeeklyMealSlot = 'MORNING' | 'LUNCH' | 'DINNER' | 'SNACK';
export type WeeklyKcalMode = 'PROFILE' | 'CUSTOM';
export type WeeklyPlanStatus =
  | 'GENERATING'
  | 'READY'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ARCHIVED';
export type WeeklyPlanSlotStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED';
export type WeeklyPlanSwapReason =
  | 'USER_REQUEST'
  | 'REBALANCE_BUDGET'
  | 'REBALANCE_CALORIES'
  | 'DISH_UNAVAILABLE'
  | 'DIET_CONFLICT'
  | 'OTHER';

export type WeeklyPlanConfig = {
  id: string | null;
  userId: string;
  budgetVnd: number;
  kcalPerDay: number;
  kcalMode: WeeklyKcalMode;
  durationDays: number;
  mealsPerDay: number;
  enabledSlots: WeeklyMealSlot[];
  avoidRepeat: boolean;
  preferHomeCook: boolean;
  calorieTolerancePercent: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpsertWeeklyPlanConfigDto = {
  budgetVnd: number;
  kcalPerDay: number;
  kcalMode?: WeeklyKcalMode;
  durationDays?: number;
  mealsPerDay?: number;
  enabledSlots?: WeeklyMealSlot[];
  avoidRepeat?: boolean;
  preferHomeCook?: boolean;
  calorieTolerancePercent?: number;
};

export type WeeklyPlanSlotDish = {
  id: string;
  name: string;
  imageUrl: string | null;
  priceVnd: number;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type WeeklyPlanSlot = {
  id: string;
  mealSlot: WeeklyMealSlot;
  status: WeeklyPlanSlotStatus;
  isLocked: boolean;
  swapCount: number;
  version: number;
  dish: WeeklyPlanSlotDish;
  actualCostVnd: number | null;
  actualKcal: number | null;
  completedAt: string | null;
  skippedAt: string | null;
};

export type WeeklyPlanDay = {
  date: string; // ISO date 'YYYY-MM-DD'
  slots: WeeklyPlanSlot[];
};

export type WeeklyPlan = {
  id: string;
  status: WeeklyPlanStatus;
  startDate: string;
  endDate: string;
  budgetLimitVnd: number;
  projectedCostVnd: number;
  actualSpentVnd: number;
  targetKcal: number;
  projectedKcal: number;
  actualKcal: number;
  algorithmVersion: string;
  generationErrorCode: string | null;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  days: WeeklyPlanDay[];
};

export type WeeklyPlanSummary = {
  id: string;
  status: WeeklyPlanStatus;
  startDate: string;
  endDate: string;
  projectedCostVnd: number;
  budgetLimitVnd: number;
  projectedKcal: number;
  targetKcal: number;
  slotCount: number;
  createdAt: string;
};

export type WeeklyPlanGenerateResponse = {
  planId: string;
  status: WeeklyPlanStatus;
};

export type WeeklyPlanListResponse = {
  items: WeeklyPlanSummary[];
  nextCursor: string | null;
};

export type WeeklyPlanSlotSwapDto = {
  newDishId?: string;
  reason?: WeeklyPlanSwapReason;
  version: number;
};

// ── End BA-005 types ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
