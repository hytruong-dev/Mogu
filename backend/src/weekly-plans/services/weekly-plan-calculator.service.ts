import { Injectable } from '@nestjs/common';
import { WeeklyMealSlot, WeeklyPlanConfig } from '@prisma/client';
import { getSlotWeights } from '../constants/weekly-plan-weights';

export interface SlotAllocation {
  budgetVnd: number;
  kcal: number;
  weight: number;
}

@Injectable()
export class WeeklyPlanCalculatorService {
  /**
   * Calculate per-slot budget/kcal allocation for a single day.
   * Weights are normalized based on enabledSlots.
   */
  allocateDay(config: Pick<WeeklyPlanConfig, 'budgetVnd' | 'kcalPerDay' | 'enabledSlots' | 'durationDays'>): Record<WeeklyMealSlot, SlotAllocation> {
    const enabledSlots = config.enabledSlots as WeeklyMealSlot[];
    const weights = getSlotWeights(enabledSlots);
    const dailyBudget = Math.floor(config.budgetVnd / config.durationDays);
    const result: Partial<Record<WeeklyMealSlot, SlotAllocation>> = {};

    for (const slot of enabledSlots) {
      const w = weights[slot];
      result[slot] = {
        budgetVnd: Math.floor(dailyBudget * w),
        kcal: Math.round(config.kcalPerDay * w),
        weight: w,
      };
    }

    return result as Record<WeeklyMealSlot, SlotAllocation>;
  }

  /**
   * Check if a dish fits within the remaining budget/kcal with tolerance.
   */
  fitsSlot(
    dishPrice: number,
    dishKcal: number,
    slotBudget: number,
    slotKcal: number,
    tolerancePercent: number,
  ): boolean {
    const budgetOk = dishPrice <= slotBudget;
    const lo = slotKcal * (1 - tolerancePercent / 100);
    const hi = slotKcal * (1 + tolerancePercent / 100);
    const kcalOk = dishKcal >= lo && dishKcal <= hi;
    return budgetOk && kcalOk;
  }

  /**
   * Score how well a dish fits a target kcal (0-1).
   */
  kcalFitScore(dishKcal: number, targetKcal: number): number {
    if (targetKcal === 0) return 0.5;
    const diff = Math.abs(dishKcal - targetKcal) / targetKcal;
    return Math.max(0, 1 - diff * 2);
  }

  /**
   * Score how well a dish fits a budget (0-1).
   * Cheaper is better up to a point; way too cheap may be bad quality.
   */
  budgetFitScore(dishPrice: number, slotBudget: number): number {
    if (slotBudget === 0) return 0.5;
    const ratio = dishPrice / slotBudget;
    if (ratio <= 1) return ratio; // 0 to 1 as price approaches budget
    return Math.max(0, 2 - ratio); // over budget → decreases
  }
}
