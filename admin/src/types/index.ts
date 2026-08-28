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
  synonyms: string[]
  unit?: string
  allergenCode?: string
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
  id: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  method: string
}

export interface DishIngredient {
  id: string
  ingredientId?: string
  ingredientName: string
  quantity?: number
  unit?: string
  isOptional: boolean
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
  description?: string
  version: number
  confidenceScore?: number
  viewCount: number
  createdAt: string
  updatedAt: string
  media?: DishMedia[]
  nutritionProfiles?: NutritionProfile[]
  dishIngredients?: DishIngredient[]
  region?: Region
  province?: Province
  categories?: DishCategory[]
  mealTypes?: MealTypeTag[]
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
  region?: Region
  media?: DishMedia[]
  nutritionProfiles?: NutritionProfile[]
  fieldEvidences?: FieldEvidence[]
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
