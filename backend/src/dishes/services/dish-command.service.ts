import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DishStatus, Prisma } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDishDto } from '../dto/create-dish.dto';
import { DishSourceItemDto } from '../dto/dish-source.dto';
import { UpdateDishDto } from '../dto/update-dish.dto';
import { DishQueryService } from './dish-query.service';

export interface DishDraftAggregate {
  name: string;
  slug: string;
  alternateNames?: string[];
  shortDescription?: string | null;
  fullDescription?: string | null;
  regionId?: string | null;
  provinceId?: string | null;
  originText?: string | null;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  servings?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  recipeTitle?: string | null;
  flavorTags?: string[];
  categoryIds?: string[];
  mealTypeIds?: string[];
  dietTypeIds?: string[];
  goals?: Array<{ goalId: string; score?: number }>;
  ingredients?: Array<{
    ingredientId?: string | null;
    rawText: string;
    parsedName?: string | null;
    quantity?: number | null;
    quantityTo?: number | null;
    quantityText?: string | null;
    unit?: string | null;
    preparation?: string | null;
    specification?: string | null;
    normalizedWeightG?: number | null;
    parseMetadata?: Prisma.InputJsonValue;
    resolutionMethod?: 'EXACT' | 'ALIAS' | 'NORMALIZED' | 'FUZZY' | 'NONE';
    resolutionConfidence?: number | null;
    resolutionCandidates?: Prisma.InputJsonValue;
    needsReview?: boolean;
    isOptional?: boolean;
    groupLabel?: string | null;
    sortOrder?: number;
  }>;
  nutrition?: {
    servingName?: string | null;
    servingG?: number | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    sodiumMg?: number | null;
    basis?: 'PER_SERVING' | 'PER_100G' | 'WHOLE_RECIPE';
    servings?: number | null;
    method: 'AI_ESTIMATED' | 'INGREDIENT_CALCULATED' | 'SOURCE_VERIFIED';
    confidence?: number | null;
    sourceUrl?: string | null;
    provenance?: Prisma.InputJsonValue;
  };
  recipeSteps?: Array<{
    stepOrder: number;
    instruction: string;
    durationMin?: number | null;
    imageUrl?: string | null;
  }>;
  media?: Array<{
    storageKey: string;
    bucket?: string;
    mimeType: string;
    sizeBytes: number;
    width?: number | null;
    height?: number | null;
    checksum?: string | null;
    altText?: string | null;
    credit?: string | null;
    sourceUrl?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
}

// Valid state transitions per BA lifecycle
const VALID_TRANSITIONS: Record<DishStatus, DishStatus[]> = {
  DRAFT: ['PROCESSING', 'PENDING_REVIEW', 'ARCHIVED'],
  PROCESSING: ['PENDING_REVIEW', 'FAILED'],
  PENDING_REVIEW: ['PUBLISHED', 'CHANGES_REQUESTED', 'REJECTED'],
  CHANGES_REQUESTED: ['PENDING_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['UNPUBLISHED', 'ARCHIVED'],
  UNPUBLISHED: ['PUBLISHED', 'ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  FAILED: ['PROCESSING', 'DRAFT'],
  ARCHIVED: [],
};

@Injectable()
export class DishCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dishQuery: DishQueryService,
  ) { }

  /**
   * Domain persistence primitive for importers. The caller owns the transaction,
   * allowing the aggregate, import-job claim and audit record to commit together.
   */
  async createDraftAggregate(
    tx: Prisma.TransactionClient,
    aggregate: DishDraftAggregate,
    actorId: string,
    audit: { action: string; payload?: Prisma.InputJsonValue },
  ) {
    const name = aggregate.name.trim() || 'Bản nháp chưa đặt tên';
    const dish = await tx.dish.create({
      data: {
        name,
        slug: aggregate.slug,
        alternateNames: aggregate.alternateNames ?? [],
        searchText: this.buildSearchText(name, aggregate.alternateNames),
        shortDescription: aggregate.shortDescription,
        fullDescription: aggregate.fullDescription,
        regionId: aggregate.regionId,
        provinceId: aggregate.provinceId,
        originText: aggregate.originText,
        difficulty: aggregate.difficulty,
        prepMinutes: aggregate.prepMinutes,
        cookMinutes: aggregate.cookMinutes,
        servings: aggregate.servings?.toString(),
        priceMin: aggregate.priceMin,
        priceMax: aggregate.priceMax,
        recipeTitle: aggregate.recipeTitle,
        flavorTags: aggregate.flavorTags ?? [],
        status: 'DRAFT',
        createdBy: actorId,
        updatedBy: actorId,
        categories: aggregate.categoryIds?.length
          ? { create: [...new Set(aggregate.categoryIds)].map((categoryId) => ({ categoryId })) }
          : undefined,
        mealTypes: aggregate.mealTypeIds?.length
          ? { create: [...new Set(aggregate.mealTypeIds)].map((mealTypeTagId) => ({ mealTypeTagId })) }
          : undefined,
        dietTypes: aggregate.dietTypeIds?.length
          ? { create: [...new Set(aggregate.dietTypeIds)].map((dietTypeId) => ({ dietTypeId })) }
          : undefined,
        dishGoals: aggregate.goals?.length
          ? {
            create: [...new Map(aggregate.goals.map((goal) => [goal.goalId, goal])).values()]
              .map((goal) => ({ goalId: goal.goalId, score: goal.score ?? 50 })),
          }
          : undefined,
        dishIngredients: aggregate.ingredients?.length
          ? {
            create: aggregate.ingredients.map((ingredient, index) => ({
              ingredientId: ingredient.ingredientId,
              rawText: ingredient.rawText,
              parsedName: ingredient.parsedName,
              quantity: ingredient.quantity?.toString(),
              quantityTo: ingredient.quantityTo?.toString(),
              quantityText: ingredient.quantityText,
              unit: ingredient.unit,
              preparation: ingredient.preparation,
              specification: ingredient.specification,
              normalizedWeightG: ingredient.normalizedWeightG?.toString(),
              parseMetadata: ingredient.parseMetadata,
              resolutionMethod: ingredient.resolutionMethod,
              resolutionConfidence: ingredient.resolutionConfidence,
              resolutionCandidates: ingredient.resolutionCandidates,
              needsReview: ingredient.needsReview ?? false,
              isOptional: ingredient.isOptional ?? false,
              groupLabel: ingredient.groupLabel,
              sortOrder: ingredient.sortOrder ?? index,
            })),
          }
          : undefined,
        nutrition: aggregate.nutrition
          ? {
            create: {
              ...aggregate.nutrition,
              servings: aggregate.nutrition.servings?.toString(),
              provenance: aggregate.nutrition.provenance,
            },
          }
          : undefined,
        recipeSteps: aggregate.recipeSteps?.length
          ? { create: aggregate.recipeSteps }
          : undefined,
        media: aggregate.media?.length
          ? {
            create: aggregate.media.map((media) => ({
              ...media,
              type: 'IMAGE',
              moderationStatus: 'PENDING',
            })),
          }
          : undefined,
      },
      select: { id: true, status: true },
    });

    await tx.dishEditorAuditLog.create({
      data: {
        dishId: dish.id,
        actorId,
        action: audit.action,
        fromStatus: null,
        toStatus: 'DRAFT',
        payload: audit.payload,
      },
    });
    return dish;
  }

  async create(dto: CreateDishDto, actorId: string) {
    const name = (dto.name ?? '').trim() || 'Bản nháp chưa đặt tên';
    const slug = await this.generateSlug(dto.slug || name);

    const dish = await this.prisma.db.dish.create({
      data: {
        name,
        slug,
        alternateNames: dto.alternateNames ?? [],
        searchText: this.buildSearchText(name, dto.alternateNames),
        shortDescription: dto.shortDescription,
        fullDescription: dto.fullDescription,
        regionId: dto.regionId,
        provinceId: dto.provinceId,
        originText: dto.originText,
        difficulty: dto.difficulty,
        prepMinutes: dto.prepMinutes,
        cookMinutes: dto.cookMinutes,
        servings: dto.servings?.toString(),
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        primaryMealSlot: dto.primaryMealSlot,
        parentDishId: dto.parentDishId,
        status: 'DRAFT',
        createdBy: actorId,
        updatedBy: actorId,
        categories: dto.categoryIds?.length
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        mealTypes: dto.mealTypeIds?.length
          ? { create: dto.mealTypeIds.map((mealTypeTagId) => ({ mealTypeTagId })) }
          : undefined,
        dietTypes: dto.dietTypeIds?.length
          ? { create: dto.dietTypeIds.map((dietTypeId) => ({ dietTypeId })) }
          : undefined,
        dishGoals: dto.goalIds?.length
          ? {
            create: dto.goalIds.map((g) => ({
              goalId: typeof g === 'string' ? g : g.goalId,
              score: typeof g === 'string' ? 50 : (g.score ?? 50),
            })),
          }
          : undefined,
        dishIngredients: dto.ingredients?.length
          ? {
            create: dto.ingredients.map((ing, idx) => ({
              ingredientId: ing.ingredientId,
              rawText: ing.rawText,
              quantity: ing.quantity?.toString(),
              unit: ing.unit,
              preparation: ing.preparation,
              isOptional: ing.isOptional ?? false,
              groupLabel: ing.groupLabel,
              sortOrder: ing.sortOrder ?? idx,
            })),
          }
          : undefined,
        // Dinh dưỡng 1-1
        nutrition: dto.nutrition
          ? {
            create: {
              calories: dto.nutrition.calories,
              proteinG: dto.nutrition.proteinG,
              carbsG: dto.nutrition.carbsG,
              fatG: dto.nutrition.fatG,
              fiberG: dto.nutrition.fiberG,
              sodiumMg: dto.nutrition.sodiumMg,
              servingName: dto.nutrition.servingName,
              servingG: dto.nutrition.servingG,
            },
          }
          : undefined,
        // Bước nấu link thẳng
        recipeSteps: dto.recipeSteps?.length
          ? {
            create: dto.recipeSteps.map((s) => ({
              stepOrder: s.stepOrder,
              instruction: s.instruction,
              durationMin: s.durationMin,
              imageUrl: s.imageUrl,
            })),
          }
          : undefined,
      },
    });

    await this.audit(dish.id, actorId, 'DISH_DRAFT_CREATED', null, 'DRAFT')
    return dish;
  }

  async update(id: string, dto: UpdateDishDto, actorId: string, ifMatch?: string) {
    const expectedVersion =
      ifMatch !== undefined ? parseInt(ifMatch, 10) : undefined;
    if (expectedVersion !== undefined && Number.isNaN(expectedVersion)) {
      throw new BadRequestException({
        error: { code: 'INVALID_VERSION', message: 'If-Match không hợp lệ.' },
      });
    }

    try {
      const updated = await this.prisma.db.$transaction(async (tx) => {
        const dish = await tx.dish.findUnique({ where: { id } });
        if (!dish || dish.deletedAt) {
          throw new NotFoundException({
            error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' },
          });
        }

        if (expectedVersion !== undefined && dish.version !== expectedVersion) {
          throw new ConflictException({
            message: 'Món ăn đã được cập nhật bởi phiên bản khác. Vui lòng tải lại trang.',
            error: {
              code: 'DISH_VERSION_CONFLICT',
              message: 'Món ăn đã được cập nhật bởi phiên bản khác. Vui lòng tải lại trang.',
              currentVersion: dish.version,
              expectedVersion,
            },
          });
        }

        const editableStatuses: DishStatus[] = [
          'DRAFT',
          'CHANGES_REQUESTED',
          'FAILED',
          'REJECTED',
        ];
        if (!editableStatuses.includes(dish.status)) {
          throw new BadRequestException({
            error: {
              code: 'DISH_NOT_EDITABLE',
              message: `Không thể sửa món ở trạng thái ${dish.status}.`,
            },
          });
        }

        const updateData: Prisma.DishUncheckedUpdateInput = {
          updatedBy: actorId,
          version: { increment: 1 },
        };

        if (dto.name !== undefined) {
          updateData.name = dto.name;
          updateData.searchText = this.buildSearchText(
            dto.name,
            dto.alternateNames ?? dish.alternateNames,
          );
        }
        if (dto.alternateNames !== undefined) {
          updateData.alternateNames = dto.alternateNames;
          updateData.searchText = this.buildSearchText(
            dto.name ?? dish.name,
            dto.alternateNames,
          );
        }
        if (dto.shortDescription !== undefined) updateData.shortDescription = dto.shortDescription;
        if (dto.fullDescription !== undefined) updateData.fullDescription = dto.fullDescription;
        if (dto.regionId !== undefined) updateData.regionId = dto.regionId;
        if (dto.provinceId !== undefined) updateData.provinceId = dto.provinceId;
        if (dto.originText !== undefined) updateData.originText = dto.originText;
        if (dto.difficulty !== undefined) updateData.difficulty = dto.difficulty;
        if (dto.prepMinutes !== undefined) updateData.prepMinutes = dto.prepMinutes;
        if (dto.cookMinutes !== undefined) updateData.cookMinutes = dto.cookMinutes;
        if (dto.servings !== undefined) updateData.servings = dto.servings?.toString();
        if (dto.priceMin !== undefined) updateData.priceMin = dto.priceMin;
        if (dto.priceMax !== undefined) updateData.priceMax = dto.priceMax;
        if (dto.primaryMealSlot !== undefined) updateData.primaryMealSlot = dto.primaryMealSlot;
        if (dto.parentDishId !== undefined) updateData.parentDishId = dto.parentDishId;

        if (dto.categoryIds !== undefined) {
          const categoryIds = [...new Set(dto.categoryIds)];
          updateData.categories = {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          };
        }
        if (dto.mealTypeIds !== undefined) {
          const mealTypeIds = [...new Set(dto.mealTypeIds)];
          updateData.mealTypes = {
            deleteMany: {},
            create: mealTypeIds.map((mealTypeTagId) => ({ mealTypeTagId })),
          };
        }
        if (dto.dietTypeIds !== undefined) {
          const dietTypeIds = [...new Set(dto.dietTypeIds)];
          updateData.dietTypes = {
            deleteMany: {},
            create: dietTypeIds.map((dietTypeId) => ({ dietTypeId })),
          };
        }
        if (dto.goalIds !== undefined) {
          const goalIds = [
            ...new Map(
              dto.goalIds.map((g) => {
                const goalId = typeof g === 'string' ? g : g.goalId;
                return [goalId, g] as const;
              }),
            ).values(),
          ];
          updateData.dishGoals = {
            deleteMany: {},
            create: goalIds.map((g) => ({
              goalId: typeof g === 'string' ? g : g.goalId,
              score: typeof g === 'string' ? 50 : (g.score ?? 50),
            })),
          };
        }

        if (dto.ingredients !== undefined) {
          updateData.dishIngredients = {
            deleteMany: {},
            create: dto.ingredients.map((ing, idx) => ({
              ingredientId: ing.ingredientId,
              rawText: ing.rawText,
              quantity: ing.quantity?.toString(),
              unit: ing.unit,
              preparation: ing.preparation,
              isOptional: ing.isOptional ?? false,
              groupLabel: ing.groupLabel,
              sortOrder: ing.sortOrder ?? idx,
            })),
          };
        }

        if (dto.nutrition !== undefined) {
          const nutritionData = {
            calories: dto.nutrition.calories,
            proteinG: dto.nutrition.proteinG,
            carbsG: dto.nutrition.carbsG,
            fatG: dto.nutrition.fatG,
            fiberG: dto.nutrition.fiberG,
            sodiumMg: dto.nutrition.sodiumMg,
            servingName: dto.nutrition.servingName,
            servingG: dto.nutrition.servingG,
          };
          updateData.nutrition = {
            upsert: {
              create: nutritionData,
              update: nutritionData,
            },
          };
        }

        if (dto.recipeSteps !== undefined) {
          updateData.recipeSteps = {
            deleteMany: {},
            create: dto.recipeSteps.map((s) => ({
              stepOrder: s.stepOrder,
              instruction: s.instruction,
              durationMin: s.durationMin,
              imageUrl: s.imageUrl,
            })),
          };
        }

        return tx.dish.update({
          where:
            expectedVersion !== undefined
              ? { id, version: expectedVersion }
              : { id },
          data: updateData,
          include: {
            nutrition: true,
            recipeSteps: { orderBy: { stepOrder: 'asc' } },
          },
        });
      });

      await this.audit(id, actorId, 'DISH_SECTION_UPDATED', updated.status, updated.status);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        const current = await this.prisma.db.dish.findUnique({
          where: { id },
          select: { version: true },
        });
        throw new ConflictException({
          message: 'Món ăn đã được cập nhật bởi phiên bản khác. Vui lòng tải lại trang.',
          error: {
            code: 'DISH_VERSION_CONFLICT',
            message: 'Món ăn đã được cập nhật bởi phiên bản khác. Vui lòng tải lại trang.',
            currentVersion: current?.version,
            expectedVersion,
          },
        });
      }
      throw error;
    }
  }

