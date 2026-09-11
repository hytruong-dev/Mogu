import { Injectable, BadRequestException } from '@nestjs/common';
import { AllergenLevel, DishStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DishNotEligibleError,
  EligibilityProfile,
  EligibilitySurface,
  SoftFilterOptions,
} from './dish-eligibility.types';

/**
 * Shared hard/soft eligibility for Random, Weekly Plan, Swap, Home.
 * ADR: docs/adr/ADR-RANDOM-WEEKLY-CONSTRAINTS.md
 */
@Injectable()
export class DishEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async loadProfile(userId: string): Promise<EligibilityProfile> {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: {
        userAllergens: { include: { allergen: true } },
        userDietTypes: { include: { dietType: true } },
        userAvoidedIngredients: true,
      },
    });

    if (!profile) {
      return {
        allergenCodes: [],
        hardDietTypeCodes: [],
        softDietTypeCodes: [],
        avoidedIngredients: [],
      };
    }

    return {
      allergenCodes: profile.userAllergens.map((a) => a.allergen.code),
      hardDietTypeCodes: profile.userDietTypes
        .filter((d) => d.isHard)
        .map((d) => d.dietType.code),
      softDietTypeCodes: profile.userDietTypes
        .filter((d) => !d.isHard)
        .map((d) => d.dietType.code),
      avoidedIngredients: profile.userAvoidedIngredients.map((i) =>
        i.ingredientName.trim().toLowerCase(),
      ),
    };
  }

  /**
   * Prisma hard filters that must never be relaxed.
   * - CONTAINS allergens always
   * - MAY_CONTAIN hard on weekly/swap/home; soft on random (caller controls via surface)
   * - Hard diet AND (dish must have ALL hard diet codes)
   * - Avoided ingredients via dishIngredients name/synonyms
   */
  buildHardWhere(
    profile: EligibilityProfile,
    surface: EligibilitySurface,
    soft?: SoftFilterOptions,
  ): Prisma.DishWhereInput {
    const and: Prisma.DishWhereInput[] = [
      { status: DishStatus.PUBLISHED },
      { deletedAt: null },
    ];

    if (profile.allergenCodes.length > 0) {
      const levels: AllergenLevel[] =
        surface === 'random'
          ? [AllergenLevel.CONTAINS]
          : [AllergenLevel.CONTAINS, AllergenLevel.MAY_CONTAIN];

      and.push({
        dishAllergens: {
          none: {
            allergen: { code: { in: profile.allergenCodes } },
            level: { in: levels },
          },
        },
      });
    }

    // Soft MAY_CONTAIN exclude for random when requested
    if (
      surface === 'random' &&
      soft?.softExcludeMayContain &&
      profile.allergenCodes.length > 0
    ) {
      and.push({
        dishAllergens: {
          none: {
            allergen: { code: { in: profile.allergenCodes } },
            level: AllergenLevel.MAY_CONTAIN,
          },
        },
      });
    }

    // Hard diet: dish must include EVERY hard diet type (AND)
    for (const code of profile.hardDietTypeCodes) {
      and.push({
        dietTypes: { some: { dietType: { code } } },
      });
    }

    if (profile.avoidedIngredients.length > 0) {
      and.push({
        dishIngredients: {
          none: {
            OR: profile.avoidedIngredients.flatMap((name) => [
              { parsedName: { equals: name, mode: 'insensitive' } },
              { rawText: { contains: name, mode: 'insensitive' } },
              {
                ingredient: {
                  OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { synonyms: { has: name } },
                  ],
                },
              },
            ]),
          },
        },
      });
    }

    if (soft?.requirePrice) {
      and.push({ priceMin: { not: null } });
    }

    if (soft?.maxPriceMin != null) {
      and.push({ priceMin: { lte: soft.maxPriceMin } });
    }

    if (soft?.mealTypeCodes?.length) {
      and.push({
        mealTypes: {
          some: { mealTypeTag: { code: { in: soft.mealTypeCodes } } },
        },
      });
    }

    if (soft?.excludeDishIds?.length) {
      and.push({ id: { notIn: soft.excludeDishIds } });
    }

    return { AND: and };
  }

  async assertDishEligible(
    dishId: string,
    profile: EligibilityProfile,
    surface: EligibilitySurface,
    soft?: SoftFilterOptions,
  ): Promise<void> {
    const where: Prisma.DishWhereInput = {
      id: dishId,
      ...this.buildHardWhere(profile, surface, soft),
    };

    const dish = await this.prisma.db.dish.findFirst({
      where,
      select: { id: true, priceMin: true },
    });

    if (!dish) {
      throw new BadRequestException({
        error: {
          code: 'DISH_NOT_ELIGIBLE',
          message: 'Món không thỏa ràng buộc dị ứng, chế độ ăn hoặc nguyên liệu tránh.',
        },
      });
    }

    if (soft?.requirePrice && dish.priceMin == null) {
      throw new BadRequestException({
        error: {
          code: 'DISH_PRICE_UNKNOWN',
          message: 'Món thiếu giá dự toán (priceMin).',
        },
      });
    }
  }

  throwIfEmpty(candidatesLength: number, context: string): void {
    if (candidatesLength === 0) {
      throw new DishNotEligibleError(
        'INSUFFICIENT_CANDIDATES',
        `Không còn ứng viên an toàn (${context}).`,
      );
    }
  }
}
