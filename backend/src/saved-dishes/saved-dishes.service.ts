import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavedDishesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, cursor?: string, limit = 20, q?: string) {
    const take = Math.min(limit, 100);

    const saved = await this.prisma.db.savedDish.findMany({
      where: {
        userId,
        ...(cursor ? { id: { lt: cursor } } : {}),
        ...(q
          ? {
              dish: {
                name: { contains: q, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        dish: {
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            status: true,
            priceMin: true,
            priceMax: true,
            prepMinutes: true,
            cookMinutes: true,
            nutrition: {
              select: { calories: true },
            },
            media: {
              where: { isPrimary: true, moderationStatus: 'APPROVED' },
              select: { id: true, storageKey: true, bucket: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    const hasNextPage = saved.length > take;
    const data = hasNextPage ? saved.slice(0, take) : saved;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    const mapRow = (s: (typeof data)[number]) => ({
      id: s.id,
      dishId: s.dishId,
      savedAt: s.savedAt,
      dish: {
        ...s.dish,
        kcal: s.dish.nutrition?.calories != null ? Number(s.dish.nutrition.calories) : null,
        cookTimeMinutes:
          (s.dish.cookMinutes ?? 0) + (s.dish.prepMinutes ?? 0) || null,
        isAvailable: s.dish.status === 'PUBLISHED',
      },
    });

    return {
      data: data.map(mapRow),
      items: data.map(mapRow),
      pageInfo: { nextCursor, hasNextPage },
    };
  }

  async save(userId: string, dishId: string) {
    const dish = await this.prisma.db.dish.findFirst({
      where: { id: dishId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }

    const saved = await this.prisma.db.savedDish.upsert({
      where: { userId_dishId: { userId, dishId } },
      create: { userId, dishId },
      update: {},
      select: { id: true, savedAt: true },
    });

    return { dishId, saved: true, savedAt: saved.savedAt.toISOString() };
  }

  async unsave(userId: string, dishId: string) {
    await this.prisma.db.savedDish
      .delete({ where: { userId_dishId: { userId, dishId } } })
      .catch(() => {});

    return { dishId, saved: false };
  }
}
