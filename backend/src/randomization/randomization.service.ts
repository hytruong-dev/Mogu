import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-import/ai.service';
import {
  BudgetModeEnum,
  MealSlotEnum,
  RandomHistoryQueryDto,
  RandomizationRequestDto,
  RecommendationEventDto,
  RecommendationSourceEnum,
  RetryRandomizationDto,
  SelectRandomizationDto,
} from './dto/randomization.dto';

const ALGORITHM_VERSION = 'rule-v2.0.0';
const RECENT_EXCLUSION_DAYS = 7;

// Đọc lazily để đảm bảo env đã được inject bởi NestJS ConfigModule
function buildImageUrl(media: { storageKey?: string | null; bucket?: string | null } | undefined | null): string | null {
  if (!media?.storageKey) return null;
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!supabaseUrl) return null;
  const bucket = media.bucket ?? 'dish-images';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${media.storageKey}`;
}

function inferMealSlot(hour: number): MealSlotEnum {
  if (hour >= 6 && hour < 10) return MealSlotEnum.BREAKFAST;
  if (hour >= 10 && hour < 14) return MealSlotEnum.LUNCH;
  if (hour >= 14 && hour < 17) return MealSlotEnum.SNACK;
  if (hour >= 17 && hour < 22) return MealSlotEnum.DINNER;
  return MealSlotEnum.ANY;
}

export interface ScoreBreakdown {
  goalMatch: number;
  timeSuitability: number;
  popularity: number;
  dataQuality: number;
  novelty: number;
  budgetFit: number;
  total: number;
}

// ────────────────────────────────────────────────────────────────────────────────

export interface AiExplanationResult {
  summary: string;
  factors: string[];          // Lý do chi tiết có icon prefix
  nutritionHighlight: string; // VD: "Cung cấp 420 kcal, 28g protein — đủ năng lượng cho bữa trưa"
  matchTags: string[];        // VD: ["Bữa trưa", "Cân bằng", "Trong ngân sách"]
  tip?: string;               // Mẹo nhỏ: "Ăn kèm rau sống để tăng chất xơ"
}

@Injectable()
export class RandomizationService {
  private readonly logger = new Logger(RandomizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // GET /randomization-context  (BA-006 §4.1)
  // ══════════════════════════════════════════════════════════════════════════════
  async getContext(userId: string) {
    const [profile, goals, recentRaw, savedDishIds] = await Promise.all([
      this.prisma.db.profile.findUnique({
        where: { userId },
        include: {
          userAllergens: { include: { allergen: true } },
          userDietTypes: { include: { dietType: true } },
          userDietaryPreferences: { include: { preference: true } },
        },
      }),
      this.prisma.db.goal.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.db.randomHistory.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
        select: { dishId: true, createdAt: true, isSelected: true, scoreBreakdown: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.db.savedDish.findMany({
        where: { userId },
        select: { dishId: true },
        take: 100,
      }),
    ]);

    const currentHour = new Date().getHours();
    const currentMealSlot = inferMealSlot(currentHour);

    // Thống kê recent
    const recentDishIds = recentRaw.filter((r) => r.dishId).map((r) => r.dishId as string);
    const selectedCount = recentRaw.filter((r) => r.isSelected).length;

    // Profile version (tổng số thay đổi preferences, budget, v.v.)
    const profileVersion = (profile?.updatedAt as any)
      ? Math.floor((Date.now() - new Date(profile!.updatedAt as any).getTime()) / 86400_000)
      : 1;

    return {
      currentMealSlot,
      suggestedMealSlot: currentMealSlot,
      profileSnapshot: profile
        ? {
            allergenCodes: profile.userAllergens.map((a) => a.allergen.code),
            dietTypeCodes: profile.userDietTypes.map((d) => d.dietType.code),
            hardDietTypeCodes: profile.userDietTypes.filter((d) => d.isHard).map((d) => d.dietType.code),
            preferenceCodes: profile.userDietaryPreferences.map((p) => p.preference.code),
          }
        : null,
      recentDishIds,
      savedDishIds: savedDishIds.map((s) => s.dishId),
      stats: {
        totalRandom30d: recentRaw.length,
        selectedCount,
        selectionRate: recentRaw.length > 0 ? Math.round((selectedCount / recentRaw.length) * 100) : 0,
      },
      availableGoals: goals,
      algorithmVersion: ALGORITHM_VERSION,
      profileVersion,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POST /dish-randomizations  (BA-006 §4.2, backward-compat BA-004)
  // ══════════════════════════════════════════════════════════════════════════════
  async randomize(userId: string, dto: RandomizationRequestDto) {
    // ── Normalize: v1.1 fields override legacy ──────────────────────────────────
    const mealSlot: MealSlotEnum =
      dto.meal?.slot ??
      (dto.mealTypeCode && Object.values(MealSlotEnum).includes(dto.mealTypeCode as MealSlotEnum)
        ? (dto.mealTypeCode as MealSlotEnum)
        : inferMealSlot(new Date().getHours()));

    const goalCodes: string[] = dto.runtimeOverrides?.goalCodes ?? dto.goalCodes ?? [];
    const dietTypeCodes: string[] = dto.runtimeOverrides?.dietTypeCodes ?? dto.dietTypeCodes ?? [];
    const weatherCode: string | undefined = dto.runtimeOverrides?.weatherCode ?? dto.weatherCode;
    const budgetMax: number | undefined = dto.budget?.maxVnd ?? dto.maxBudget;
    const budgetMin: number | undefined = dto.budget?.minVnd;
    const budgetMode: BudgetModeEnum = dto.budget?.mode ?? BudgetModeEnum.UNLIMITED;
    const source: RecommendationSourceEnum = dto.source ?? RecommendationSourceEnum.RANDOM_FLOW;
    const excludeDishIds: string[] = dto.excludeDishIds ?? [];

    // ── Idempotency check ───────────────────────────────────────────────────────
    // (không chặn nếu key không có — chỉ guard nếu key tồn tại)

    // ── Load profile ────────────────────────────────────────────────────────────
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: {
        userAllergens: { include: { allergen: true } },
        userAvoidedIngredients: true,
        userDietTypes: { include: { dietType: true } },
      },
    });
    if (!profile) throw new NotFoundException({ error: { code: 'PROFILE_NOT_FOUND' } });

    const userAllergenCodes = profile.userAllergens.map((ua) => ua.allergen.code);
    const userAvoidedIngredients = profile.userAvoidedIngredients.map((i) => i.ingredientName.toLowerCase());
    const hardDietTypeCodes = profile.userDietTypes.filter((d) => d.isHard).map((d) => d.dietType.code);

    // ── Get recent dishes ────────────────────────────────────────────────────────
    const recentDishIds = (
      await this.prisma.db.randomHistory.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - RECENT_EXCLUSION_DAYS * 86400_000) } },
        select: { dishId: true },
      })
    ).filter((r) => r.dishId).map((r) => r.dishId as string);

    const startMs = Date.now();

    // ── Fetch candidates (cascade relaxation) ───────────────────────────────────
    type Opts = { withMealType: boolean; withDietType: boolean; withBudget: boolean };
    const fetchCandidates = async (opts: Opts) => {
      const where: Prisma.DishWhereInput = {
        status: 'PUBLISHED',
        deletedAt: null,
        dishAllergens: userAllergenCodes.length
          ? { none: { allergen: { code: { in: userAllergenCodes } }, level: 'CONTAINS' } }
          : undefined,
        ...(opts.withDietType && (hardDietTypeCodes.length > 0 || dietTypeCodes.length > 0)
          ? { dietTypes: { some: { dietType: { code: { in: [...hardDietTypeCodes, ...dietTypeCodes] } } } } }
          : {}),
        ...(opts.withMealType && mealSlot && mealSlot !== MealSlotEnum.ANY
          ? { mealTypes: { some: { mealTypeTag: { code: { in: [mealSlot, 'ANY'] } } } } }
          : {}),
        ...(opts.withBudget && budgetMax ? { priceMin: { lte: budgetMax } } : {}),
        ...(opts.withBudget && budgetMin ? { priceMax: { gte: budgetMin } } : {}),
      };
      return this.prisma.db.dish.findMany({
        where,
        include: {
          region: { select: { id: true, name: true } },
          dishGoals: { include: { goal: true } },
          mealTypes: { include: { mealTypeTag: { select: { name: true, code: true } } } },
          nutrition: true,
          media: {
            where: { isPrimary: true, moderationStatus: 'APPROVED' },
            select: { storageKey: true, bucket: true },
            take: 1,
          },
          dishIngredients: {
            select: {
              rawText: true, quantity: true, unit: true,
              groupLabel: true, isOptional: true, sortOrder: true,
              ingredient: {
                select: { id: true, name: true, imageUrl: true, imageKey: true },
              },
            },
            orderBy: { sortOrder: 'asc' },
            take: 20,
          },
          dishAllergens: {
            include: { allergen: { select: { id: true, name: true, code: true } } },
          },
          recipeSteps: {
            select: { stepOrder: true, instruction: true, durationMin: true, imageUrl: true },
            orderBy: { stepOrder: 'asc' as const },
          },
        },
        take: 500,
      });
    };

    const relaxLevels: Opts[] = [
      { withMealType: true, withDietType: true, withBudget: true },
      { withMealType: false, withDietType: true, withBudget: true },
      { withMealType: false, withDietType: false, withBudget: true },
      { withMealType: false, withDietType: false, withBudget: false },
    ];

    let candidates: any[] = [];
    let fallbackApplied: string[] = [];
    for (const [i, opts] of relaxLevels.entries()) {
      candidates = await fetchCandidates(opts);
      if (candidates.length > 0) {
        if (i > 0) {
          if (!opts.withMealType) fallbackApplied.push('meal_type');
          if (!opts.withDietType) fallbackApplied.push('diet_type');
          if (!opts.withBudget) fallbackApplied.push('budget');
        }
        break;
      }
    }

    // In-memory avoided ingredients filter
    if (userAvoidedIngredients.length > 0) {
      const filtered = candidates.filter((d) =>
        !userAvoidedIngredients.some((a) => d.name.toLowerCase().includes(a)),
      );
      if (filtered.length > 0) candidates = filtered;
    }

    // Remove explicit excludes (retry flow)
    const withoutExcluded = candidates.filter((d) => !excludeDishIds.includes(d.id));
    if (withoutExcluded.length > 0) candidates = withoutExcluded;

    if (candidates.length === 0) {
      // Ghi nhận thất bại
      await this.prisma.db.randomHistory.create({
        data: {
          userId,
          dishId: null,
          criteriaSnapshot: dto as any,
          algorithmVersion: ALGORITHM_VERSION,
          status: 'NO_CANDIDATE',
          source: source as any,
          mealSlot,
          budgetMode: budgetMode as any,
          budgetMinVnd: budgetMin ?? null,
          budgetMaxVnd: budgetMax ?? null,
          candidateCount: 0,
          failReasonCode: 'INSUFFICIENT_CANDIDATES',
          updatedAt: new Date(),
        },
      });
      return {
        dish: null,
        reason: null,
        randomizationId: null,
        explanation: {
          summary: 'Không tìm thấy món phù hợp.',
          compatibilityPercent: 0,
          factors: [],
          relaxableCriteria: ['mealType', 'budget', 'dietType', 'excludeList'],
          fallbackApplied: [],
        },
      };
    }

    // ── Score ────────────────────────────────────────────────────────────────────
    const currentHour = new Date().getHours();
    const scored = candidates.map((dish) => {
      const breakdown = this.scoreCandidate(dish, {
        goalCodes, currentHour, weatherCode, recentDishIds, budgetMax,
      });
      const samplingWeight = breakdown.total / candidates.length;
      return { dish, score: breakdown.total, breakdown, samplingWeight };
    });

    const selected = this.weightedRandomSample(scored);
    const top5 = scored.sort((a, b) => b.score - a.score).slice(0, 5);

    // ── Build explanation (rule-based base + AI enhancement) ───────────────────
    const reason = this.buildReason(selected.dish, { goalCodes, mealSlot, weatherCode });
    const compatibilityPercent = Math.min(100, Math.round((selected.score / 100) * 100));

    // ── Gọi AI để tạo lý do chi tiết (async, không block DB write) ────────────
    let aiExplanation: AiExplanationResult | null = null;
    try {
      // Load profile chi tiết để AI có context đầy đủ
      const profileFull = await this.prisma.db.profile.findUnique({
        where: { userId },
        include: {
          userAllergens: { include: { allergen: true } },
          userDietTypes: { include: { dietType: true } },
          userGoals: { include: { goal: true } },
        },
      });

      aiExplanation = await this.generateAiExplanation({
        dish: selected.dish,
        profile: {
          displayName: profileFull?.displayName ?? null,
          age: profileFull?.dateOfBirth
            ? Math.floor((Date.now() - new Date(profileFull.dateOfBirth as any).getTime()) / (365.25 * 86400_000))
            : null,
          goals: profileFull?.userGoals?.map((g: any) => g.goal.name) ?? goalCodes,
          allergenNames: profileFull?.userAllergens?.map((a: any) => a.allergen.name) ?? [],
          dietTypeNames: profileFull?.userDietTypes?.map((d: any) => d.dietType.name) ?? [],
        },
        mealSlot,
        compatibilityPercent,
        scoreBreakdown: selected.breakdown as any,
      });
    } catch (err) {
      this.logger.warn(`AI explanation skipped: ${err}`);
    }

    // ── Save history ─────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startMs;
    const history = await this.prisma.db.randomHistory.create({
      data: {
        userId,
        dishId: selected.dish.id,
        criteriaSnapshot: dto as any,
        scoreBreakdown: selected.breakdown as any,
        reasonSnapshot: reason as any,
        algorithmVersion: ALGORITHM_VERSION,
        status: 'COMPLETED',
        source: source as any,
        mealSlot,
        mealSelectionSource: dto.meal?.selectionSource ?? ('AUTO_TIME' as any),
        budgetMode: budgetMode as any,
        budgetMinVnd: budgetMin ?? null,
        budgetMaxVnd: budgetMax ?? null,
        candidateCount: candidates.length,
        totalScore: selected.score,
        compatibilityPercent,
        durationMs,
        fallbackSnapshot: fallbackApplied.length ? ({ relaxed: fallbackApplied } as any) : null,
        updatedAt: new Date(),
      },
    });

    // Save top-5 candidates (best-effort)
    try {
      await this.prisma.db.randomCandidate.createMany({
        data: top5.map((s, i) => ({
          randomHistoryId: history.id,
          dishId: s.dish.id,
          rank: i + 1,
          totalScore: s.score,
          samplingWeight: s.samplingWeight,
          scoreBreakdown: s.breakdown as any,
          isChosen: s.dish.id === selected.dish.id,
        })),
        skipDuplicates: true,
      });
    } catch (_) {}

    // ── Format dish ───────────────────────────────────────────────────────────────
    const imageUrl = buildImageUrl(selected.dish.media?.[0]);
    const d = selected.dish as any;
    const nutrition = d.nutrition;

    const dishDto = {
      id: d.id,
      name: d.name,
      slug: d.slug,
      shortDescription: d.shortDescription ?? null,
      imageUrl,
      priceMin: d.priceMin,
      priceMax: d.priceMax,
      prepMinutes: d.prepMinutes ?? null,
      cookMinutes: d.cookMinutes ?? null,
      originText: d.originText ?? null,
      ratingAvg: d.ratingAvg,
      ratingCount: d.ratingCount,
      region: d.region,
      mealTypes: (d.mealTypes ?? []).map((m: any) => ({
        code: m.mealTypeTag?.code,
        name: m.mealTypeTag?.name,
      })),
      nutrition: nutrition ? {
        calories: nutrition.calories ? Number(nutrition.calories) : null,
        proteinG: nutrition.proteinG ? Number(nutrition.proteinG) : null,
        carbsG: nutrition.carbsG ? Number(nutrition.carbsG) : null,
        fatG: nutrition.fatG ? Number(nutrition.fatG) : null,
        fiberG: nutrition.fiberG ? Number(nutrition.fiberG) : null,
        servingName: nutrition.servingName ?? null,
      } : null,
      ingredients: (d.dishIngredients ?? []).map((ing: any) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? '';
        let ingImageUrl: string | null = null;
        if (ing.ingredient?.imageUrl) {
          // imageUrl may already be absolute or relative
          const raw = ing.ingredient.imageUrl as string;
          ingImageUrl = raw.startsWith('http') ? raw
            : raw.startsWith('/storage') ? `${supabaseUrl}${raw}`
            : `${supabaseUrl}/storage/v1/object/public/ingredients/${raw}`;
        } else if (ing.ingredient?.imageKey) {
          ingImageUrl = `${supabaseUrl}/storage/v1/object/public/ingredients/${ing.ingredient.imageKey}`;
        }
        return {
          rawText: ing.rawText,
          ingredientName: ing.ingredient?.name ?? null,
          imageUrl: ingImageUrl,
          quantity: ing.quantity ? Number(ing.quantity) : null,
          unit: ing.unit ?? null,
          groupLabel: ing.groupLabel ?? null,
          isOptional: ing.isOptional ?? false,
        };
      }),
      allergens: (d.dishAllergens ?? []).map((a: any) => ({
        id: a.allergen?.id,
        name: a.allergen?.name,
        code: a.allergen?.code,
        level: a.level,
      })),
      difficulty: d.difficulty ?? null,
      recipeSteps: (d.recipeSteps ?? []).map((rs: any) => ({
        stepOrder: rs.stepOrder,
        instruction: rs.instruction,
        durationMin: rs.durationMin ?? null,
        imageUrl: rs.imageUrl ?? null,
      })),
    };

    // Merge AI explanation với rule-based
    const finalSummary = aiExplanation?.summary ?? reason.summary;
    const finalFactors = aiExplanation?.factors?.length
      ? aiExplanation.factors
      : reason.factors;

    return {
      randomizationId: history.id,
      dish: dishDto,
      reason,
      explanation: {
        summary: finalSummary,
        compatibilityPercent,
        factors: finalFactors,
        nutritionHighlight: aiExplanation?.nutritionHighlight ?? null,
        matchTags: aiExplanation?.matchTags ?? reason.factors.slice(0, 3),
        tip: aiExplanation?.tip ?? null,
        fallbackApplied,
        relaxableCriteria: fallbackApplied,
      },
      scoreBreakdown: selected.breakdown,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POST /dish-randomizations/:id/retry  (BA-006 §4.3)
  // ══════════════════════════════════════════════════════════════════════════════
  async retry(userId: string, randomizationId: string, dto: RetryRandomizationDto) {
    const prev = await this.prisma.db.randomHistory.findFirst({
      where: { id: randomizationId, userId },
    });
    if (!prev) throw new NotFoundException({ error: { code: 'RANDOMIZATION_NOT_FOUND' } });

    const prevCriteria = prev.criteriaSnapshot as any;
    const excludeIds: string[] = dto.excludePreviousResult !== false && prev.dishId
      ? [prev.dishId]
      : [];

    const newDto: RandomizationRequestDto = {
      ...(dto.keepCriteria !== false ? prevCriteria : {}),
      excludeDishIds: [...(prevCriteria.excludeDishIds ?? []), ...excludeIds],
      source: RecommendationSourceEnum.RANDOM_AGAIN,
    };

    const result = await this.randomize(userId, newDto);
    if (result.randomizationId) {
      // Link to previous
      await this.prisma.db.randomHistory.update({
        where: { id: result.randomizationId },
        data: { previousRandomizationId: randomizationId, attemptNo: (prev.attemptNo ?? 1) + 1 },
      });
    }
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POST /dish-randomizations/:id/select  (BA-006 §4.4)
  // ══════════════════════════════════════════════════════════════════════════════
  async markSelected(randomizationId: string, userId: string, dto?: SelectRandomizationDto) {
    const row = await this.prisma.db.randomHistory.findFirst({
      where: { id: randomizationId, userId },
    });
    if (!row) throw new NotFoundException({ error: { code: 'RANDOMIZATION_NOT_FOUND' } });

    await this.prisma.db.randomHistory.update({
      where: { id: randomizationId },
      data: { isSelected: true, selectedAt: new Date(), status: 'COMPLETED', updatedAt: new Date() },
    });

    // Ghi event SELECT
    if (row.dishId) {
      await this.prisma.db.recommendationEvent.create({
        data: { userId, randomHistoryId: randomizationId, dishId: row.dishId, eventType: 'SELECT' },
      });
    }
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POST /dish-randomizations/:id/events  (BA-006 §4.5)
  // ══════════════════════════════════════════════════════════════════════════════
  async recordEvent(userId: string, randomizationId: string, dto: RecommendationEventDto) {
    const row = await this.prisma.db.randomHistory.findFirst({
      where: { id: randomizationId, userId },
      select: { id: true, dishId: true },
    });
    if (!row) throw new NotFoundException({ error: { code: 'RANDOMIZATION_NOT_FOUND' } });

    return this.prisma.db.recommendationEvent.create({
      data: {
        userId,
        randomHistoryId: randomizationId,
        dishId: row.dishId,
        eventType: dto.eventType as any,
        reasonCode: dto.reasonCode,
        metadata: dto.metadata as any,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GET /me/random-history  (BA-006 §4.6)
  // ══════════════════════════════════════════════════════════════════════════════
  async getHistory(userId: string, query: RandomHistoryQueryDto) {
    const take = Math.min(query.limit ?? 20, 50);
    const where: Prisma.RandomHistoryWhereInput = {
      userId,
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      ...(query.selectedOnly ? { isSelected: true } : {}),
    };

    const rows = await this.prisma.db.randomHistory.findMany({
      where,
      include: {
        dish: {
          select: {
            id: true, name: true, slug: true, status: true,
            media: {
              where: { isPrimary: true, moderationStatus: 'APPROVED' },
              select: { storageKey: true, bucket: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasNextPage = rows.length > take;
    const data = hasNextPage ? rows.slice(0, take) : rows;

    return {
      data: data.map((r) => ({
        ...r,
        dish: r.dish
          ? { ...r.dish, imageUrl: buildImageUrl(r.dish.media?.[0]) }
          : null,
      })),
      pageInfo: { nextCursor: hasNextPage ? data[data.length - 1]?.id : null, hasNextPage },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ══════════════════════════════════════════════════════════════════════════════
  private scoreCandidate(
    dish: any,
    ctx: { goalCodes: string[]; currentHour: number; weatherCode?: string; recentDishIds: string[]; budgetMax?: number },
  ): ScoreBreakdown {
    const { goalCodes, currentHour, recentDishIds, budgetMax } = ctx;

    // Goal match 0-40
    let goalMatch = goalCodes.length === 0 ? 20 : 0;
    if (goalCodes.length > 0 && dish.dishGoals?.length > 0) {
      const matched = dish.dishGoals.filter((dg: any) => goalCodes.includes(dg.goal.code));
      if (matched.length > 0) {
        goalMatch = Math.round((matched.reduce((s: number, g: any) => s + g.score, 0) / matched.length / 100) * 40);
      }
    }

    // Time suitability 0-10
    const mealCodes: string[] = dish.mealTypes?.map((mt: any) => mt.mealTypeTag.code) ?? [];
    let timeSuitability = 5;
    if (currentHour >= 6 && currentHour < 10 && mealCodes.includes('BREAKFAST')) timeSuitability = 10;
    if (currentHour >= 10 && currentHour < 14 && mealCodes.includes('LUNCH')) timeSuitability = 10;
    if (currentHour >= 17 && currentHour < 22 && mealCodes.includes('DINNER')) timeSuitability = 10;
    if (currentHour >= 14 && currentHour < 17 && mealCodes.includes('SNACK')) timeSuitability = 10;

    // Popularity 0-10
    const popularity = dish.isFeatured ? 10 : 5;

    // Data quality 0-20
    let dataQuality = 6;
    if (dish.nutrition?.length > 0) dataQuality += 7;
    if (dish.media?.length > 0) dataQuality += 7;

    // Novelty 0-20
    const novelty = recentDishIds.includes(dish.id) ? 0 : 20;

    // Budget fit 0-10 (bonus nếu nằm giữa khoảng budget tốt)
    let budgetFit = 5;
    if (budgetMax && dish.priceMin) {
      budgetFit = dish.priceMin <= budgetMax * 0.8 ? 10 : 3;
    }

    const total = goalMatch + timeSuitability + popularity + dataQuality + novelty + budgetFit;
    return { goalMatch, timeSuitability, popularity, dataQuality, novelty, budgetFit, total };
  }

  private weightedRandomSample(scored: Array<{ dish: any; score: number; breakdown: ScoreBreakdown }>) {
    const total = scored.reduce((s, i) => s + Math.max(i.score, 1), 0);
    let r = Math.random() * total;
    for (const item of scored) {
      r -= Math.max(item.score, 1);
      if (r <= 0) return item;
    }
    return scored[scored.length - 1];
  }

  private buildReason(dish: any, ctx: { goalCodes: string[]; mealSlot?: MealSlotEnum; weatherCode?: string }) {
    const factors: string[] = [];
    if (ctx.goalCodes?.length > 0) factors.push('Phù hợp với mục tiêu của bạn');
    if (ctx.mealSlot && ctx.mealSlot !== MealSlotEnum.ANY) {
      const label: Record<string, string> = {
        BREAKFAST: 'bữa sáng', LUNCH: 'bữa trưa', DINNER: 'bữa tối', SNACK: 'bữa snack',
      };
      factors.push(`Thích hợp cho ${label[ctx.mealSlot] ?? ctx.mealSlot}`);
    }
    if (dish.isFeatured) factors.push('Món được đề xuất nổi bật');
    if (dish.region?.name) factors.push(`Đặc trưng ${dish.region.name}`);
    if (ctx.weatherCode === 'RAIN') factors.push('Ấm áp phù hợp trời mưa');
    return {
      summary: factors.join('. ') || 'Gợi ý phù hợp cho bạn hôm nay.',
      factors,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // AI Explanation — gọi AI phân tích profile + món ăn → lý do cụ thể
  // ══════════════════════════════════════════════════════════════════════════════
  async generateAiExplanation(ctx: {
    dish: {
      name: string;
      description?: string | null;
      priceMin?: number | null;
      priceMax?: number | null;
      prepTimeMin?: number | null;
      region?: { name: string } | null;
      nutrition?: Array<{ kcal?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null; fiberG?: number | null }> | null;
      dishGoals?: Array<{ goal: { name: string } }>;
      mealTypes?: Array<{ mealTypeTag: { name: string } }>;
    };
    profile: {
      displayName?: string | null;
      age?: number | null;
      goals?: string[];           // tên mục tiêu của user
      allergenNames?: string[];
      dietTypeNames?: string[];
    };
    mealSlot?: string;
    compatibilityPercent?: number;
    scoreBreakdown?: Record<string, number>;
  }): Promise<AiExplanationResult> {
    const { dish, profile, mealSlot, compatibilityPercent, scoreBreakdown } = ctx;

    // Build context string
    const nut = dish.nutrition?.[0];
    const priceStr = dish.priceMin && dish.priceMax
      ? `${Math.round(dish.priceMin / 1000)}K–${Math.round(dish.priceMax / 1000)}K`
      : dish.priceMax ? `~${Math.round(dish.priceMax / 1000)}K` : 'không rõ';

    const mealLabel: Record<string, string> = {
      BREAKFAST: 'bữa sáng', LUNCH: 'bữa trưa', DINNER: 'bữa tối', SNACK: 'bữa phụ', ANY: 'bất kỳ',
    };

    const profileStr = [
      profile.displayName ? `Tên: ${profile.displayName}` : null,
      profile.age ? `Tuổi: ${profile.age}` : null,
      profile.goals?.length ? `Mục tiêu sức khỏe: ${profile.goals.join(', ')}` : 'Chưa có mục tiêu cụ thể',
      profile.allergenNames?.length ? `Dị ứng/kiêng: ${profile.allergenNames.join(', ')}` : 'Không có dị ứng',
      profile.dietTypeNames?.length ? `Chế độ ăn: ${profile.dietTypeNames.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const dishStr = [
      `Tên món: ${dish.name}`,
      dish.description ? `Mô tả: ${dish.description}` : null,
      dish.region?.name ? `Vùng miền: ${dish.region.name}` : null,
      `Giá: ${priceStr}`,
      dish.prepTimeMin ? `Thời gian chuẩn bị: ${dish.prepTimeMin} phút` : null,
      nut?.kcal ? `Năng lượng: ${nut.kcal} kcal` : null,
      nut?.proteinG ? `Đạm: ${nut.proteinG}g` : null,
      nut?.carbsG ? `Tinh bột: ${nut.carbsG}g` : null,
      nut?.fatG ? `Chất béo: ${nut.fatG}g` : null,
      nut?.fiberG ? `Chất xơ: ${nut.fiberG}g` : null,
      dish.dishGoals?.length ? `Phù hợp mục tiêu: ${dish.dishGoals.map((g) => g.goal.name).join(', ')}` : null,
      dish.mealTypes?.length ? `Loại bữa ăn: ${dish.mealTypes.map((m) => m.mealTypeTag.name).join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const scoreStr = scoreBreakdown
      ? Object.entries(scoreBreakdown)
          .filter(([k]) => k !== 'total')
          .map(([k, v]) => `${k}: ${v}/20`)
          .join(', ')
      : '';

    const prompt = `Bạn là Mogu — trợ lý ẩm thực thông minh. Dựa vào PROFILE người dùng và THÔNG TIN MÓN ĂN dưới đây, hãy giải thích CHI TIẾT VÀ CỤ THỂ tại sao món này phù hợp với người dùng này.

PROFILE NGƯỜI DÙNG:
${profileStr}

THÔNG TIN MÓN ĂN:
${dishStr}
${mealSlot ? `Bữa ăn hiện tại: ${mealLabel[mealSlot] ?? mealSlot}` : ''}
${compatibilityPercent ? `Điểm phù hợp tổng: ${compatibilityPercent}%` : ''}
${scoreStr ? `Điểm thành phần: ${scoreStr}` : ''}

YÊU CẦU:
- summary: 1-2 câu NGẮN, CỤ THỂ, nêu lý do chính (không chung chung như "phù hợp với bạn")
- factors: 3-5 lý do CỤ THỂ, mỗi lý do 1 câu ngắn (VD: "Cung cấp 28g protein — đủ cho mục tiêu tăng cơ", "Giá 45K–65K — trong ngân sách bữa trưa", "Vùng Bắc Bộ — đúng khẩu vị quen")
- nutritionHighlight: 1 câu về dinh dưỡng liên quan đến mục tiêu user (nếu có kcal/protein)
- matchTags: 3-5 tags ngắn (VD: "Bữa trưa", "Giàu protein", "Trong ngân sách", "Ít dầu mỡ")
- tip: 1 mẹo nhỏ hữu ích khi ăn món này (không bắt buộc)

Trả về JSON thuần (KHÔNG có markdown, KHÔNG có text thừa):
{
  "summary": "...",
  "factors": ["...", "...", "..."],
  "nutritionHighlight": "...",
  "matchTags": ["...", "...", "..."],
  "tip": "..."
}`;

    try {
      const response = await this.aiService['client'].chat.completions.create({
        model: this.aiService['model'],
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content ?? '';
      // Strip markdown nếu có
      const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(clean);

      return {
        summary: parsed.summary ?? 'Phù hợp với nhu cầu của bạn hôm nay.',
        factors: Array.isArray(parsed.factors) ? parsed.factors.slice(0, 5) : [],
        nutritionHighlight: parsed.nutritionHighlight ?? '',
        matchTags: Array.isArray(parsed.matchTags) ? parsed.matchTags.slice(0, 5) : [],
        tip: parsed.tip ?? undefined,
      };
    } catch (err) {
      this.logger.warn(`AI explanation failed: ${err}`);
      // Fallback về rule-based
      const fallback = this.buildReason(dish, {
        goalCodes: profile.goals ?? [],
        mealSlot: mealSlot as MealSlotEnum | undefined,
      });
      return {
        summary: fallback.summary,
        factors: fallback.factors,
        nutritionHighlight: nut?.kcal ? `Cung cấp ${nut.kcal} kcal cho bữa ăn của bạn.` : '',
        matchTags: fallback.factors.slice(0, 3),
        tip: undefined,
      };
    }
  }
}
