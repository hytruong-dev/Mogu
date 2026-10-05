// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export interface Region {
  id: string
  code: string
  name: string
  isActive: boolean
}

export interface Province {
  id: string
  code: string
  name: string
  regionId: string
  region?: Region
}

export interface DishCategory {
  id: string
  code: string
  name: string
  icon?: string
  isActive: boolean
}

export interface MealTypeTag {
  id: string
  code: string
  name: string
}

export interface DietType {
  id: string
  code: string
  name: string
  isVegetarian: boolean
  isVegan: boolean
}

export interface Goal {
  id: string
  code: string
  name: string
}

export interface Allergen {
  id: string
  code: string
  name: string
}

// ─── Ingredient ────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  code: string
  name: string
  nameEn?: string
  description?: string
  groupLabel?: string
  synonyms: string[]
  unit?: string
  allergenCode?: string
  imageUrl?: string
  status?: string
  imageStatus?: string
  enrichment?: Record<string, any>
}

// ─── Dish ─────────────────────────────────────────────────────────────────────

export type DishStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'REJECTED'
  | 'FAILED'
  | 'ARCHIVED'

export type DishDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface DishMedia {
  id: string
  type: 'IMAGE' | 'VIDEO'
  storageKey: string
  bucket: string
  mimeType: string
  sizeBytes: number
  isPrimary: boolean
  publicUrl?: string
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  altText?: string
  credit?: string
}

export interface NutritionProfile {
  id?: string
  calories?: number
  protein?: number
  proteinG?: number
  carbs?: number
  carbsG?: number
  fat?: number
  fatG?: number
  fiber?: number
  fiberG?: number
  sodiumMg?: number
  servingName?: string
  servingG?: number
  basis?: string
  servings?: number
  method?: string
  confidence?: number
  sourceUrl?: string
}

export interface DishIngredient {
  id: string
  ingredientId?: string
  ingredientName?: string
  amount?: number | string
  quantity?: number
  unit?: string
  notes?: string
  isOptional?: boolean
  ingredient?: {
    id: string
    code?: string
    name: string
    nameEn?: string
    description?: string
    groupLabel?: string
    unit?: string
    allergenCode?: string
    imageUrl?: string
    imageStatus?: string
    status?: string
    synonyms?: string[]
  }
}

export interface RecipeStep {
  id: string
  stepOrder: number
  instruction?: string
  durationMin?: number
  imageUrl?: string
  title?: string
  description?: string
  durationMinutes?: number
  tip?: string
  mediaUrl?: string
}

export interface DishSource {
  id?: string
  url: string
  title?: string
  domain?: string
  reliability?: number
  sourceType?: string
  author?: string
}

export interface DishAllergenLinked {
  dishId?: string
  allergenId: string
  level?: string
  confidence?: number
  resolved?: boolean
  resolutionNote?: string
  allergen: {
    id: string
    code: string
    name: string
    iconUrl?: string
  }
}

export interface DishGoalLinked {
  goal: {
    id: string
    code: string
    name: string
  }
}

export interface DishDietTypeLinked {
  dietType: {
    id: string
    code: string
    name: string
  }
}

export interface DishCategoryLinked {
  category: {
    id: string
    code: string
    name: string
    description?: string
    iconUrl?: string
  }
}

export interface DishMealTypeLinked {
  mealTypeTag: {
    id: string
    code: string
    name: string
  }
}

export interface Dish {
  id: string
  name: string
  slug: string
  status: DishStatus
  difficulty?: DishDifficulty
  prepMinutes?: number
  cookMinutes?: number
  servings?: number
  priceMin?: number
  priceMax?: number
  dineOutPriceMin?: number
  dineOutPriceMax?: number
  shortDescription?: string
  fullDescription?: string
  description?: string
  originText?: string
  primaryMealSlot?: string
  dishType?: string
  videoUrl?: string
  recipeTitle?: string
  alternateNames?: string[]
  flavorTags?: string[]
  isFeatured?: boolean
  ratingAvg?: number
  ratingCount?: number
  version: number
  confidenceScore?: number
  viewCount: number
  createdAt: string
  updatedAt: string
  media?: DishMedia[]
  nutrition?: NutritionProfile
  nutritionProfiles?: NutritionProfile[]
  dishIngredients?: DishIngredient[]
  dishAllergens?: DishAllergenLinked[]
  recipeSteps?: RecipeStep[]
  sources?: DishSource[]
  region?: Region
  province?: Province
  categories?: Array<DishCategory | DishCategoryLinked>
  mealTypes?: Array<MealTypeTag | DishMealTypeLinked>
  dietTypes?: DishDietTypeLinked[]
  dishGoals?: DishGoalLinked[]
}

export interface DishListResponse {
  data: Dish[]
  nextCursor?: string
  total?: number
}

// ─── Import Job ────────────────────────────────────────────────────────────────

export type ImportJobStatus =
  | 'PENDING'
  | 'SEARCHING'
  | 'EXTRACTING'
  | 'NORMALIZING'
  | 'RECONCILING'
  | 'ENRICHING'
  | 'DRAFTING'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED'

export interface ImportJobLog {
  step: string
  stepIndex: number
  message: string
  detail?: string
  timestamp: string
}

export interface ImportJob {
  id: string
  query: string
  relatedKeywords?: string[]
  regionHint?: string
  status: ImportJobStatus
  currentStep: number
  totalSteps: number
  progress: number
  currentStepName?: string
  currentStepMessage?: string
  resultDishId?: string
  suggestedImageUrl?: string
  /** Số nguyên liệu mới tự động tìm (PENDING_REVIEW) cần duyệt trước khi gửi duyệt món. */
  pendingIngredientCount?: number
  errorMessage?: string
  sourceTypes: string[]
  createdAt: string
  updatedAt?: string
  completedAt?: string
  logs?: ImportJobLog[]
}

export interface WsJobProgress {
  jobId: string
  status: ImportJobStatus
  step: string
  stepIndex: number
  totalSteps: number
  progress: number
  message: string
  resultDishId?: string
  suggestedImageUrl?: string
  errorMessage?: string
}

// ─── Review Queue ──────────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  id: string
  name: string
  status: DishStatus
  confidenceScore?: number
  submittedAt?: string
  updatedAt?: string
  region?: Region
  categories?: Array<{ category: { code: string; name: string } }>
  media?: DishMedia[]
  nutritionProfiles?: NutritionProfile[]
  fieldEvidences?: FieldEvidence[]
  _count?: {
    ingredients?: number
    steps?: number
    media?: number
  }
}

export interface FieldEvidence {
  id: string
  field: string
  value: string
  sourceUrl?: string
  confidence: number
  isResolved: boolean
}

export type ReviewReasonCode =
  | 'INSUFFICIENT_SOURCE'
  | 'CONFLICTING_DATA'
  | 'WRONG_DISH'
  | 'NUTRITION_RISK'
  | 'ALLERGEN_RISK'
  | 'COPYRIGHT_RISK'
  | 'DUPLICATE'
  | 'CONTENT_QUALITY'

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface DishWarehouseSummary {
  total: number
  published: number
  pendingReview: number
  draft: number
}

export interface CursorPage<T> {
  data: T[]
  // Backend trả về nextCursor ở 2 nơi tùy API version
  nextCursor?: string
  hasMore?: boolean
  // Backend mới trả về pageInfo object
  pageInfo?: {
    nextCursor?: string
    hasNextPage?: boolean
  }
  total?: number
  summary?: DishWarehouseSummary
}