  async saveSources(id: string, sources: DishSourceItemDto[], actorId: string) {
    const dish = await this.findOrFail(id);
    await this.prisma.db.dishSource.deleteMany({ where: { dishId: id } });
    const rows = (sources ?? []).filter((s) => s.url?.trim());
    if (rows.length) {
      await this.prisma.db.dishSource.createMany({
        data: rows.map((s) => ({
          dishId: id,
          url: s.url.trim(),
          title: s.title?.trim() || null,
          domain: s.domain?.trim() || this.extractDomain(s.url),
          author: s.author?.trim() || null,
          sourceType: s.sourceType ?? 'UNSTRUCTURED',
          reliability: s.reliability ?? 50,
          accessedAt: new Date(),
        })),
      });
    }
    await this.audit(id, actorId, 'DISH_SECTION_UPDATED', dish.status, dish.status, { section: 'SOURCES' });
    return this.prisma.db.dishSource.findMany({ where: { dishId: id }, orderBy: { createdAt: 'asc' } });
  }

  async submitForReview(
    id: string,
    actorId: string,
    body?: { note?: string; reviewTeam?: string },
  ) {
    const dish = await this.findOrFail(id);
    const validation = await this.dishQuery.getValidation(id);
    if (!validation.canSubmitReview) {
      throw new BadRequestException({
        error: {
          code: 'PUBLISH_REQUIREMENT_FAILED',
          message: 'Chưa đủ điều kiện gửi duyệt.',
          details: validation.blockingErrors,
        },
      });
    }
    this.assertTransition(dish.status, 'PENDING_REVIEW');

    const updated = await this.prisma.db.dish.update({
      where: { id },
      data: { status: 'PENDING_REVIEW', updatedBy: actorId },
    });
    await this.audit(id, actorId, 'DISH_SUBMITTED_REVIEW', dish.status, 'PENDING_REVIEW', {
      note: body?.note,
      reviewTeam: body?.reviewTeam,
    });
    return updated;
  }

