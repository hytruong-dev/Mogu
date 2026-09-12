import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DishEligibilityService } from '../dishes/eligibility/dish-eligibility.service';
import {
  GreetingDto,
  HomeDashboardResponseDto,
  HomeWidgetsDto,
  NutritionSummaryDto,
  RecommendationCardDto,
} from './dto/home-dashboard.dto';
import { HomeQueryDto } from './dto/home-query.dto';

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

function resolveTimezone(timezone?: string): string {
  if (!timezone?.trim()) return DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
    return timezone.trim();
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getLocalDateInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

function getLocalHourInTimezone(timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return Number(hour);
}

function getTimezoneOffsetMs(timeZone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return tzDate.getTime() - utcDate.getTime();
}

function zonedLocalTimeToUtc(localDate: string, localTime: string, timeZone: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute, second = 0] = localTime.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimezoneOffsetMs(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offset);
}

function addDaysToDateString(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

function getDayBounds(localDate: string, timezone: string): { gte: Date; lt: Date } {
  const gte = zonedLocalTimeToUtc(localDate, '00:00:00', timezone);
  const lt = zonedLocalTimeToUtc(addDaysToDateString(localDate, 1), '00:00:00', timezone);
  return { gte, lt };
}

function buildGreeting(displayName: string | null | undefined, timezone: string): GreetingDto {
  const hour = getLocalHourInTimezone(timezone);
  let phrase: string;
  if (hour >= 5 && hour < 11) phrase = 'Chào buổi sáng';
  else if (hour >= 11 && hour < 14) phrase = 'Chào buổi trưa';
  else if (hour >= 14 && hour < 18) phrase = 'Chào buổi chiều';
  else phrase = 'Chào buổi tối';

  const name = displayName?.trim() || 'bạn';
  return { phrase, name, full: `${phrase}, ${name}!` };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: DishEligibilityService,
  ) {}

  async getDashboard(userId: string, query: HomeQueryDto = {}): Promise<HomeDashboardResponseDto> {
    const timezone = resolveTimezone(query.timezone);
    const localDate = query.localDate ?? getLocalDateInTimezone(timezone);

    const profile: any = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: {
        userAllergens: { select: { allergen: { select: { code: true } } } },
        userDietTypes: { select: { isHard: true, dietType: { select: { code: true } } } },
        userAvoidedIngredients: { select: { ingredientName: true } },
        userGoals: {
          select: { goal: { select: { code: true } }, priority: true },
        },
      },
    });

    const profileVersion = profile?.profileVersion ?? 1;
    const allergenCodes = (profile?.userAllergens ?? []).map((ua: any) => ua.allergen.code);
    const hardDietTypeCodes = (profile?.userDietTypes ?? [])
      .filter((d: any) => d.isHard)
      .map((d: any) => d.dietType.code);
    const avoidedIngredients = (profile?.userAvoidedIngredients ?? []).map((i: any) =>
      i.ingredientName.trim().toLowerCase(),
    );
    const goalCodes = (profile?.userGoals ?? []).map((ug: any) => ug.goal.code);

    const TIMEOUT_MS = 1500;

    const [recResult, nutritionResult, notifResult, weeklyResult] = await Promise.allSettled([
      withTimeout(
        this.getTopRecommendations(
          userId,
          { allergenCodes, hardDietTypeCodes, avoidedIngredients },
          goalCodes,
        ),
        TIMEOUT_MS,
      ),
      withTimeout(
        this.getNutritionSummary(
          userId,
          localDate,
          timezone,
          profile?.goalKcal ?? null,
          2000,
        ),
        TIMEOUT_MS,
      ),
      withTimeout(this.getUnreadCount(userId), TIMEOUT_MS),
      withTimeout(this.getWeeklyPlanWidget(userId, localDate), TIMEOUT_MS),
    ]);

    const greeting = buildGreeting(profile?.displayName, timezone);
    const hour = getLocalHourInTimezone(timezone);
    const timeOfDay =
      hour >= 5 && hour < 11
        ? 'MORNING'
        : hour >= 11 && hour < 14
          ? 'NOON'
          : hour >= 14 && hour < 18
            ? 'AFTERNOON'
            : 'EVENING';

    // Recommendations
    let recommendationsStatus: 'ok' | 'error' | 'empty' = 'error';
    let recommendations: RecommendationCardDto[] | undefined;
    if (recResult.status === 'fulfilled') {
      recommendations = recResult.value;
      recommendationsStatus = recommendations.length === 0 ? 'empty' : 'ok';
    }

    // Nutrition
    let nutritionStatus: 'ok' | 'error' | 'empty' = 'error';
    let nutritionSummary: NutritionSummaryDto | undefined;
    if (nutritionResult.status === 'fulfilled') {
      nutritionSummary = nutritionResult.value;
      nutritionStatus = nutritionSummary.dataStatus === 'no_data' ? 'empty' : 'ok';
    }

    // Notifications
    let notificationStatus: 'ok' | 'error' = 'error';
    let unreadCount = 0;
    if (notifResult.status === 'fulfilled') {
      unreadCount = notifResult.value;
      notificationStatus = 'ok';
    }

    // Weekly Plan Widget
    const weeklyWidgetData =
      weeklyResult.status === 'fulfilled'
        ? weeklyResult.value
        : { status: 'unavailable' as const, data: null };

    // Structure Section 4 `widgets` object
    const widgets: HomeWidgetsDto = {
      greeting: {
        status: 'ok',
        data: {
          text: greeting.full,
          timeOfDay,
        },
      },
      weather: {
        status: 'ok',
        data: {
          condition: 'SUNNY',
          temperatureC: 31,
          suggestionText: 'Thời tiết oi nóng, ưu tiên món thanh mát nhẹ nhàng.',
        },
      },
      weeklyPlan: weeklyWidgetData,
      nutrition: {
        status: nutritionStatus === 'error' ? 'unavailable' : 'ok',
        data: nutritionSummary
          ? {
              consumedKcal: nutritionSummary.caloriesConsumed ?? 0,
              targetKcal: nutritionSummary.calorieTarget ?? 2000,
              remainingKcal: Math.max(
                0,
                (nutritionSummary.calorieTarget ?? 2000) -
                  (nutritionSummary.caloriesConsumed ?? 0),
              ),
              waterMl: nutritionSummary.waterMl ?? 0,
              waterTargetMl: 2000,
            }
          : null,
      },
      recommendations: {
        status: recommendationsStatus === 'error' ? 'unavailable' : 'ok',
        data: (recommendations ?? []).map((r) => ({
          id: r.dishId,
          name: r.name,
          imageUrl: r.imageUrl,
          energyKcal: r.calories,
          priceMin: r.priceRange ? Number(r.priceRange.split('-')[0]) : undefined,
          cookingTimeMinutes: r.prepMinutes,
          isSaved: r.isSaved,
        })),
      },
      notifications: {
        status: notificationStatus === 'error' ? 'unavailable' : 'ok',
        data: {
          unreadCount,
        },
      },
    };

    return {
      generatedAt: new Date().toISOString(),
      localDate,
      cacheTtl: 300,
      cacheTtlSec: 300,
      profileVersion,
      widgets,
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

  private async getTopRecommendations(
    userId: string,
    eligibilityProfile: {
      allergenCodes: string[];
      hardDietTypeCodes: string[];
      avoidedIngredients: string[];
    },
    goalCodes: string[] = [],
  ): Promise<RecommendationCardDto[]> {
    let savedDishIds = new Set<string>();
    try {
      const saved = await (this.prisma.db as any).savedDish.findMany({
        where: { userId },
        select: { dishId: true },
      });
      savedDishIds = new Set(saved.map((s: { dishId: string }) => s.dishId));
    } catch {
      // Saved dish table check fallback
    }

    const allDishes = await this.prisma.db.dish.findMany({
      where: this.eligibility.buildHardWhere(eligibilityProfile, 'home'),
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
        dishGoals: {
          include: { goal: { select: { code: true } } },
        },
      },
      take: 100,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });

    const SUPABASE_URL = process.env.SUPABASE_URL || '';

    const scored = allDishes
      .map((d) => {
        const goalScore = d.dishGoals
          .filter((dg) => goalCodes.includes(dg.goal.code))
          .reduce((sum, dg) => sum + dg.score, 0);

        const ratingBonus = Number(d.ratingAvg ?? 0) * 10;
        return { dish: d, score: goalScore + ratingBonus };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
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
    timezone: string,
    goalKcal: number | null,
    goalWaterMl: number = 2000,
  ): Promise<NutritionSummaryDto> {
    const { gte, lt } = getDayBounds(localDate, timezone);

    const logs = await (this.prisma.db as any).diaryMealLog
      .findMany({
        where: {
          userId,
          loggedAt: { gte, lt },
        },
        select: { totalKcal: true },
      })
      .catch(() => []);

    const waterLogs = await (this.prisma.db as any).waterLog
      .findMany({
        where: {
          userId,
          loggedAt: { gte, lt },
        },
        select: { amountMl: true },
      })
      .catch(() => []);

    const waterMl = waterLogs.reduce(
      (sum: number, w: { amountMl: number }) => sum + w.amountMl,
      0,
    );

    if (logs.length === 0 && waterMl === 0) {
      return { date: localDate, dataStatus: 'no_data', waterMl: 0 };
    }

    const caloriesConsumed = logs.reduce(
      (sum: number, l: { totalKcal: number }) => sum + l.totalKcal,
      0,
    );

    return {
      date: localDate,
      dataStatus: goalKcal && caloriesConsumed >= goalKcal * 0.8 ? 'complete' : 'partial',
      caloriesConsumed,
      calorieTarget: goalKcal ?? undefined,
      waterMl,
    };
  }

  private async getWeeklyPlanWidget(userId: string, localDate: string) {
    try {
      const plan = await (this.prisma.db as any).weeklyPlan.findFirst({
        where: { userId, status: { in: ['READY', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          slots: {
            select: { planDate: true, slotStatus: true, dish: { select: { priceMin: true } } },
          },
        },
      });

      if (!plan) return { status: 'no_data' as const, data: null };

      const todaySlots = plan.slots.filter(
        (s: any) =>
          s.planDate &&
          s.planDate.toISOString().slice(0, 10) === localDate,
      );
      const completedMealsCount = todaySlots.filter(
        (s: any) => s.slotStatus === 'COMPLETED',
      ).length;

      let spent = 0;
      for (const s of plan.slots) {
        if (s.slotStatus === 'COMPLETED' && s.dish?.priceMin) {
          spent += s.dish.priceMin;
        }
      }
      const totalBudget = plan.totalBudgetVnd ?? 0;
      const remainingBudgetVnd = Math.max(0, totalBudget - spent);

      return {
        status: 'ok' as const,
        data: {
          planId: plan.id,
          status: plan.status,
          todayMealsCount: todaySlots.length,
          completedMealsCount,
          remainingBudgetVnd,
        },
      };
    } catch {
      return { status: 'no_data' as const, data: null };
    }
  }

  private async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.prisma.db.notification.count({
        where: { userId, status: 'UNREAD' },
      });
    } catch {
      return 0;
    }
  }
}
