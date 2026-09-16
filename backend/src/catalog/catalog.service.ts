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

  async getRegions(q?: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const items = await this.prisma.db.region.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take,
      select: { id: true, code: true, name: true },
    });
    return {
      version: CatalogService.CATALOG_VERSION,
      items: items.map((r) => ({
        ...r,
        countryCode: 'VN',
        parentId: null,
        type: 'REGION',
      })),
    };
  }

  async getAllergens() {
    const items = await this.prisma.db.allergen.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, code: true, name: true, description: true, displayOrder: true },
    });
    return { version: CatalogService.CATALOG_VERSION, items };
  }

  async getDietaryPreferences(type?: string) {
    const items = await this.prisma.db.dietaryPreference.findMany({
      where: {
        active: true,
        ...(type ? { type: type.toUpperCase() as any } : {}),
      },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, code: true, type: true, name: true, displayOrder: true },
    });
    return { version: CatalogService.CATALOG_VERSION, items };
  }

  async getSelectionPriorities() {
    try {
      const items = await this.prisma.db.selectionPriorityCatalog.findMany({
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, code: true, name: true, description: true, displayOrder: true },
      });
      return { version: CatalogService.CATALOG_VERSION, items };
    } catch {
      return {
        version: CatalogService.CATALOG_VERSION,
        items: [
          { id: null, code: 'PRICE', name: 'Giá cả', description: null, displayOrder: 1 },
          { id: null, code: 'TIME', name: 'Thời gian', description: null, displayOrder: 2 },
          { id: null, code: 'HEALTH', name: 'Sức khỏe', description: null, displayOrder: 3 },
          { id: null, code: 'TASTE', name: 'Khẩu vị', description: null, displayOrder: 4 },
        ],
      };
    }
  }
}
