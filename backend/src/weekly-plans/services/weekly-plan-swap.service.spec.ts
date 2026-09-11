import { WeeklyPlanSwapService } from './weekly-plan-swap.service';
import { DishEligibilityService } from '../../dishes/eligibility/dish-eligibility.service';
import { BadRequestException } from '@nestjs/common';

describe('WeeklyPlanSwapService eligibility', () => {
  const eligibility = {
    loadProfile: jest.fn(),
    assertDishEligible: jest.fn(),
    buildHardWhere: jest.fn().mockReturnValue({ status: 'PUBLISHED' }),
  };

  const prisma = {
    db: {
      weeklyPlanSlot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      weeklyPlanSlotSwap: { create: jest.fn() },
      weeklyPlan: { update: jest.fn() },
      dish: { findFirst: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((fn: any) =>
        fn({
          weeklyPlanSlotSwap: { create: jest.fn() },
          weeklyPlanSlot: { update: jest.fn().mockResolvedValue({ id: 'slot1', version: 2 }) },
          weeklyPlan: {
            update: jest.fn().mockResolvedValue({
              projectedCostVnd: 100000,
              projectedKcal: 2000,
            }),
          },
        }),
      ),
    },
  };

  let service: WeeklyPlanSwapService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WeeklyPlanSwapService(prisma as any, eligibility as any);
  });

  it('rejects manual swap when assertDishEligible fails', async () => {
    prisma.db.weeklyPlanSlot.findUnique.mockResolvedValue({
      id: 'slot1',
      planId: 'p1',
      dishId: 'old',
      version: 1,
      isLocked: false,
      status: 'PLANNED',
      mealSlot: 'LUNCH',
      priceSnapshotVnd: 30000,
      kcalSnapshot: 500,
      plan: {
        userId: 'u1',
        budgetLimitVnd: 100000,
        config: {},
      },
    });
    prisma.db.weeklyPlanSlot.findMany.mockResolvedValue([]);
    eligibility.loadProfile.mockResolvedValue({
      allergenCodes: ['PEANUT'],
      hardDietTypeCodes: [],
      avoidedIngredients: [],
    });
    eligibility.assertDishEligible.mockRejectedValue(
      new BadRequestException({ error: { code: 'DISH_NOT_ELIGIBLE' } }),
    );

    await expect(
      service.swap('p1', 'slot1', 'u1', { version: 1, newDishId: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