  async unpublish(id: string, actorId: string) {
    const dish = await this.findOrFail(id);
    this.assertTransition(dish.status, 'UNPUBLISHED');

    return this.prisma.db.dish.update({
      where: { id },
      data: { status: 'UNPUBLISHED', updatedBy: actorId },
    });
  }

  async republish(id: string, actorId: string) {
    const dish = await this.findOrFail(id);
    this.assertTransition(dish.status, 'PUBLISHED');

    return this.prisma.db.dish.update({
      where: { id },
      data: { status: 'PUBLISHED', updatedBy: actorId },
    });
  }

  async archive(id: string, actorId: string) {
    const dish = await this.findOrFail(id);
    this.assertTransition(dish.status, 'ARCHIVED');

    return this.prisma.db.dish.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date(), updatedBy: actorId },
    });
  }

  async restore(id: string, actorId: string) {
    const dish = await this.prisma.db.dish.findUnique({ where: { id } });
    if (!dish) throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy.' } });
    if (dish.status !== 'ARCHIVED') {
      throw new BadRequestException({ error: { code: 'NOT_ARCHIVED', message: 'Chỉ khôi phục được món ARCHIVED.' } });
    }

    return this.prisma.db.dish.update({
      where: { id },
      data: { status: 'DRAFT', archivedAt: null, updatedBy: actorId },
    });
  }

  async softDelete(id: string, actorId: string) {
    const dish = await this.prisma.db.dish.findUnique({ where: { id } });
    if (!dish || dish.deletedAt) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }

    await this.prisma.db.dish.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });

    return { deleted: true, id };
  }

  private async findOrFail(id: string) {
    const dish = await this.prisma.db.dish.findUnique({ where: { id } });
    if (!dish || dish.deletedAt) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }
    return dish;
  }

  private assertTransition(from: DishStatus, to: DishStatus) {
    const valid = VALID_TRANSITIONS[from];
    if (!valid.includes(to)) {
      throw new BadRequestException({
        error: { code: 'INVALID_TRANSITION', message: `Không thể chuyển từ ${from} sang ${to}.` },
      });
    }
  }

  private buildSearchText(name: string, alternateNames?: string[]): string {
    const parts = [name, ...(alternateNames ?? [])];
    return parts.join(' ').toLowerCase();
  }

  private async audit(
    dishId: string,
    actorId: string,
    action: string,
    fromStatus?: string | null,
    toStatus?: string | null,
    payload?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.db.dishEditorAuditLog.create({
        data: {
          dishId,
          actorId,
          action,
          fromStatus: fromStatus ?? undefined,
          toStatus: toStatus ?? undefined,
          payload: (payload ?? undefined) as object | undefined,
        },
      });
    } catch {
      // Audit là best-effort để tương thích với DB/test fixture chưa có bảng log.
    }
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private async generateSlug(base: string): Promise<string> {
    const raw = slugify(base, { lower: true, locale: 'vi', strict: true });
    let slug = raw;
    let counter = 1;

    while (await this.prisma.db.dish.findFirst({ where: { slug, deletedAt: null } })) {
      slug = `${raw}-${counter++}`;
    }

    return slug;
  }
}
