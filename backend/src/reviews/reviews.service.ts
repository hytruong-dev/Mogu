import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách đánh giá của món ăn */
  async listByDish(dishId: string, query: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = query;
    const take = Math.min(limit, 50);

    const reviews = await this.prisma.db.review.findMany({
      where: {
        dishId,
        isVisible: true,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: {
        profile: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasNextPage = reviews.length > take;
    const data = hasNextPage ? reviews.slice(0, take) : reviews;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return { data, pageInfo: { nextCursor, hasNextPage } };
  }

  /** Tính lại rating_avg + rating_count từ reviews và cập nhật vào dishes */
  private async syncDishRating(dishId: string): Promise<void> {
    const agg = await this.prisma.db.review.aggregate({
      where: { dishId, isVisible: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.db.dish.update({
      where: { id: dishId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });
  }

  /** User tạo/cập nhật đánh giá */
  async upsertReview(dishId: string, userId: string, dto: CreateReviewDto) {
    // Kiểm tra món tồn tại
    const dish = await this.prisma.db.dish.findUnique({
      where: { id: dishId, deletedAt: null },
    });
    if (!dish) {
      throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' } });
    }

    const existing = await this.prisma.db.review.findUnique({
      where: { dishId_userId: { dishId, userId } },
    });

    let result: any;
    if (existing) {
      result = await this.prisma.db.review.update({
        where: { dishId_userId: { dishId, userId } },
        data: {
          rating: dto.rating,
          comment: dto.comment,
          isVisible: true,
        },
        include: {
          profile: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });
    } else {
      result = await this.prisma.db.review.create({
        data: {
          dishId,
          userId,
          rating: dto.rating,
          comment: dto.comment,
        },
        include: {
          profile: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });
    }

    // Cập nhật rating_avg + rating_count sau mỗi thao tác
    await this.syncDishRating(dishId);
    return result;
  }

  /** User xóa đánh giá của mình */
  async deleteMyReview(dishId: string, userId: string) {
    const existing = await this.prisma.db.review.findUnique({
      where: { dishId_userId: { dishId, userId } },
    });

    if (!existing) {
      throw new NotFoundException({ error: { code: 'REVIEW_NOT_FOUND', message: 'Bạn chưa đánh giá món này.' } });
    }

    await this.prisma.db.review.delete({
      where: { dishId_userId: { dishId, userId } },
    });

    // Cập nhật rating_avg + rating_count sau khi xóa
    await this.syncDishRating(dishId);
    return { deleted: true };
  }

  /** Admin: danh sách tất cả reviews */
  async adminList(query: { dishId?: string; userId?: string; isVisible?: boolean; page?: number; limit?: number }) {
    const { dishId, userId, isVisible, page = 1, limit = 20 } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: any = {
      ...(dishId ? { dishId } : {}),
      ...(userId ? { userId } : {}),
      ...(isVisible !== undefined ? { isVisible } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.db.review.count({ where }),
      this.prisma.db.review.findMany({
        where,
        include: {
          profile: { select: { id: true, displayName: true } },
          dish: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      data: items,
      pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  /** Admin: ẩn hoặc hiện lại review */
  async hideReview(reviewId: string, isVisible = false) {
    const review = await this.prisma.db.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException({ error: { code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy review.' } });
    }

    const updated = await this.prisma.db.review.update({
      where: { id: reviewId },
      data: { isVisible },
    });

    // Cập nhật rating_avg + rating_count khi ẩn review
    await this.syncDishRating(review.dishId);
    return updated;
  }

  /** Admin: xóa cứng review */
  async adminDeleteReview(reviewId: string) {
    const review = await this.prisma.db.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException({ error: { code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy review.' } });
    }

    await this.prisma.db.review.delete({ where: { id: reviewId } });

    // Cập nhật rating_avg + rating_count sau khi xóa
    await this.syncDishRating(review.dishId);
    return { deleted: true, id: reviewId };
  }
}
