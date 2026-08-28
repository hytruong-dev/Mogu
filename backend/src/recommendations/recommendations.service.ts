import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RecommendationListResponseDto,
  RecommendationQueryDto,
} from './dto/recommendation-query.dto';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHomeRecommendations(
    userId: string,
    query: RecommendationQueryDto,
  ): Promise<RecommendationListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // 1. Load user allergens — hard constraints (HOME-BR-008)
    const userAllergens = await this.prisma.db.userAllergen.findMany({
      where: { userId },
      select: { allergen: { select: { code: true } } },
    });
    const allergenCodes = userAllergens.map((ua) => ua.allergen.code);

    // 2. Query published dishes — hard-exclude allergens via BA-004 schema
    const fetchCount = (page + 2) * limit + 50;
    const allDishes = await this.prisma.db.dish.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(allergenCodes.length
          ? {
              dishAllergens: {
                none: {
                  allergen: { code: { in: allergenCodes } },
                  level: 'CONTAINS',
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        prepMinutes: true,
        priceMin: true,
        priceMax: true,
        media: {
          where: { isPrimary: true, moderationStatus: 'APPROVED' },
          select: { storageKey: true, bucket: true },
          take: 1,
        },
        nutrition: { select: { calories: true } },
        savedByUsers: { where: { userId }, select: { id: true } },
      },
      take: fetchCount,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });

    // 3. Hard-exclude allergens already done at DB level; safe = allDishes
    const safe = allDishes;

    // 4. Rank: deterministic shuffle per user+date for MVP
    const today = new Date();
    const seed =
      userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) +
      today.getFullYear() * 10000 +
      (today.getMonth() + 1) * 100 +
      today.getDate();

    const ranked = [...safe].sort((a, b) => {
      const ha = (a.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) + seed) % 1000;
      const hb = (b.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) + seed) % 1000;
      return ha - hb;
    });

    const paginated = ranked.slice(skip, skip + limit + 1);
    const hasMore = paginated.length > limit;
    const items = paginated.slice(0, limit);

    // 5. Build reason based on goal code
    const reasonMap: Record<string, string> = {
      BALANCE: 'Phù hợp với mục tiêu cân bằng dinh dưỡng',
      LOSE_WEIGHT: 'Ít calo, hỗ trợ giảm cân',
      BUILD_MUSCLE: 'Giàu protein, hỗ trợ tăng cơ',
      EAT_HEALTHY: 'Lành mạnh và tốt cho sức khỏe',
      EXPLORE: 'Khám phá hương vị mới',
    };
    const reasonShort = query.goalCode ? (reasonMap[query.goalCode] ?? 'Phù hợp với khẩu vị của bạn') : 'Phù hợp với khẩu vị của bạn';

    // 6. Log impressions (fire-and-forget, không block response)
    this.logImpressions(userId, items.map((d) => d.id), query.goalCode).catch((err) =>
      this.logger.warn(`Failed to log impressions: ${err}`),
    );

    const R2_BASE = process.env.R2_PUBLIC_BASE_URL || '';
    return {
      data: items.map((d) => ({
        dishId: d.id,
        name: d.name,
        imageUrl: d.media[0]?.storageKey ? `${R2_BASE}/${d.media[0].storageKey}` : undefined,
        calories: Number(d.nutrition?.calories ?? 0),
        prepMinutes: d.prepMinutes ?? 0,
        priceRange: d.priceMin != null ? `${d.priceMin}-${d.priceMax ?? d.priceMin}` : undefined,
        reasonShort,
        isSaved: d.savedByUsers.length > 0,
      })),
      page,
      limit,
      hasMore,
    };
  }

  private async logImpressions(
    userId: string,
    dishIds: string[],
    goalCode?: string,
  ): Promise<void> {
    if (!dishIds.length) return;
    const sessionId = `${userId}-${Date.now()}`;
    await this.prisma.db.recommendationLog.createMany({
      data: dishIds.map((dishId, position) => ({
        userId,
        dishId,
        event: 'impression',
        position,
        sessionId,
        goalCode,
      })),
    });
  }
}


