import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, WeeklyPlanSlotStatus, WeeklyPlanSwapReason, DishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DishEligibilityService } from '../../dishes/eligibility/dish-eligibility.service';
import {
  mapNutritionToPlanServing,
  planPriceVnd,
} from '../../dishes/eligibility/dish-nutrition.mapper';
import { SwapWeeklyPlanSlotDto } from '../dto/swap-weekly-plan-slot.dto';
import { WEEKLY_PLAN_ERRORS } from '../constants/weekly-plan-errors';
import { SLOT_MEAL_TAG } from '../constants/weekly-plan-weights';

@Injectable()
export class WeeklyPlanSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: DishEligibilityService,
  ) {}

  async swap(planId: string, slotId: string, userId: string, dto: SwapWeeklyPlanSlotDto) {
    const slot = await this.prisma.db.weeklyPlanSlot.findUnique({
      where: { id: slotId },
      include: {
        plan: { include: { config: true } },
      },
    });

    if (!slot || slot.planId !== planId) {
      throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_NOT_FOUND } });
    }

    if (slot.plan.userId !== userId) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.FORBIDDEN } });
    }

    if (slot.isLocked) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_LOCKED } });
    }

    if (slot.status !== WeeklyPlanSlotStatus.PLANNED) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_NOT_PLANNED } });
    }

    if (slot.version !== dto.version) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    const mealTag = SLOT_MEAL_TAG[slot.mealSlot];
    const profile = await this.eligibility.loadProfile(userId);

    const currentSlots = await this.prisma.db.weeklyPlanSlot.findMany({
      where: { planId, id: { not: slotId } },
      select: { priceSnapshotVnd: true, kcalSnapshot: true },
    });
    const spentWithoutSlot = currentSlots.reduce((s, sl) => s + sl.priceSnapshotVnd, 0);
    const remainingBudget = Math.max(0, slot.plan.budgetLimitVnd - spentWithoutSlot);

    let newDish: {
      id: string;
      name: string;
      priceMin: Prisma.Decimal | number | null;
      nutrition: any;
      media: Array<{ bucket?: string | null; storageKey?: string | null }>;
    };

    if (dto.newDishId) {
      await this.eligibility.assertDishEligible(dto.newDishId, profile, 'swap', {
        requirePrice: true,
        maxPriceMin: remainingBudget,
      });

      const found = await this.prisma.db.dish.findFirst({
        where: { id: dto.newDishId, status: DishStatus.PUBLISHED, deletedAt: null },
        include: { nutrition: true, media: { where: { isPrimary: true }, take: 1 } },
      });

      if (!found) {
        throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.SWAP_DISH_NOT_FOUND } });
      }
      newDish = found;
    } else {
      const candidates = await this.prisma.db.dish.findMany({
        where: this.eligibility.buildHardWhere(profile, 'swap', {
          requirePrice: true,
          maxPriceMin: remainingBudget,
          mealTypeCodes: [mealTag, 'ANY'],
          excludeDishIds: [slot.dishId],
        }),
        include: {
          nutrition: true,
          media: { where: { isPrimary: true }, take: 1 },
        },
        take: 20,
        orderBy: { ratingAvg: 'desc' },
      });

      if (candidates.length === 0) {
        throw new BadRequestException({
          error: { code: WEEKLY_PLAN_ERRORS.INSUFFICIENT_CANDIDATES },
        });
      }
      newDish = candidates[0];
    }

    const newPrice = planPriceVnd(
      newDish.priceMin != null ? Number(newDish.priceMin) : null,
    );
    if (newPrice === null) {
      throw new BadRequestException({
        error: { code: 'DISH_PRICE_UNKNOWN' },
      });
    }
    if (newPrice > remainingBudget) {
      throw new BadRequestException({
        error: {
          code: 'BUDGET_EXCEEDED',
          message: 'Món mới vượt ngân sách còn lại của kế hoạch.',
        },
      });
    }

    const mapped = mapNutritionToPlanServing(newDish.nutrition);
    const newKcal = mapped.kcal != null ? Math.round(mapped.kcal) : slot.kcalSnapshot;
    const projectedCost = spentWithoutSlot + newPrice;
    const projectedKcal =
      currentSlots.reduce((s, sl) => s + sl.kcalSnapshot, 0) + newKcal;

    const result = await this.prisma.db.$transaction(async (tx) => {
      await tx.weeklyPlanSlotSwap.create({
        data: {
          slotId,
          previousDishId: slot.dishId,
          newDishId: newDish.id,
          previousCostVnd: slot.priceSnapshotVnd,
          newCostVnd: newPrice,
          previousKcal: slot.kcalSnapshot,
          newKcal,
          reason: dto.reason ?? WeeklyPlanSwapReason.USER_REQUEST,
        },
      });

      const updatedSlot = await tx.weeklyPlanSlot.update({
        where: { id: slotId },
        data: {
          dishId: newDish.id,
          dishNameSnapshot: newDish.name,
          imageUrlSnapshot: newDish.media?.[0]?.storageKey
            ? `${process.env.SUPABASE_URL}/storage/v1/object/public/${newDish.media[0].bucket ?? 'dish-images'}/${newDish.media[0].storageKey}`
            : null,
          priceSnapshotVnd: newPrice,
          kcalSnapshot: newKcal,
          proteinGSnapshot: mapped.proteinG ?? undefined,
          carbsGSnapshot: mapped.carbsG ?? undefined,
          fatGSnapshot: mapped.fatG ?? undefined,
          swapCount: { increment: 1 },
          version: { increment: 1 },
        },
      });

      const updatedPlan = await tx.weeklyPlan.update({
        where: { id: planId },
        data: {
          projectedCostVnd: projectedCost,
          projectedKcal,
          version: { increment: 1 },
        },
      });

      return { updatedSlot, updatedPlan };
    });

    return {
      ...result.updatedSlot,
      summary: {
        projectedCostVnd: result.updatedPlan.projectedCostVnd,
        projectedKcal: result.updatedPlan.projectedKcal,
        budgetLimitVnd: slot.plan.budgetLimitVnd,
        remainingBudgetVnd: Math.max(0, slot.plan.budgetLimitVnd - projectedCost),
      },
    };
  }
}
