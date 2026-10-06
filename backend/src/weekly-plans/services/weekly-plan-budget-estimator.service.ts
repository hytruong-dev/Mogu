import { Injectable } from '@nestjs/common';
import { WeeklyMealSlot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DishEligibilityService } from '../../dishes/eligibility/dish-eligibility.service';
import { EligibilityProfile } from '../../dishes/eligibility/dish-eligibility.types';
import {
  PlanMealMode,
  resolvePlanPrice,
  roundUpBudget,
} from '../../dishes/eligibility/dish-pricing';
import { SLOT_MEAL_TAG } from '../constants/weekly-plan-weights';

export const ALL_MEAL_MODES: PlanMealMode[] = ['HOME_COOK', 'EAT_OUT', 'FLEXIBLE'];

export interface ModeBudgetEstimate {
  mode: PlanMealMode;
  /** false nếu kho món không có món nào có giá hợp lệ cho hình thức này */
  feasible: boolean;
  /** Ngân sách tối thiểu thực tế (không lặp món trong 1 bữa nếu kho đủ), làm tròn 10k */
  minBudgetVnd: number;
  /** Cận dưới cứng: món rẻ nhất mỗi bữa x số ngày (cho phép lặp). Dưới mức này chắc chắn không tạo được */
  hardMinBudgetVnd: number;
  /** Mức thoải mái: giá trung vị mỗi bữa x số ngày */
  comfortableBudgetVnd: number;
  perSlotMin: Partial<Record<WeeklyMealSlot, number>>;
  eligibleDishCount: number;
}

export interface BudgetEstimate {
  durationDays: number;
  enabledSlots: WeeklyMealSlot[];
  byMode: Record<PlanMealMode, ModeBudgetEstimate>;
}

interface PoolDish {
  id: string;
  priceMin: number | null;
  dineOutPriceMin: number | null;
  servings: number | null;
  mealCodes: Set<string>;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

@Injectable()
export class WeeklyPlanBudgetEstimatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: DishEligibilityService,
  ) {}

  async estimateForUser(
    userId: string,
    enabledSlots: WeeklyMealSlot[],
    durationDays: number,
  ): Promise<BudgetEstimate> {
    const profile = await this.eligibility.loadProfile(userId);
    return this.estimateWithProfile(profile, enabledSlots, durationDays);
  }

  async estimateWithProfile(
    profile: EligibilityProfile,
    enabledSlots: WeeklyMealSlot[],
    durationDays: number,
  ): Promise<BudgetEstimate> {
    const slots = Array.from(new Set(enabledSlots));
    const where = this.eligibility.buildHardWhere(profile, 'weekly', {
      requirePrice: true,
      priceMode: 'FLEXIBLE',
    });

    const rows = await this.prisma.db.dish.findMany({
      where,
      select: {
        id: true,
        priceMin: true,
        dineOutPriceMin: true,
        servings: true,
        mealTypes: { select: { mealTypeTag: { select: { code: true } } } },
      },
      take: 1000,
    });

    const pool: PoolDish[] = rows.map((d) => ({
      id: d.id,
      priceMin: d.priceMin != null ? Number(d.priceMin) : null,
      dineOutPriceMin: d.dineOutPriceMin != null ? Number(d.dineOutPriceMin) : null,
      servings: d.servings != null ? Number(d.servings) : null,
      mealCodes: new Set(d.mealTypes.map((m) => m.mealTypeTag.code)),
    }));

    const byMode = {} as Record<PlanMealMode, ModeBudgetEstimate>;
    for (const mode of ALL_MEAL_MODES) {
      byMode[mode] = this.estimateMode(pool, mode, slots, durationDays);
    }
    return { durationDays, enabledSlots: slots, byMode };
  }

  private estimateMode(
    pool: PoolDish[],
    mode: PlanMealMode,
    slots: WeeklyMealSlot[],
    durationDays: number,
  ): ModeBudgetEstimate {
    const priced = pool
      .map((d) => ({ dish: d, price: resolvePlanPrice(d, mode)?.priceVnd ?? null }))
      .filter((x): x is { dish: PoolDish; price: number } => x.price != null);

    const infeasible: ModeBudgetEstimate = {
      mode,
      feasible: false,
      minBudgetVnd: 0,
      hardMinBudgetVnd: 0,
      comfortableBudgetVnd: 0,
      perSlotMin: {},
      eligibleDishCount: priced.length,
    };
    if (priced.length === 0 || slots.length === 0) return infeasible;

    let minTotal = 0;
    let hardMinTotal = 0;
    let comfortTotal = 0;
    const perSlotMin: Partial<Record<WeeklyMealSlot, number>> = {};

    for (const slot of slots) {
      const tag = SLOT_MEAL_TAG[slot];
      let slotPrices = priced
        .filter((x) => x.dish.mealCodes.has(tag) || x.dish.mealCodes.has('ANY'))
        .map((x) => x.price);
      // Generator nới meal type khi thiếu món -> dùng toàn kho làm fallback
      if (slotPrices.length === 0) slotPrices = priced.map((x) => x.price);
      slotPrices.sort((a, b) => a - b);

      perSlotMin[slot] = slotPrices[0];
      hardMinTotal += slotPrices[0] * durationDays;

      let distinctSum = 0;
      for (let i = 0; i < durationDays; i++) {
        distinctSum += slotPrices[i % slotPrices.length];
      }
      minTotal += distinctSum;
      comfortTotal += median(slotPrices) * durationDays;
    }

    const minBudgetVnd = roundUpBudget(minTotal);
    return {
      mode,
      feasible: true,
      minBudgetVnd,
      hardMinBudgetVnd: roundUpBudget(hardMinTotal),
      comfortableBudgetVnd: Math.max(roundUpBudget(comfortTotal), minBudgetVnd),
      perSlotMin,
      eligibleDishCount: priced.length,
    };
  }
}
