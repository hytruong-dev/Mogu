import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  // Catalog version — tăng khi thêm/sửa data seed
  private static readonly CATALOG_VERSION = '1.0.0';

  constructor(private readonly prisma: PrismaService) {}

  /** GET /catalogs/goals — active goals for Home quick-goal (HOME-BR-007) */
  async getActiveGoals() {
    const goals = await this.prisma.db.goal.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        displayOrder: true,
      },
    });
    return { version: CatalogService.CATALOG_VERSION, goals };
  }

  async getOnboardingCatalog() {
    const [goals, dietaryPreferences, allergens] = await Promise.all([
      this.prisma.db.goal.findMany({
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          displayOrder: true,
        },
      }),
      this.prisma.db.dietaryPreference.findMany({
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          code: true,
          type: true,
          name: true,
          displayOrder: true,
        },
      }),
      this.prisma.db.allergen.findMany({
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          displayOrder: true,
        },
      }),
    ]);

    return {
      version: CatalogService.CATALOG_VERSION,
      goals,
      dietaryPreferences: {
        taste: dietaryPreferences.filter((p) => p.type === 'TASTE'),
        diet: dietaryPreferences.filter((p) => p.type === 'DIET'),
      },
      allergens,
    };
  }
}
