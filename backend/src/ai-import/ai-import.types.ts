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
    origin: OriginCandidate;
  };
  classification: DishClassificationCandidate;
  ingredients: ExtractedIngredient[];
  recipe: ExtractedRecipe;
  generalTips?: string[];
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
