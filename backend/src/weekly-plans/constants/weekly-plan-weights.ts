/**
 * BA-005: Slot weights for budget/kcal allocation (mục 17 BA-005)
 */
import { WeeklyMealSlot } from '@prisma/client';

export const SLOT_WEIGHTS: Record<WeeklyMealSlot, number> = {
  MORNING: 0.25,
  LUNCH: 0.40,
  DINNER: 0.35,
  SNACK: 0.10,
};

/** Normalize weights based on enabled slots */
export function getSlotWeights(enabledSlots: WeeklyMealSlot[]): Record<WeeklyMealSlot, number> {
  const total = enabledSlots.reduce((sum, slot) => sum + SLOT_WEIGHTS[slot], 0);
  const normalized: Partial<Record<WeeklyMealSlot, number>> = {};
  for (const slot of enabledSlots) {
    normalized[slot] = SLOT_WEIGHTS[slot] / total;
  }
  return normalized as Record<WeeklyMealSlot, number>;
}

/** MealTypeTag codes per slot — phải khớp với cột `code` trong bảng meal_type_tags */
export const SLOT_MEAL_TAG: Record<WeeklyMealSlot, string> = {
  MORNING: 'BREAKFAST',
  LUNCH: 'LUNCH',
  DINNER: 'DINNER',
  SNACK: 'SNACK',
};

export const ALGORITHM_VERSION = '1.0';

/** Default kcal tolerance */
export const DEFAULT_KCAL_TOLERANCE = 0.1; // ±10%
export const MAX_KCAL_TOLERANCE = 0.2; // fallback ±20%

/** Minimum candidates per slot before broadening filters */
export const MIN_CANDIDATES = 3;
