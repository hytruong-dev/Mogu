import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { safeQuery } from '../common/utils/safe-query';
import {
  CreateAllergenDto,
  CreateCategoryDto,
  UpdateAllergenDto,
  UpdateCategoryDto,
} from './dto/taxonomy-admin.dto';

@Injectable()
export class TaxonomyService {
  private readonly logger = new Logger(TaxonomyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public Read ────────────────────────────────────────────────────────────

  async getRegions() {
    return safeQuery(
      () =>
        this.prisma.db.region.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
      [],
    );
  }

  async getProvinces(regionId?: string) {
    return safeQuery(
      () =>
        this.prisma.db.province.findMany({
          where: { isActive: true, ...(regionId ? { regionId } : {}) },
          include: { region: { select: { id: true, code: true, name: true } } },
          orderBy: { name: 'asc' },
        }),
      [],
    );
  }

  async getDishCategories() {
    return safeQuery(
      () =>
        this.prisma.db.dishCategory.findMany({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        }),
      [],
    );
  }

  async getMealTypeTags() {
    return safeQuery(
      () =>
        this.prisma.db.mealTypeTag.findMany({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        }),
      [],
    );
  }

  async getDietTypes() {
    return safeQuery(
      () =>
        this.prisma.db.dietType.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        }),
      [],
    );
  }

  // ─── Admin: DietType CRUD ───────────────────────────────────────────────────

  async adminListDietTypes() {
    return this.prisma.db.dietType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async adminCreateDietType(dto: CreateCategoryDto) {
    const existing = await this.prisma.db.dietType.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Mã chế độ ăn "${dto.code}" đã tồn tại`);
    }
    return this.prisma.db.dietType.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async adminUpdateDietType(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.db.dietType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Chế độ ăn không tồn tại');
    return this.prisma.db.dietType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async adminDeleteDietType(id: string) {
    const existing = await this.prisma.db.dietType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Chế độ ăn không tồn tại');
    return this.prisma.db.dietType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getGoals() {
    return safeQuery(
      () =>
        this.prisma.db.goal.findMany({
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        }),
      [],
    );
  }

  async getAllergens() {
    return safeQuery(
      () =>
        this.prisma.db.allergen.findMany({
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        }),
      [],
    );
  }

  // ─── Admin: DishCategory CRUD ───────────────────────────────────────────────

  async adminListCategories() {
    return this.prisma.db.dishCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async adminCreateCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.db.dishCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Mã danh mục "${dto.code}" đã tồn tại`);
    }
    return this.prisma.db.dishCategory.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async adminUpdateCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.db.dishCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Danh mục không tồn tại');
    return this.prisma.db.dishCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async adminDeleteCategory(id: string) {
    const existing = await this.prisma.db.dishCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Danh mục không tồn tại');
    // Soft delete: set isActive = false
    return this.prisma.db.dishCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Admin: MealTypeTag CRUD ────────────────────────────────────────────────

  async adminListMealTypes() {
    return this.prisma.db.mealTypeTag.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async adminCreateMealType(dto: CreateCategoryDto) {
    const existing = await this.prisma.db.mealTypeTag.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Mã loại bữa "${dto.code}" đã tồn tại`);
    }
    return this.prisma.db.mealTypeTag.create({
      data: {
        code: dto.code,
        name: dto.name,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async adminUpdateMealType(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.db.mealTypeTag.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Loại bữa không tồn tại');
    return this.prisma.db.mealTypeTag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async adminDeleteMealType(id: string) {
    const existing = await this.prisma.db.mealTypeTag.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Loại bữa không tồn tại');
    return this.prisma.db.mealTypeTag.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Admin: Allergen CRUD ────────────────────────────────────────────────────

  async adminListAllergens() {
    return this.prisma.db.allergen.findMany({
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async adminCreateAllergen(dto: CreateAllergenDto) {
    const existing = await this.prisma.db.allergen.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Mã dị ứng "${dto.code}" đã tồn tại`);
    }
    return this.prisma.db.allergen.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        displayOrder: dto.displayOrder ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async adminUpdateAllergen(id: string, dto: UpdateAllergenDto) {
    const existing = await this.prisma.db.allergen.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dị ứng không tồn tại');
    return this.prisma.db.allergen.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async adminToggleAllergen(id: string) {
    const existing = await this.prisma.db.allergen.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Dị ứng không tồn tại');
    return this.prisma.db.allergen.update({
      where: { id },
      data: { active: !existing.active },
    });
  }
}
