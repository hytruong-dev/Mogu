import { Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDishResponseDto, UnsaveDishResponseDto } from './dto/dish.dto';

@Injectable()
export class DishesService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /dishes/:id/events — view/click/share → recommendation_logs */
  async logEvent(
    userId: string,
    dishIdOrSlug: string,
    event: 'view' | 'click' | 'share',
    source?: string,
  ) {
    const isId = isUUID(dishIdOrSlug);
    const dish = await this.prisma.db.dish.findFirst({
      where: {
        ...(isId ? { OR: [{ id: dishIdOrSlug }, { slug: dishIdOrSlug }] } : { slug: dishIdOrSlug }),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException('Món ăn không tồn tại.');
    }
    const dishId = dish.id;

    if (event === 'view') {
      const since = new Date(Date.now() - 3 * 60 * 1000);
      const isAnon = userId === '00000000-0000-0000-0000-000000000000';
      const recent = await this.prisma.db.recommendationLog.findFirst({
        where: {
          dishId,
          event: 'view',
          createdAt: { gte: since },
          ...(!isAnon ? { userId } : {}),
        },
        select: { id: true },
      });
      if (recent) {
        return { accepted: false, reason: 'RATE_LIMITED' };
      }
    }

    await this.prisma.db.recommendationLog.create({
      data: {
        userId,
        dishId,
        event,
        position: null,
        sessionId: source ?? null,
      },
    });

    return { accepted: true };
  }

  /** POST /dishes/:id/save — idempotent upsert */
  async saveDish(userId: string, dishId: string): Promise<SaveDishResponseDto> {
    const dish = await this.prisma.db.dish.findFirst({
      where: { id: dishId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException('Món ăn không tồn tại hoặc đã bị ẩn.');
    }

    const saved = await this.prisma.db.savedDish.upsert({
      where: { userId_dishId: { userId, dishId } },
      create: { userId, dishId },
      update: {},
      select: { id: true, savedAt: true },
    });

    this.prisma.db.recommendationLog
      .create({
        data: { userId, dishId, event: 'save', position: null },
      })
      .catch(() => {});

    return {
      dishId,
      saved: true,
      savedAt: saved.savedAt.toISOString(),
    };
  }

  /** DELETE /dishes/:id/save — idempotent delete */
  async unsaveDish(userId: string, dishId: string): Promise<UnsaveDishResponseDto> {
    const dish = await this.prisma.db.dish.findFirst({
      where: { id: dishId },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException('Món ăn không tồn tại.');
    }

    await this.prisma.db.savedDish
      .delete({
        where: { userId_dishId: { userId, dishId } },
      })
      .catch(() => {});

    return { dishId, saved: false };
  }
}
