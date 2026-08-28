import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GreetingDto,
  HomeDashboardResponseDto,
  NutritionSummaryDto,
  RecommendationCardDto,
} from './dto/home-dashboard.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lấy giờ hiện tại theo múi giờ Asia/Ho_Chi_Minh */
function getVNHour(): number {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnTime.getHours();
}

/** Ngày local VN theo định dạng YYYY-MM-DD */
function getVNLocalDate(): string {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnTime.toISOString().slice(0, 10);
}

/** HOME-BR-002: Greeting theo giờ */
function buildGreeting(displayName: string | null | undefined): GreetingDto {
  const hour = getVNHour();
  let phrase: string;
  if (hour >= 5 && hour < 11) phrase = 'Chào buổi sáng';
  else if (hour >= 11 && hour < 14) phrase = 'Chào buổi trưa';
  else if (hour >= 14 && hour < 18) phrase = 'Chào buổi chiều';
  else phrase = 'Chào buổi tối';

  // HOME-BR-003: fallback "bạn", không dùng email
  const name = displayName?.trim() || 'bạn';
  return { phrase, name, full: `${phrase}, ${name}!` };
}

/** Timeout wrapper cho bất kỳ Promise nào */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string): Promise<HomeDashboardResponseDto> {
    const localDate = getVNLocalDate();

    // ── 1. Load profile ────────────────────────────────────────────────────
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        profileVersion: true,
        userAllergens: { select: { allergen: { select: { code: true } } } },
        userGoals: {
          select: { goal: { select: { code: true } }, priority: true },
        },
        goalKcal: true,
      },
    });

    const profileVersion = profile?.profileVersion ?? 1;
    const allergenCodes = (profile?.userAllergens ?? []).map((ua) => ua.allergen.code);
    const goalCodes = (profile?.userGoals ?? []).map((ug) => ug.goal.code);

    // ── 2. Parallel widget loading (HOME-BR-019: widget isolation) ─────────
    const TIMEOUT_MS = 1500;

    const [recResult, nutritionResult, notifResult] = await Promise.allSettled([
      withTimeout(this.getTopRecommendations(userId, allergenCodes, goalCodes), TIMEOUT_MS),
      withTimeout(this.getNutritionSummary(userId, localDate, profile?.goalKcal ?? null), TIMEOUT_MS),
      withTimeout(this.getUnreadCount(userId), TIMEOUT_MS),
    ]);

    // ── 3. Assemble response ───────────────────────────────────────────────
    const greeting = buildGreeting(profile?.displayName);

    // Recommendations
    let recommendationsStatus: 'ok' | 'error' | 'empty' = 'error';
    let recommendations: RecommendationCardDto[] | undefined;
    if (recResult.status === 'fulfilled') {
      recommendations = recResult.value;
      recommendationsStatus = recommendations.length === 0 ? 'empty' : 'ok';
    } else {
      this.logger.warn(`Recommendations widget failed: ${recResult.reason}`);
    }

    // Nutrition
    let nutritionStatus: 'ok' | 'error' | 'empty' = 'error';
    let nutritionSummary: NutritionSummaryDto | undefined;
    if (nutritionResult.status === 'fulfilled') {
      nutritionSummary = nutritionResult.value;
      nutritionStatus = nutritionSummary.dataStatus === 'no_data' ? 'empty' : 'ok';
    } else {
      this.logger.warn(`Nutrition widget failed: ${nutritionResult.reason}`);
    }

    // Notifications
    let notificationStatus: 'ok' | 'error' = 'error';
    let unreadCount = 0;
    if (notifResult.status === 'fulfilled') {
      unreadCount = notifResult.value;
      notificationStatus = 'ok';
    } else {
      this.logger.warn(`Notification widget failed: ${notifResult.reason}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      localDate,
      cacheTtl: 300,
      profileVersion,
      greetingStatus: 'ok',
      greeting,
      recommendationsStatus,
      recommendations,
      nutritionStatus,
      nutritionSummary,
      notificationStatus,
      unreadCount,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getTopRecommendations(
    userId: string,
    allergenCodes: string[],
    goalCodes: string[] = [],
  ): Promise<RecommendationCardDto[]> {
    // Lấy danh sách món đã lưu (bảng saved_dishes có thể chưa migrate)
    let savedDishIds = new Set<string>();
    try {
      const saved = await (this.prisma.db as any).savedDish.findMany({
        where: { userId },
        select: { dishId: true },
      });
      savedDishIds = new Set(saved.map((s: { dishId: string }) => s.dishId));
    } catch {
      // bảng saved_dishes chưa tồn tại — bỏ qua, isSaved = false
    }

    // Lấy món PUBLISHED với allergen hard-filter (BA-004)
    const allDishes = await this.prisma.db.dish.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        // Hard-filter: loại bỏ cứng các món CONTAINS allergen của user
        ...(allergenCodes.length > 0
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
        ratingAvg: true,
        ratingCount: true,
        media: {
          where: { isPrimary: true, moderationStatus: 'APPROVED' },
          select: { storageKey: true, bucket: true },
          take: 1,
        },
        nutrition: { select: { calories: true } },
        // Include dish goals để tính score
        dishGoals: {
          include: { goal: { select: { code: true } } },
        },
      },
      take: 100,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });

    const SUPABASE_URL = process.env.SUPABASE_URL || '';

    // Tính score dựa theo goal overlap: mỗi matched goal cộng thêm dish_goals.score
    const scored = allDishes
      .map((d) => {
        const goalScore = d.dishGoals
          .filter((dg) => goalCodes.includes(dg.goal.code))
          .reduce((sum, dg) => sum + dg.score, 0);

        // Rating bonus: dishes có rating cao được ưu tiên nhẹ
        const ratingBonus = Number(d.ratingAvg ?? 0) * 10;

        return { dish: d, score: goalScore + ratingBonus };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-break: deterministic per user+date
        const seed = userId.charCodeAt(0) + new Date().getDate();
        const ha = (a.dish.id.charCodeAt(0) + seed) % 256;
        const hb = (b.dish.id.charCodeAt(0) + seed) % 256;
        return ha - hb;
      });

    return scored.slice(0, 5).map(({ dish: d }) => {
      const media = d.media[0];
      let imageUrl: string | undefined;
      if (media?.storageKey) {
        const bucket = media.bucket ?? 'dish-images';
        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${media.storageKey}`;
      }

      // Tạo lý do ngắn dựa vào goal match
      let reasonShort = 'Phù hợp với khẩu vị của bạn';
      const matchedGoals = d.dishGoals
        .filter((dg) => goalCodes.includes(dg.goal.code))
        .map((dg) => dg.goal.code);
      if (matchedGoals.length > 0) {
        reasonShort = 'Phù hợp với mục tiêu của bạn';
      }

      return {
        dishId: d.id,
        name: d.name,
        imageUrl,
        calories: Number(d.nutrition?.calories ?? 0),
        prepMinutes: d.prepMinutes ?? 0,
        priceRange: d.priceMin != null ? `${d.priceMin}-${d.priceMax ?? d.priceMin}` : undefined,
        reasonShort,
        isSaved: savedDishIds.has(d.id),
      };
    });
  }

  private async getNutritionSummary(
    userId: string,
    localDate: string,
    goalKcal: number | null,
  ): Promise<NutritionSummaryDto> {
    // Query meal logs for today (HOME-BR-011: localDate)
    const logs = await this.prisma.db.mealLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: new Date(`${localDate}T00:00:00+07:00`),
          lt: new Date(`${localDate}T23:59:59+07:00`),
        },
      },
      select: { totalKcal: true },
    });

    if (logs.length === 0) {
      // HOME-BR-012: không hiển thị số 0
      return { date: localDate, dataStatus: 'no_data' };
    }

    const caloriesConsumed = logs.reduce((sum, l) => sum + l.totalKcal, 0);

    return {
      date: localDate,
      dataStatus: goalKcal && caloriesConsumed >= goalKcal * 0.8 ? 'complete' : 'partial',
      caloriesConsumed,
      calorieTarget: goalKcal ?? undefined,
    };
  }

  private async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.db.notification.count({
        where: { userId, status: 'UNREAD' },
      });
    } catch {
      // bảng notifications chưa tồn tại — trả về 0
      return 0;
    }
  }
}


