/**
 * Map DishNutrition → per-serving plan metrics.
 * ADR BR + R2-05: proteinG/carbsG/fatG; respect NutritionBasis.
 */

export type NutritionBasis = 'PER_SERVING' | 'PER_100G' | 'WHOLE_RECIPE' | string;

export interface RawDishNutrition {
  calories?: unknown;
  proteinG?: unknown;
  carbsG?: unknown;
  fatG?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  basis?: NutritionBasis | null;
  servingG?: unknown;
  servingsPerRecipe?: unknown;
}

export interface PlanServingNutrition {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  convertible: boolean;
  reason?: string;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function scale(
  kcal: number | null,
  proteinG: number | null,
  carbsG: number | null,
  fatG: number | null,
  factor: number,
): PlanServingNutrition {
  const mul = (v: number | null) => (v === null ? null : Math.round(v * factor * 100) / 100);
  const mulKcal = (v: number | null) => (v === null ? null : Math.round(v * factor));
  return {
    kcal: mulKcal(kcal),
    proteinG: mul(proteinG),
    carbsG: mul(carbsG),
    fatG: mul(fatG),
    convertible: true,
  };
}

export function mapNutritionToPlanServing(
  nutrition: RawDishNutrition | null | undefined,
): PlanServingNutrition {
  if (!nutrition) {
    return {
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      convertible: false,
      reason: 'MISSING_NUTRITION',
    };
  }

  const kcal = num(nutrition.calories);
  const proteinG = num(nutrition.proteinG ?? nutrition.protein);
  const carbsG = num(nutrition.carbsG ?? nutrition.carbs);
  const fatG = num(nutrition.fatG ?? nutrition.fat);
  const basis = (nutrition.basis ?? 'PER_SERVING') as NutritionBasis;

  if (basis === 'PER_SERVING' || !basis) {
    return {
      kcal,
      proteinG,
      carbsG,
      fatG,
      convertible: kcal !== null,
      reason: kcal === null ? 'MISSING_CALORIES' : undefined,
    };
  }

  if (basis === 'PER_100G') {
    const servingG = num(nutrition.servingG);
    if (servingG === null || servingG <= 0) {
      return {
        kcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        convertible: false,
        reason: 'MISSING_SERVING_G',
      };
    }
    return scale(kcal, proteinG, carbsG, fatG, servingG / 100);
  }

  if (basis === 'WHOLE_RECIPE') {
    const servings = num(nutrition.servingsPerRecipe);
    if (servings === null || servings <= 0) {
      return {
        kcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        convertible: false,
        reason: 'MISSING_SERVINGS',
      };
    }
    return scale(kcal, proteinG, carbsG, fatG, 1 / servings);
  }

  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    convertible: kcal !== null,
  };
}

/** Hard-budget price: priceMin only; null = unknown */
export function planPriceVnd(priceMin: number | null | undefined): number | null {
  if (priceMin === null || priceMin === undefined) return null;
  const n = Number(priceMin);
  return Number.isFinite(n) ? Math.round(n) : null;
}
