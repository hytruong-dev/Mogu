export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface FieldWarning {
  code: string;
  fieldPath: string;
  message: string;
  severity: 'WARNING' | 'REVIEW_BLOCKING' | 'BLOCKING';
}

export interface TaxonomyItem {
  id: string;
  code: string;
  name: string;
  aliases?: string[];
  description?: string | null;
}

export interface TaxonomyProvince extends TaxonomyItem {
  regionId: string;
}

export interface TaxonomySnapshot {
  version: string;
  createdAt: string;
  regions: TaxonomyItem[];
  provinces: TaxonomyProvince[];
  categories: TaxonomyItem[];
  mealTypes: TaxonomyItem[];
  goals: TaxonomyItem[];
  dietTypes: TaxonomyItem[];
  flavors: TaxonomyItem[];
  dishTypes: TaxonomyItem[];
  units: string[];
}

export interface OriginCandidate {
  originText?: string | null;
  regionCode?: string | null;
  provinceCode?: string | null;
  isRegionalSpecialty: boolean;
  confidence: number;
  reason?: string | null;
}

export interface PriceRange {
  min: number | null;
  max: number | null;
  /** WHOLE_RECIPE = toàn công thức, PER_SERVING = 1 phần. */
  basis: 'WHOLE_RECIPE' | 'PER_SERVING';
}

/** Tách giá nguyên liệu nấu tại nhà và giá ăn ngoài quán (schema 1.1, optional). */
export interface PricingCandidate {
  homeCook?: PriceRange | null;
  dineOut?: PriceRange | null;
  note?: string | null;
}

export interface DishClassificationCandidate {
  categoryCodes: string[];
  mealTypeCodes: string[];
  goalCodes: string[];
  dietTypeCodes: string[];
  flavorCodes: string[];
  dishTypeCode?: string | null;
  confidenceByField: Record<string, number>;
}

export interface ExtractedIngredient {
  rawText: string;
  name: string;
  canonicalNameCandidate?: string | null;
  quantity?: number | null;
  quantityTo?: number | null;
  quantityText?: string | null;
  unitCode?: string | null;
  specification?: string | null;
  preparation?: string | null;
  group?: string | null;
  optional: boolean;
  normalizedWeightGram?: number | null;
  /** Metadata từ parser (vd quantityDefaulted khi không bắt được số). */
  parseMetadata?: { quantityDefaulted?: boolean } | null;
}

export interface ExtractedRecipeStep {
  stepNumber: number;
  title: string;
  description: string;
  durationMinutes?: number | null;
  tips?: string | null;
}

export interface ExtractedRecipe {
  title: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: Difficulty;
  steps: ExtractedRecipeStep[];
}

export interface DishExtractionV11 {
  schemaVersion: '1.1';
  basic: {
    name: string;
    alternateNames: string[];
    shortDescription: string;
    fullDescription?: string | null;
    difficulty: Difficulty;
    prepMinutes: number;
    cookMinutes: number;
    servings: number;
    servingSize?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    pricing?: PricingCandidate | null;
    origin: OriginCandidate;
  };
  classification: DishClassificationCandidate;
  ingredients: ExtractedIngredient[];
  recipe: ExtractedRecipe;
  generalTips?: string[];
}

/** Bằng chứng công thức từ nguồn uy tín (Schema.org Recipe) để AI chuẩn hóa thay vì bịa. */
export interface RecipeEvidence {
  sourceUrl: string;
  sourceDomain?: string | null;
  title?: string | null;
  description?: string | null;
  ingredients: string[];
  steps: Array<{ title?: string | null; text: string; imageUrls?: string[] }>;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  nutrition?: Record<string, number | null> | null;
}

export interface IngredientCandidate {
  id: string;
  name: string;
  aliases?: string[];
  attributes?: {
    vegan?: boolean;
    vegetarian?: boolean;
    glutenFree?: boolean;
    flavors?: string[];
  };
}

export interface IngredientResolution {
  rawText: string;
  parsed: ExtractedIngredient;
  matchedIngredientId?: string | null;
  matchMethod: 'EXACT' | 'ALIAS' | 'NORMALIZED' | 'FUZZY' | 'NONE';
  confidence: number;
  candidates?: Array<{ ingredientId: string; name: string; score: number }>;
}

export interface InvalidField {
  path: string;
  reason: string;
}

export interface TargetedRepairRequest {
  jobId: string;
  dishContext: { name: string; existingValidData: unknown };
  invalidFields: InvalidField[];
}
