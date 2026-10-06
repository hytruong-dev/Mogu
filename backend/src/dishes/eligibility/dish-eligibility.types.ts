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
  /**
   * Weekly/swap: chọn loại giá theo hình thức ăn. Khi có `priceMode`, `requirePrice`
   * kiểm tra giá tương ứng và `maxPriceMin` KHÔNG còn lọc cứng trong DB
   * (giá/khẩu phần được lọc trong bộ nhớ qua resolvePlanPrice).
   */
  priceMode?: 'HOME_COOK' | 'EAT_OUT' | 'FLEXIBLE';
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
