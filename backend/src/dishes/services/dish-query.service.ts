import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DishStatus, ModerationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DishAdminQueryDto, DishPublicQueryDto } from '../dto/dish-query.dto';

@Injectable()
export class DishQueryService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
  }

  /** Sinh public URL từ storageKey + bucket */
  buildPublicUrl(storageKey: string, bucket: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${storageKey}`;
  }

  /** Gắn publicUrl vào mảng media */
  private withPublicUrl<T extends { media?: { storageKey: string; bucket: string; [k: string]: any }[] }>(
    dishes: T[],
  ): any[] {
    return dishes.map((d) => ({
      ...d,
      media: (d.media ?? []).map((m) => ({
        ...m,
        publicUrl: this.buildPublicUrl(m.storageKey, m.bucket),
      })),
    }));
  }

  /** Public search — chỉ PUBLISHED */
  async searchPublic(query: DishPublicQueryDto) {
    const {
      q,
      regionId,
      provinceId,
      categoryCodes,
      mealTypeCodes,
      dietTypeCodes,
      goalCodes,
      maxBudget,
      limit = 20,
      cursor,
      sort = 'relevance',
    } = query;

    const take = Math.min(limit, 100);
    let cursorWhere: Prisma.DishWhereInput = {};

    if (cursor) {
      cursorWhere = { id: { gt: cursor } };
    }

    const where: Prisma.DishWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...cursorWhere,
      ...(regionId ? { regionId } : {}),
      ...(provinceId ? { provinceId } : {}),
      ...(maxBudget ? { priceMin: { lte: maxBudget } } : {}),
      ...(categoryCodes?.length
        ? { categories: { some: { category: { code: { in: categoryCodes } } } } }
        : {}),
      ...(mealTypeCodes?.length
        ? { mealTypes: { some: { mealTypeTag: { code: { in: mealTypeCodes } } } } }
        : {}),
      ...(dietTypeCodes?.length
        ? { dietTypes: { some: { dietType: { code: { in: dietTypeCodes } } } } }
        : {}),
      ...(goalCodes?.length
        ? { dishGoals: { some: { goal: { code: { in: goalCodes } } } } }
        : {}),
    };

    // Full-text search với unaccent
    if (q) {
      const dishes = await this.prisma.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM dishes
        WHERE status = 'PUBLISHED'
          AND deleted_at IS NULL
          AND (
            search_text ILIKE '%' || unaccent(${q.toLowerCase()}) || '%'
            OR search_text % unaccent(${q.toLowerCase()})
          )
        ORDER BY
          similarity(search_text, unaccent(${q.toLowerCase()})) DESC,
          published_at DESC
        LIMIT ${take + 1}
      `;

      const ids = dishes.map((d) => d.id);
      const nextCursor = ids.length > take ? ids[take] : null;
      const resultIds = ids.slice(0, take);

      const result = await this.prisma.db.dish.findMany({
        where: { id: { in: resultIds } },
        include: this.publicInclude(),
      });

      const sorted = resultIds.map((id) => result.find((d) => d.id === id)).filter(Boolean);

      return { data: sorted, pageInfo: { nextCursor, hasNextPage: !!nextCursor } };
    }

    const orderBy = this.buildOrderBy(sort);
    const dishes = await this.prisma.db.dish.findMany({
      where,
      include: this.publicInclude(),
      take: take + 1,
      orderBy,
    });

    const hasNextPage = dishes.length > take;
    const data = hasNextPage ? dishes.slice(0, take) : dishes;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return { data, pageInfo: { nextCursor, hasNextPage } };
  }

  /** Public detail — chỉ PUBLISHED */
  async findPublicDetail(idOrSlug: string) {
    const dish = await this.prisma.db.dish.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: this.publicDetailInclude(),
    });

    if (!dish) {
      throw new NotFoundException({
        error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' },
      });
    }

    return dish;
  }

  /** Admin list — tất cả trạng thái + summary kho món */
  async adminList(query: DishAdminQueryDto) {
    const {
      status,
      createdBy,
      limit = 20,
      cursor,
      q,
      regionId,
      categoryCode,
      mealTypeCode,
      goalId,
    } = query;
    const take = Math.min(limit, 100);

    const where: Prisma.DishWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(regionId ? { regionId } : {}),
      ...(categoryCode
        ? { categories: { some: { category: { code: categoryCode } } } }
        : {}),
      ...(mealTypeCode
        ? { mealTypes: { some: { mealTypeTag: { code: mealTypeCode } } } }
        : {}),
      ...(goalId ? { dishGoals: { some: { goalId: goalId } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { alternateNames: { has: q } },
            ],
          }
        : {}),
    };

    const listWhere: Prisma.DishWhereInput = {
      ...where,
      ...(cursor ? { id: { lt: cursor } } : {}),
    };

    const [dishes, grouped] = await Promise.all([
      this.prisma.db.dish.findMany({
        where: listWhere,
        include: this.adminListInclude(),
        take: take + 1,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.db.dish.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const hasNextPage = dishes.length > take;
    const rawData = hasNextPage ? dishes.slice(0, take) : dishes;
    const nextCursor = hasNextPage ? rawData[rawData.length - 1]?.id : null;
    const data = this.withPublicUrl(rawData);

    const countBy = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    const summary = {
      total: grouped.reduce((s, g) => s + g._count._all, 0),
      published: countBy['PUBLISHED'] ?? 0,
      pendingReview: countBy['PENDING_REVIEW'] ?? 0,
      draft: countBy['DRAFT'] ?? 0,
    };

    return {
      data,
      pageInfo: { nextCursor, hasNextPage },
      total: summary.total,
      summary,
    };
  }

  /** Checklist hoàn thiện trước khi gửi duyệt (BA-007 DISH-07) */
  async getValidation(id: string) {
    const dish = await this.adminDetail(id);
    const ingredients = (dish as any).dishIngredients ?? [];
    const nutrition = (dish as any).nutrition;
    const media = (dish as any).media ?? [];
    const hasCover = media.some((m: any) => m.isPrimary) || media.length > 0;
    const warnings: { code: string; message: string }[] = [];
    const blockingErrors: { code: string; message: string; section: string }[] = [];

    const nameOk = !!(dish.name && dish.name.trim() && dish.name !== 'Bản nháp chưa đặt tên');
    if (!nameOk) {
      blockingErrors.push({
        code: 'DISH_NAME_REQUIRED',
        message: 'Tên món là bắt buộc.',
        section: 'BASIC_INFO',
      });
    }

    const hasCategory = ((dish as any).categories ?? []).length > 0;
    const hasMealType = ((dish as any).mealTypes ?? []).length > 0;
    if (!hasCategory) {
      blockingErrors.push({
        code: 'PUBLISH_REQUIREMENT_FAILED',
        message: 'Cần ít nhất một danh mục.',
        section: 'CLASSIFICATION',
      });
    }
    if (!hasMealType) {
      blockingErrors.push({
        code: 'PUBLISH_REQUIREMENT_FAILED',
        message: 'Cần ít nhất một loại bữa ăn.',
        section: 'CLASSIFICATION',
      });
    }

    if (ingredients.length === 0) {
      blockingErrors.push({
        code: 'PUBLISH_REQUIREMENT_FAILED',
        message: 'Cần ít nhất một nguyên liệu.',
        section: 'INGREDIENTS',
      });
    }

    if (nutrition?.sodiumMg != null && Number(nutrition.sodiumMg) >= 800) {
      warnings.push({
        code: 'HIGH_SODIUM',
        message: `Natri ${nutrition.sodiumMg} mg cao hơn ngưỡng khuyến nghị.`,
      });
    }

    if (!hasCover) {
      blockingErrors.push({
        code: 'PUBLISH_REQUIREMENT_FAILED',
        message: 'Ảnh bìa bắt buộc khi gửi duyệt.',
        section: 'MEDIA',
      });
    }

    const shortDescOk = !!(dish.shortDescription && dish.shortDescription.trim());
    if (!shortDescOk) {
      blockingErrors.push({
        code: 'PUBLISH_REQUIREMENT_FAILED',
        message: 'Mô tả ngắn bắt buộc khi gửi duyệt.',
        section: 'BASIC_INFO',
      });
    }

    const sources = (dish as any).sources ?? [];
    if (!sources.length) {
      warnings.push({
        code: 'MISSING_SOURCE',
        message: 'Chưa có nguồn tham khảo — nên bổ sung trước khi xuất bản.',
      });
    }

    const sections = [
      { key: 'BASIC_INFO', status: nameOk ? 'COMPLETE' : 'ERROR' },
      { key: 'CLASSIFICATION', status: hasCategory && hasMealType ? 'COMPLETE' : 'ERROR' },
      { key: 'INGREDIENTS', status: ingredients.length ? 'COMPLETE' : 'ERROR' },
      { key: 'NUTRITION', status: warnings.some((w) => w.code === 'HIGH_SODIUM') ? 'WARNING' : nutrition ? 'COMPLETE' : 'WARNING' },
      { key: 'RECIPE', status: ((dish as any).recipeSteps ?? []).length ? 'COMPLETE' : 'WARNING' },
      { key: 'MEDIA', status: hasCover ? 'COMPLETE' : 'ERROR' },
    ];

    const score = sections.reduce((sum, s) => {
      if (s.status === 'COMPLETE') return sum + 1
      if (s.status === 'WARNING') return sum + 0.5
      return sum
    }, 0);
    return {
      completionPercent: Math.round((score / sections.length) * 100),
      sections,
      blockingErrors,
      warnings,
      canSubmitReview: blockingErrors.length === 0,
    };
  }

  /** Admin detail — bất kỳ trạng thái */
  async adminDetail(id: string) {
    const dish = await this.prisma.db.dish.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      include: this.adminDetailInclude(),
    });

    if (!dish) {
      throw new NotFoundException({
        error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' },
      });
    }

    // Gắn publicUrl vào media
    return {
      ...dish,
      media: (dish.media ?? []).map((m) => ({
        ...m,
        publicUrl: this.buildPublicUrl(m.storageKey, m.bucket),
      })),
    };
  }

  private buildOrderBy(sort: string): Prisma.DishOrderByWithRelationInput[] {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: 'desc' }];
      case 'popular':
        return [{ ratingCount: 'desc' }, { publishedAt: 'desc' }];
      default:
        return [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];
    }
  }

  private publicInclude() {
    return {
      region: { select: { id: true, code: true, name: true } },
      province: { select: { id: true, code: true, name: true } },
      categories: {
        include: { category: { select: { id: true, code: true, name: true } } },
      },
      mealTypes: {
        include: { mealTypeTag: { select: { id: true, code: true, name: true } } },
      },
      media: {
        where: { moderationStatus: ModerationStatus.APPROVED, isPrimary: true },
        select: { id: true, storageKey: true, bucket: true, altText: true },
        take: 1,
      },
      nutrition: true,
    };
  }

  private publicDetailInclude() {
    return {
      region: true,
      province: true,
      categories: { include: { category: true } },
      mealTypes: { include: { mealTypeTag: true } },
      dietTypes: { include: { dietType: true } },
      dishGoals: {
        include: { goal: { select: { id: true, code: true, name: true } } },
      },
      dishIngredients: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          ingredient: {
            select: { id: true, code: true, name: true, allergenCode: true, imageUrl: true },
          },
        },
      },
      dishAllergens: {
        include: { allergen: { select: { id: true, code: true, name: true } } },
      },
      nutrition: true,
      recipeSteps: { orderBy: { stepOrder: 'asc' as const } },
      sources: { orderBy: { createdAt: 'asc' as const } },
      media: {
        where: { moderationStatus: ModerationStatus.APPROVED },
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
      variants: {
        where: { status: DishStatus.PUBLISHED, deletedAt: null },
        select: { id: true, slug: true, name: true },
      },
      reviews: {
        where: { isVisible: true },
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        include: {
          profile: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
    };
  }

  private adminListInclude() {
    return {
      region: { select: { id: true, name: true } },
      categories: {
        include: { category: { select: { id: true, code: true, name: true } } },
      },
      mealTypes: {
        include: { mealTypeTag: { select: { id: true, code: true, name: true } } },
      },
      media: {
        where: { isPrimary: true },
        select: { id: true, storageKey: true, bucket: true, mimeType: true, isPrimary: true, moderationStatus: true },
        orderBy: { id: 'asc' as const },
        take: 1,
      },
      nutrition: true,
    };
  }

  private adminDetailInclude() {
    return {
      region: true,
      province: true,
      categories: { include: { category: true } },
      mealTypes: { include: { mealTypeTag: true } },
      dietTypes: { include: { dietType: true } },
      dishGoals: {
        include: { goal: { select: { id: true, code: true, name: true } } },
      },
      dishIngredients: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          ingredient: {
            select: { id: true, code: true, name: true, allergenCode: true, imageUrl: true },
          },
        },
      },
      nutrition: true,
      recipeSteps: { orderBy: { stepOrder: 'asc' as const } },
      sources: { orderBy: { createdAt: 'asc' as const } },
      media: {
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
    };
  }

  /** Lấy danh sách biến thể (variants) của một món cha */
  async getVariants(parentId: string) {
    const variants = await this.prisma.db.dish.findMany({
      where: {
        parentDishId: parentId,
        deletedAt: null,
        status: DishStatus.PUBLISHED,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ratingAvg: true,
        ratingCount: true,
        priceMin: true,
        priceMax: true,
        media: {
          where: { moderationStatus: ModerationStatus.APPROVED, isPrimary: true },
          select: { storageKey: true, bucket: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return variants.map((v) => ({
      ...v,
      media: v.media.map((m) => ({
        ...m,
        publicUrl: this.buildPublicUrl(m.storageKey, m.bucket),
      })),
    }));
  }

  /** Trả về DishIngredient chưa link với Ingredient, kèm tên món ăn */
  async getUnlinkedIngredients() {
    const rows = await this.prisma.db.dishIngredient.findMany({
      where: { ingredientId: null },
      select: {
        id: true,
        rawText: true,
        quantity: true,
        unit: true,
        preparation: true,
        sortOrder: true,
        dish: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { rawText: 'asc' },
    });

    // Group by rawText để hiện số lần xuất hiện
    const grouped = new Map<string, { rawText: string; count: number; dishes: string[]; ids: string[] }>();
    for (const r of rows) {
      const key = r.rawText.toLowerCase().trim();
      if (!grouped.has(key)) {
        grouped.set(key, { rawText: r.rawText, count: 0, dishes: [], ids: [] });
      }
      const g = grouped.get(key)!;
      g.count++;
      g.ids.push(r.id);
      if (!g.dishes.includes(r.dish.name)) g.dishes.push(r.dish.name);
    }

    return {
      total: rows.length,
      uniqueCount: grouped.size,
      items: [...grouped.values()].sort((a, b) => b.count - a.count),
    };
  }

  async getSimilarDishes(idOrSlug: string, limit = 5) {
    const dish = await this.prisma.db.dish.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        categories: { select: { categoryId: true } },
      },
    });

    if (!dish) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }

    const categoryIds = dish.categories.map((c) => c.categoryId);

    const similar = await this.prisma.db.dish.findMany({
      where: {
        id: { not: dish.id },
        status: 'PUBLISHED',
        deletedAt: null,
        ...(categoryIds.length > 0
          ? { categories: { some: { categoryId: { in: categoryIds } } } }
          : {}),
      },
      take: Math.min(limit, 20),
      include: {
        media: {
          where: { isPrimary: true, moderationStatus: 'APPROVED' },
          take: 1,
        },
        nutrition: { select: { calories: true } },
      },
      orderBy: { ratingAvg: 'desc' },
    });

    return {
      items: this.withPublicUrl(similar).map((d) => ({
        id: d.id,
        name: d.name,
        imageUrl: d.media?.[0]?.publicUrl,
        energyKcal: Number(d.nutrition?.calories ?? 0),
        priceMin: d.priceMin,
        cookingTimeMinutes: d.prepMinutes ?? 0,
      })),
    };
  }
}
