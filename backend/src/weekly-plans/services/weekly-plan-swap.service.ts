import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, WeeklyPlanSlotStatus, WeeklyPlanSwapReason, DishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyPlanCalculatorService } from './weekly-plan-calculator.service';
import { SwapWeeklyPlanSlotDto } from '../dto/swap-weekly-plan-slot.dto';
import { WEEKLY_PLAN_ERRORS } from '../constants/weekly-plan-errors';
import { SLOT_MEAL_TAG } from '../constants/weekly-plan-weights';

@Injectable()
export class WeeklyPlanSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: WeeklyPlanCalculatorService,
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

    const config = slot.plan.config;
    const mealTag = SLOT_MEAL_TAG[slot.mealSlot];

    // Get profile for hard filters
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: { userAllergens: { include: { allergen: true } } },
    });

    let newDish: any;

    if (dto.newDishId) {
      // User specified a dish
      newDish = await this.prisma.db.dish.findFirst({
        where: { id: dto.newDishId, status: DishStatus.PUBLISHED, deletedAt: null },
        include: { nutrition: true, media: { where: { isPrimary: true }, take: 1 } },
      });

      if (!newDish) {
        throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.SWAP_DISH_NOT_FOUND } });
      }
    } else {
      // Auto-pick a different dish for the same slot type
      const allergenCodes = (profile?.userAllergens ?? []).map((a) => a.allergen.code);

      const candidates = await this.prisma.db.dish.findMany({
        where: {
          status: DishStatus.PUBLISHED,
          deletedAt: null,
          id: { not: slot.dishId }, // not current dish
          mealTypes: {
            some: {
              mealTypeTag: {
                code: mealTag,
              },
            },
          },
          ...(allergenCodes.length > 0 && {
            NOT: {
              dishAllergens: { some: { allergen: { code: { in: allergenCodes } } } },
            },
          }),
          nutrition: { isNot: null },
        },
        include: {
          nutrition: true,
          media: { where: { isPrimary: true }, take: 1 },
        },
        take: 20,
        orderBy: { ratingAvg: 'desc' },
      });

      if (candidates.length === 0) {
        throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.INSUFFICIENT_CANDIDATES } });
      }

      // Pick best by rating, excluding current
      newDish = candidates[0];
    }

    // Recalculate plan totals after swap
    const currentSlots = await this.prisma.db.weeklyPlanSlot.findMany({
      where: { planId, id: { not: slotId } },
      select: { priceSnapshotVnd: true, kcalSnapshot: true },
    });

    const newPriceAvg = newDish.priceMin !== null
      ? Math.floor((newDish.priceMin + (newDish.priceMax ?? newDish.priceMin)) / 2)
      : slot.priceSnapshotVnd;

    const newKcal = Math.round(newDish.nutrition?.calories ?? slot.kcalSnapshot);

    const projectedCost = currentSlots.reduce((s, sl) => s + sl.priceSnapshotVnd, 0) + newPriceAvg;

    // Cảnh báo nếu vượt budget 150%, nhưng vẫn cho swap
    // (budget là soft limit để UX không bị block)
    const budgetWarning = projectedCost > slot.plan.budgetLimitVnd * 1.5;

    const projectedKcal = currentSlots.reduce((s, sl) => s + sl.kcalSnapshot, 0) + newKcal;

    // Perform swap in transaction
    const result = await this.prisma.db.$transaction(async (tx) => {
      // Create swap audit record
      await tx.weeklyPlanSlotSwap.create({
        data: {
          slotId,
          previousDishId: slot.dishId,
          newDishId: newDish.id,
          previousCostVnd: slot.priceSnapshotVnd,
          newCostVnd: newPriceAvg,
          previousKcal: slot.kcalSnapshot,
          newKcal,
          reason: dto.reason ?? WeeklyPlanSwapReason.USER_REQUEST,
        },
      });

      // Update slot
      const updatedSlot = await tx.weeklyPlanSlot.update({
        where: { id: slotId },
        data: {
          dishId: newDish.id,
          dishNameSnapshot: newDish.name,
          imageUrlSnapshot: newDish.media?.[0]
            ? `${process.env.SUPABASE_URL}/storage/v1/object/public/${newDish.media[0].bucket ?? 'dish-images'}/${newDish.media[0].storageKey}`
            : null,
          priceSnapshotVnd: newPriceAvg,
          kcalSnapshot: newKcal,
          proteinGSnapshot: newDish.nutrition?.protein !== null ? newDish.nutrition?.protein : undefined,
          carbsGSnapshot: newDish.nutrition?.carbs !== null ? newDish.nutrition?.carbs : undefined,
          fatGSnapshot: newDish.nutrition?.fat !== null ? newDish.nutrition?.fat : undefined,
          swapCount: { increment: 1 },
          version: { increment: 1 },
        },
      });

      // Update plan totals
      await tx.weeklyPlan.update({
        where: { id: planId },
        data: {
          projectedCostVnd: projectedCost,
          projectedKcal,
          version: { increment: 1 },
        },
      });

      return updatedSlot;
    });

    return { ...result, budgetWarning };
  }
}
