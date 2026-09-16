import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RequestChangesDto, ReviewActionDto } from './dto/review-action.dto';

@Injectable()
export class DishReviewService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
  }

  private buildPublicUrl(storageKey: string, bucket: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${storageKey}`;
  }

  /** Hàng đợi kiểm duyệt */
  async getReviewQueue(query: {
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const { status = 'PENDING_REVIEW', cursor, limit = 20 } = query;
    const take = Math.min(limit, 100);

    const where = {
      status: status as any,
      deletedAt: null,
      ...(cursor ? { id: { gt: cursor } } : {}),
    };

    const [dishes, total] = await Promise.all([
      this.prisma.db.dish.findMany({
        where,
        include: {
          region: { select: { id: true, name: true } },
          categories: {
            include: { category: { select: { code: true, name: true } } },
          },
          media: {
            where: { isPrimary: true },
            select: { id: true, storageKey: true, bucket: true, isPrimary: true },
            take: 1,
          },
          nutrition: true,
        },
        orderBy: { updatedAt: 'asc' },
        take: take + 1,
      }),
      this.prisma.db.dish.count({ where: { status: status as any, deletedAt: null } }),
    ]);

    const hasNextPage = dishes.length > take;
    const slice = hasNextPage ? dishes.slice(0, take) : dishes;
    const nextCursor = hasNextPage ? slice[slice.length - 1]?.id : null;

    const data = slice.map((dish) => ({
      ...dish,
      nutritionProfiles: dish.nutrition ? [dish.nutrition] : [],
      media: (dish.media ?? []).map((m) => ({
        ...m,
        publicUrl: this.buildPublicUrl(m.storageKey, m.bucket),
      })),
    }));

    return { data, total, pageInfo: { nextCursor, hasNextPage } };
  }

  /** Duyệt & publish */
  async approve(dishId: string, actorId: string, dto: ReviewActionDto) {
    const dish = await this.findDishOrFail(dishId);

    if (dish.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        message: 'Chỉ duyệt được món đang chờ kiểm duyệt.',
        error: { code: 'INVALID_STATUS', message: 'Chỉ duyệt được món đang chờ kiểm duyệt.' },
      });
    }

    const ingredients = await this.prisma.db.dishIngredient.findMany({
      where: { dishId },
      include: { ingredient: { select: { id: true, status: true, name: true } } },
    });

    const unresolved = ingredients.filter(
      (row) =>
        !row.ingredientId ||
        !row.ingredient ||
        row.ingredient.status !== 'ACTIVE',
    );
    if (unresolved.length) {
      throw new BadRequestException({
        message: 'Còn nguyên liệu chưa liên kết hoặc chưa duyệt ACTIVE.',
        error: {
          code: 'INGREDIENTS_NOT_READY',
          message: 'Còn nguyên liệu chưa liên kết hoặc chưa duyệt ACTIVE.',
          unresolved: unresolved.map((r) => ({
            dishIngredientId: r.id,
            rawText: r.rawText,
            ingredientId: r.ingredientId,
            status: r.ingredient?.status ?? null,
          })),
        },
      });
    }

    const updated = await this.prisma.db.dish.update({
      where: { id: dishId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: actorId,
        publishVersion: { increment: 1 },
        version: { increment: 1 },
      },
    });

    // Tự động duyệt media PENDING của món khi publish
    await this.prisma.db.dishMedia.updateMany({
      where: { dishId, moderationStatus: 'PENDING' },
      data: { moderationStatus: 'APPROVED' },
    });

    return updated;
  }

  /** Yêu cầu sửa */
  async requestChanges(dishId: string, actorId: string, dto: RequestChangesDto) {
    const dish = await this.findDishOrFail(dishId);

    if (dish.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        message: 'Món phải ở trạng thái chờ duyệt.',
        error: { code: 'INVALID_STATUS', message: 'Món phải ở PENDING_REVIEW.' },
      });
    }

    return this.prisma.db.dish.update({
      where: { id: dishId },
      data: { status: 'CHANGES_REQUESTED' },
    });
  }

  /** Từ chối */
  async reject(dishId: string, actorId: string, dto: ReviewActionDto) {
    const dish = await this.findDishOrFail(dishId);

    if (dish.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        message: 'Món phải ở trạng thái chờ duyệt.',
        error: { code: 'INVALID_STATUS', message: 'Món phải ở PENDING_REVIEW.' },
      });
    }

    return this.prisma.db.dish.update({
      where: { id: dishId },
      data: { status: 'REJECTED' },
    });
  }

  private async findDishOrFail(dishId: string) {
    const dish = await this.prisma.db.dish.findUnique({ where: { id: dishId } });
    if (!dish || dish.deletedAt) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }
    return dish;
  }
}
