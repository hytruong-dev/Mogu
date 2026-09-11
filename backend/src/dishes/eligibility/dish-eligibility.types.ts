import { Prisma } from '@prisma/client';

export type EligibilitySurface = 'random' | 'weekly' | 'swap' | 'home';

export interface EligibilityProfile {
  allergenCodes: string[];
  hardDietTypeCodes: string[];
  softDietTypeCodes?: string[];
  avoidedIngredients: string[]; // lowercase names / aliases
}

export interface SoftFilterOptions {
  mealTypeCodes?: string[];
  maxPriceMin?: number;
  /** When true, require priceMin not null (hard-budget plans) */
  requirePrice?: boolean;
  excludeDishIds?: string[];
  softExcludeMayContain?: boolean;
}

export class DishNotEligibleError extends Error {
  constructor(
    readonly code: string,
    readonly reason: string,
  ) {
    super(reason);
    this.name = 'DishNotEligibleError';
  }
}
