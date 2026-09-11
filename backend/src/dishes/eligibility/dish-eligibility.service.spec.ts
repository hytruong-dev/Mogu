import { AllergenLevel } from '@prisma/client';
import { DishEligibilityService } from './dish-eligibility.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DishEligibilityService', () => {
  const prisma = { db: { dish: { findFirst: jest.fn() }, profile: { findUnique: jest.fn() } } } as any;
  let service: DishEligibilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DishEligibilityService(prisma as PrismaService);
  });

  it('hard where rejects CONTAINS allergens on all surfaces', () => {
    const where = service.buildHardWhere(
      { allergenCodes: ['PEANUT'], hardDietTypeCodes: [], avoidedIngredients: [] },
      'weekly',
    );
    const and = (where as any).AND as any[];
    expect(and.some((c) => c.dishAllergens?.none?.level?.in?.includes(AllergenLevel.CONTAINS))).toBe(
      true,
    );
  });

  it('weekly hard-excludes MAY_CONTAIN; random does not by default', () => {
    const weekly = service.buildHardWhere(
      { allergenCodes: ['MILK'], hardDietTypeCodes: [], avoidedIngredients: [] },
      'weekly',
    );
    const random = service.buildHardWhere(
      { allergenCodes: ['MILK'], hardDietTypeCodes: [], avoidedIngredients: [] },
      'random',
    );
    const weeklyLevels = ((weekly as any).AND as any[]).find((c) => c.dishAllergens)?.dishAllergens
      .none.level.in;
    const randomLevels = ((random as any).AND as any[]).find((c) => c.dishAllergens)?.dishAllergens
      .none.level.in;
    expect(weeklyLevels).toEqual(
      expect.arrayContaining([AllergenLevel.CONTAINS, AllergenLevel.MAY_CONTAIN]),
    );
    expect(randomLevels).toEqual([AllergenLevel.CONTAINS]);
  });

  it('hard diet requires AND of every code', () => {
    const where = service.buildHardWhere(
      {
        allergenCodes: [],
        hardDietTypeCodes: ['VEGAN', 'HALAL'],
        avoidedIngredients: [],
      },
      'random',
    );
    const and = (where as any).AND as any[];
    const dietClauses = and.filter((c) => c.dietTypes?.some);
    expect(dietClauses).toHaveLength(2);
  });

  it('avoided ingredients filter via ingredient relation', () => {
    const where = service.buildHardWhere(
      {
        allergenCodes: [],
        hardDietTypeCodes: [],
        avoidedIngredients: ['tôm'],
      },
      'weekly',
    );
    const and = (where as any).AND as any[];
    expect(and.some((c) => c.dishIngredients?.none)).toBe(true);
  });

  it('assertDishEligible throws BadRequest when missing', async () => {
    prisma.db.dish.findFirst.mockResolvedValue(null);
    await expect(
      service.assertDishEligible(
        'd1',
        { allergenCodes: [], hardDietTypeCodes: ['VEGAN'], avoidedIngredients: [] },
        'swap',
        { requirePrice: true },
      ),
    ).rejects.toMatchObject({ response: { error: { code: 'DISH_NOT_ELIGIBLE' } } });
  });
});
