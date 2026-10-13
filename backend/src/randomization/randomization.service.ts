import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DiaryMealSlot, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-import/ai.service';
import { DishEligibilityService } from '../dishes/eligibility/dish-eligibility.service';
import { mapNutritionToPlanServing } from '../dishes/eligibility/dish-nutrition.mapper';
import { MealLogsService } from '../health/meal-logs.service';
import {
  aggregateNearbyDishes,
  DEFAULT_NEARBY_RADIUS_KM,
  MAX_NEARBY_RADIUS_KM,
  PlacesService,
  type NearbyDishPlaceRow,
  type NearbyDishStat,
  type PlaceDto,
} from '../places/places.service';
import { resolveEatOutPrice } from './eat-out-price';
import { isValidCoord } from '../places/places-geo.util';
import {
  BudgetModeEnum,
  LocationModeEnum,
  MealSlotEnum,
  RandomHistoryQueryDto,
  RandomizationRequestDto,
  RecommendationEventDto,
  RecommendationSourceEnum,
  RetryRandomizationDto,
  SelectRandomizationDto,
} from './dto/randomization.dto';

const ALGORITHM_VERSION = 'rule-v3.2.0';
const RECENT_EXCLUSION_DAYS = 7;
const HISTORY_LOOKBACK_DAYS = 90;
/** Thang điểm tối đa (goal 30 + personal 20 + novelty 15 + data 10 + time 10 + weather 10 + pop 10 + budget 5 + proximity 10). */
const MAX_TOTAL_SCORE = 120;
/** Các mốc mở rộng bán kính (chỉ dùng cho locationMode=PREFER). */
const NEARBY_RADIUS_STEPS_KM = [3, 5, 10];
const NEARBY_TOP_PLACES = 5;
/** Giới hạn chờ AI sinh giải thích; quá hạn thì dùng giải thích rule-based. */
const AI_EXPLANATION_TIMEOUT_MS = 6_000;
/** Model nhanh, không reasoning — ~1.5-3s cho một đoạn giải thích ngắn. */
const DEFAULT_EXPLANATION_MODEL = 'ag/gemini-2.5-flash-lite';

/** Danh sách bán kính cascade bắt đầu từ bán kính người dùng yêu cầu (chế độ PREFER). */
export function buildRadiusCascade(requestedKm?: number | null): number[] {
  const r = Number(requestedKm);
  const start =
    Number.isFinite(r) && r > 0 ? Math.min(MAX_NEARBY_RADIUS_KM, r) : DEFAULT_NEARBY_RADIUS_KM;
  const steps = [start, ...NEARBY_RADIUS_STEPS_KM.filter((s) => s > start)];
  return Array.from(new Set(steps));
}

/** Bán kính duy nhất cho chế độ STRICT (không mở rộng). */
export function resolveStrictRadiusKm(requestedKm?: number | null): number {
  const r = Number(requestedKm);
  return Number.isFinite(r) && r > 0 ? Math.min(MAX_NEARBY_RADIUS_KM, r) : DEFAULT_NEARBY_RADIUS_KM;
}

/**
 * Điểm gần 0-10 (quán bán món quanh người dùng):
 * - Khoảng cách quán gần nhất: <1km 7, <3km 5, <5km 3, xa hơn 1
 * - +1 nếu có >= 3 quán; +1 nếu có quán đang mở; +1 nếu rating tốt nhất >= 4.0 hoặc có link CONFIRMED
 * Không có vị trí → 5 (trung tính); có vị trí nhưng không quán nào → 0.
 */
export function proximityScore(stat: NearbyDishStat | undefined, hasLocation: boolean): number {
  if (!hasLocation) return 5;
  if (!stat) return 0;
  let s = stat.nearestMeters < 1000 ? 7 : stat.nearestMeters < 3000 ? 5 : stat.nearestMeters < 5000 ? 3 : 1;
  if (stat.placeCount >= 3) s += 1;
  if ((stat.openCount ?? 0) > 0) s += 1;
  if ((stat.bestRating ?? 0) >= 4 || stat.hasConfirmed) s += 1;
  return Math.max(0, Math.min(10, s));
}

function formatMeters(m: number): string {
  return m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)}m` : `${(m / 1000).toFixed(1)}km`;
}

function buildImageUrl(media: { storageKey?: string | null; bucket?: string | null } | undefined | null): string | null {
  if (!media?.storageKey) return null;
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!supabaseUrl) return null;
  const bucket = media.bucket ?? 'dish-images';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${media.storageKey}`;
}

type DishMediaRow = {
  storageKey?: string | null;
  bucket?: string | null;
  isPrimary?: boolean;
  moderationStatus?: string | null;
};

/** Ưu tiên primary + approved, rồi primary, rồi bất kỳ media có storageKey. */
function pickDishMedia(media: DishMediaRow[] | undefined | null): DishMediaRow | null {
  if (!media?.length) return null;
  return (
    media.find((m) => m.isPrimary && m.moderationStatus === 'APPROVED' && m.storageKey) ??
    media.find((m) => m.isPrimary && m.storageKey) ??
    media.find((m) => m.moderationStatus === 'APPROVED' && m.storageKey) ??
    media.find((m) => !!m.storageKey) ??
    null
  );
}

/** Giờ địa phương Việt Nam (không phụ thuộc timezone máy chủ). */
function vietnamHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  // en-GB + hour12:false can yield "24" for midnight in some engines
  return hour === 24 ? 0 : hour;
}

/**
 * Khung giờ gợi ý bữa (giờ VN):
 * - Sáng: 05:00–10:00
 * - Trưa: 10:00–14:00
 * - Bữa phụ: 14:00–17:00
 * - Tối: 17:00–24:00
 * - Ngoài khung (00:00–05:00): ANY
 */
function inferMealSlot(hour: number): MealSlotEnum {
  if (hour >= 5 && hour < 10) return MealSlotEnum.BREAKFAST;
  if (hour >= 10 && hour < 14) return MealSlotEnum.LUNCH;
  if (hour >= 14 && hour < 17) return MealSlotEnum.SNACK;
  if (hour >= 17 && hour <= 23) return MealSlotEnum.DINNER;
  return MealSlotEnum.ANY;
}

export interface ScoreBreakdown {
  goalMatch: number;
  personalFit: number;
  novelty: number;
  dataQuality: number;
  timeSuitability: number;
  weatherFit: number;
  popularity: number;
  budgetFit: number;
  proximity: number;
  total: number;
}

export interface UserTasteProfile {
  totalHistories: number;
  selectedCount: number;
  selectedMealTypeScores: Map<string, number>;
  selectedRegionScores: Map<string, number>;
  avgSelectedPrice?: number;
  skippedDishCounts: Map<string, number>;
  skippedMealTypeScores: Map<string, number>;
}

// ────────────────────────────────────────────────────────────────────────────────

export interface AiExplanationResult {
  summary: string;
  factors: string[];          // Lý do chi tiết có icon prefix
  nutritionHighlight: string; // VD: "Cung cấp 420 kcal, 28g protein — đủ năng lượng cho bữa trưa"
  matchTags: string[];        // VD: ["Bữa trưa", "Cân bằng", "Trong ngân sách"]
  tip?: string;               // Mẹo nhỏ: "Ăn kèm rau sống để tăng chất xơ"
}

export type SoftFilterOpts = {
  withMealType: boolean;
  withSoftDiet: boolean;
  withBudget: boolean;
  softExcludeMayContain: boolean;
};

/** Tải danh sách ứng viên "nhẹ" — chỉ đủ thông tin chấm điểm, lọc dị ứng/chế độ ăn/giá trong RAM. */
export const candidateLightInclude = {
  region: { select: { id: true, name: true } },
  dishGoals: {
    select: {
      score: true,
      goal: { select: { code: true } },
    },
  },
  mealTypes: {
    select: {
      mealTypeTag: { select: { code: true, name: true } },
    },
  },
  dietTypes: {
    select: {
      dietType: { select: { code: true } },
    },
  },
  dishAllergens: {
    select: {
      level: true,
      allergen: { select: { code: true } },
    },
  },
  nutrition: true,
  media: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    select: {
      storageKey: true,
      bucket: true,
      isPrimary: true,
      moderationStatus: true,
    },
    take: 1,
  },
};

/** Tải chi tiết đầy đủ cho DUY NHẤT món được chọn trúng. */
export const dishDetailInclude = {
  region: { select: { id: true, name: true } },
  dishGoals: { include: { goal: true } },
  mealTypes: { include: { mealTypeTag: { select: { name: true, code: true } } } },
  nutrition: true,
  media: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    select: {
      storageKey: true,
      bucket: true,
      isPrimary: true,
      moderationStatus: true,
    },
    take: 5,
  },
  dishIngredients: {
    select: {
      rawText: true,
      quantity: true,
      unit: true,
      groupLabel: true,
      isOptional: true,
      sortOrder: true,
      ingredient: {
        select: { id: true, name: true, imageUrl: true, imageKey: true },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
    take: 20,
  },
  dishAllergens: {
    include: { allergen: { select: { id: true, name: true, code: true } } },
  },
  recipeSteps: {
    select: { stepOrder: true, instruction: true, durationMin: true, imageUrl: true },
    orderBy: { stepOrder: 'asc' as const },
  },
};

@Injectable()
export class RandomizationService {
  private readonly logger = new Logger(RandomizationService.name);
  /**
   * Model dùng để sinh lời giải thích. Mặc định là model nhanh (không reasoning) vì
   * flow random cần phản hồi < 3s; các model "thinking" (gemini-3.x-pro, deepseek-v3.1)
   * tốn 10-13s chỉ để viết vài câu. Có thể ghi đè bằng RANDOM_EXPLANATION_MODEL.
   */
  private readonly explanationModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly eligibility: DishEligibilityService,
    private readonly mealLogs: MealLogsService,
    private readonly places: PlacesService,
  ) {
    this.explanationModel =
      (process.env.RANDOM_EXPLANATION_MODEL || '').trim() || DEFAULT_EXPLANATION_MODEL;
  }

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

    const currentHour = vietnamHour();
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
    const startMs = Date.now();

    // ── Normalize: v1.1 fields override legacy ──────────────────────────────────
    const mealSlot: MealSlotEnum =
      dto.meal?.slot ??
      (dto.mealTypeCode && Object.values(MealSlotEnum).includes(dto.mealTypeCode as MealSlotEnum)
        ? (dto.mealTypeCode as MealSlotEnum)
        : inferMealSlot(vietnamHour()));

    const goalCodes: string[] = dto.runtimeOverrides?.goalCodes ?? dto.goalCodes ?? [];
    const dietTypeCodes: string[] = dto.runtimeOverrides?.dietTypeCodes ?? dto.dietTypeCodes ?? [];
    const weatherCode: string | undefined = dto.runtimeOverrides?.weatherCode ?? dto.weatherCode;
    const budgetMax: number | undefined = dto.budget?.maxVnd ?? dto.maxBudget;
    const budgetMin: number | undefined = dto.budget?.minVnd;
    const budgetMode: BudgetModeEnum = dto.budget?.mode ?? BudgetModeEnum.UNLIMITED;
    const source: RecommendationSourceEnum = dto.source ?? RecommendationSourceEnum.RANDOM_FLOW;
    const excludeDishIds: string[] = dto.excludeDishIds ?? [];

    // ── Location parameters & guard ─────────────────────────────────────────────
    const userLat = dto.location?.latitude;
    const userLng = dto.location?.longitude;
    const requestedMode = dto.runtimeOverrides?.locationMode ?? LocationModeEnum.STRICT;
    const hasLocation = requestedMode !== LocationModeEnum.OFF && isValidCoord(userLat, userLng);
    const strictLocation = hasLocation && requestedMode === LocationModeEnum.STRICT;
    const radiusCascade = strictLocation
      ? [resolveStrictRadiusKm(dto.runtimeOverrides?.radiusKm)]
      : buildRadiusCascade(dto.runtimeOverrides?.radiusKm);
    const requestedRadiusKm = radiusCascade[0];
    const maxRadiusKm = radiusCascade[radiusCascade.length - 1];

    const historyCutoff = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 86400_000);

    // ── Song song hoá đọc ban đầu (Profile, Lịch sử 90d, Warmup & Nearby rows) ──
    const [profile, userHistories, warm, initialNearbyRows] = await Promise.all([
      this.prisma.db.profile.findUnique({
        where: { userId },
        include: {
          userAllergens: { include: { allergen: true } },
          userAvoidedIngredients: true,
          userDietTypes: { include: { dietType: true } },
          userGoals: { include: { goal: true } },
        },
      }),
      this.prisma.db.randomHistory.findMany({
        where: {
          userId,
          createdAt: { gte: historyCutoff },
          dishId: { not: null },
        },
        select: {
          dishId: true,
          isSelected: true,
          createdAt: true,
          dish: {
            select: {
              id: true,
              regionId: true,
              priceMin: true,
              dineOutPriceMin: true,
              mealTypes: {
                select: {
                  mealTypeTag: { select: { code: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      hasLocation && strictLocation
        ? this.places.ensureAreaCoverage(userLat!, userLng!, requestedRadiusKm * 1000)
        : Promise.resolve({ status: 'SKIPPED' as const, source: null, placeCount: 0, linkCount: 0 }),
      hasLocation
        ? this.places.findNearbyDishPlaceRows(userLat!, userLng!, maxRadiusKm * 1000).catch((err) => {
            this.logger.warn(`[Randomization] nearby lookup failed: ${err}`);
            return null;
          })
        : Promise.resolve([] as NearbyDishPlaceRow[]),
    ]);

    if (!profile) throw new NotFoundException({ error: { code: 'PROFILE_NOT_FOUND' } });

    const isRandomFlowSource =
      source === RecommendationSourceEnum.RANDOM_FLOW ||
      source === RecommendationSourceEnum.RANDOM_AGAIN;
    if (isRandomFlowSource && requestedMode === LocationModeEnum.STRICT && !hasLocation) {
      return this.noNearbyDishResult(userId, dto, {
        source,
        mealSlot,
        budgetMode,
        budgetMin,
        budgetMax,
        requestedRadiusKm,
        dishCountInRadius: 0,
        placeCountInRadius: 0,
        warmupStatus: null,
        failReasonCode: 'LOCATION_REQUIRED',
      });
    }

    // Handle lookup failure khi STRICT
    if (hasLocation && strictLocation && initialNearbyRows === null) {
      return this.noNearbyDishResult(userId, dto, {
        source,
        mealSlot,
        budgetMode,
        budgetMin,
        budgetMax,
        requestedRadiusKm,
        dishCountInRadius: 0,
        placeCountInRadius: 0,
        warmupStatus: warm?.status ?? null,
        failReasonCode: 'NEARBY_LOOKUP_FAILED',
      });
    }

    let warmupStatus: string | null = warm?.status ?? null;
    let rows: NearbyDishPlaceRow[] = initialNearbyRows ?? [];

    if (warm && warm.status === 'FETCHED') {
      this.logger.log(
        `[Randomization] warm-up ${warm.source}: +${warm.placeCount} quán, ${warm.linkCount} liên kết món`,
      );
      this.places.invalidateNearbyCache(userLat!, userLng!, maxRadiusKm * 1000);
      try {
        rows = await this.places.findNearbyDishPlaceRows(userLat!, userLng!, maxRadiusKm * 1000);
      } catch (err) {
        this.logger.warn(`[Randomization] re-query nearby rows after warmup failed: ${err}`);
      }
    }

    const userAllergenCodes = profile.userAllergens.map((ua) => ua.allergen.code);
    const userAvoidedIngredients = profile.userAvoidedIngredients.map((i) => i.ingredientName.toLowerCase());
    const hardDietTypeCodes = profile.userDietTypes.filter((d) => d.isHard).map((d) => d.dietType.code);

    // Map lần cuối cùng thấy mỗi dishId (cho novelty decay)
    const lastSeenMap = new Map<string, Date>();
    for (const h of userHistories) {
      if (h.dishId && !lastSeenMap.has(h.dishId)) {
        lastSeenMap.set(h.dishId, h.createdAt);
      }
    }

    // Danh sách món gần đây trong vòng 7 ngày (để tương thích ngược)
    const recent7dCutoff = Date.now() - RECENT_EXCLUSION_DAYS * 86400_000;
    const recentDishIds = userHistories
      .filter((h) => h.dishId && h.createdAt.getTime() >= recent7dCutoff)
      .map((h) => h.dishId as string);

    // Build user taste profile từ lịch sử chọn và bỏ qua
    const selectedMealTypeScores = new Map<string, number>();
    const selectedRegionScores = new Map<string, number>();
    const skippedMealTypeScores = new Map<string, number>();
    const skippedDishCounts = new Map<string, number>();
    const selectedPrices: number[] = [];
    let selectedCount = 0;

    for (const h of userHistories) {
      if (!h.dishId) continue;
      const d = h.dish;
      const mealCodes = d?.mealTypes?.map((mt) => mt.mealTypeTag.code).filter(Boolean) ?? [];
      const regionId = d?.regionId;

      if (h.isSelected) {
        selectedCount++;
        const histPrice = d?.dineOutPriceMin ?? d?.priceMin;
        if (histPrice) selectedPrices.push(histPrice);
        if (regionId) {
          selectedRegionScores.set(regionId, (selectedRegionScores.get(regionId) ?? 0) + 1);
        }
        for (const code of mealCodes) {
          selectedMealTypeScores.set(code, (selectedMealTypeScores.get(code) ?? 0) + 1);
        }
      } else {
        skippedDishCounts.set(h.dishId, (skippedDishCounts.get(h.dishId) ?? 0) + 1);
        for (const code of mealCodes) {
          skippedMealTypeScores.set(code, (skippedMealTypeScores.get(code) ?? 0) + 1);
        }
      }
    }

    const avgSelectedPrice =
      selectedPrices.length > 0
        ? selectedPrices.reduce((a, b) => a + b, 0) / selectedPrices.length
        : undefined;

    const tasteProfile: UserTasteProfile = {
      totalHistories: userHistories.length,
      selectedCount,
      selectedMealTypeScores,
      selectedRegionScores,
      avgSelectedPrice,
      skippedDishCounts,
      skippedMealTypeScores,
    };

    const tPre = Date.now() - startMs;
    const tCandidatesStart = Date.now();

    // ── Fetch candidates (cascade: soft only; hard never relaxed) ───────────────
    const eligibilityProfile = {
      allergenCodes: userAllergenCodes,
      hardDietTypeCodes,
      softDietTypeCodes: dietTypeCodes,
      avoidedIngredients: userAvoidedIngredients,
    };

    let nearbyStats = new Map<string, NearbyDishStat>();
    let usedRadiusStats = new Map<string, NearbyDishStat>();
    let nearbyRadiusUsedKm: number | null = null;
    let nearbyFallback = false;
    let nearbyDishCountInRadius = 0;

    const relaxLevels: SoftFilterOpts[] = [
      { withMealType: true, withSoftDiet: true, withBudget: true, softExcludeMayContain: true },
      { withMealType: false, withSoftDiet: true, withBudget: true, softExcludeMayContain: true },
      { withMealType: false, withSoftDiet: false, withBudget: true, softExcludeMayContain: false },
      { withMealType: false, withSoftDiet: false, withBudget: false, softExcludeMayContain: false },
    ];

    let candidates: any[] = [];
    let fallbackApplied: string[] = [];
    const markRelaxed = (i: number, opts: SoftFilterOpts) => {
      if (i === 0) return;
      if (!opts.withMealType) fallbackApplied.push('meal_type');
      if (!opts.withSoftDiet) fallbackApplied.push('soft_diet');
      if (!opts.withBudget) fallbackApplied.push('budget');
      if (!opts.softExcludeMayContain) fallbackApplied.push('may_contain');
    };

    // Hàm fetch cho nhánh fallback / no-location (bảo đảm tương thích và test spec)
    const fetchCandidates = async (opts: SoftFilterOpts, nearbyDishIds?: string[]) => {
      const hardWhere = this.eligibility.buildHardWhere(eligibilityProfile, 'random', {
        softExcludeMayContain: opts.softExcludeMayContain,
        maxPriceMin: opts.withBudget && budgetMax && !nearbyDishIds ? budgetMax : undefined,
        priceMode: 'EAT_OUT',
        mealTypeCodes:
          opts.withMealType && mealSlot && mealSlot !== MealSlotEnum.ANY
            ? [mealSlot, 'ANY']
            : undefined,
        excludeDishIds: excludeDishIds.length ? excludeDishIds : undefined,
      });

      const and: Prisma.DishWhereInput[] = [hardWhere];
      if (opts.withSoftDiet && dietTypeCodes.length > 0) {
        and.push({
          dietTypes: { some: { dietType: { code: { in: dietTypeCodes } } } },
        });
      }
      if (nearbyDishIds) {
        and.push({ id: { in: nearbyDishIds } });
      }

      const rawCandidates = await this.prisma.db.dish.findMany({
        where: { AND: and },
        include: candidateLightInclude,
        take: 500,
      });

      if (!opts.withBudget || (!budgetMax && !budgetMin)) {
        return rawCandidates;
      }

      return rawCandidates.filter((dish) => {
        const eatOut = resolveEatOutPrice(dish as any, nearbyStats.get(dish.id));
        if (!eatOut) return true;
        if (budgetMax != null && eatOut.min > budgetMax) return false;
        if (budgetMin != null && eatOut.max < budgetMin) return false;
        return true;
      });
    };

    if (hasLocation) {
      nearbyStats = aggregateNearbyDishes(rows, maxRadiusKm * 1000);
      nearbyDishCountInRadius = aggregateNearbyDishes(rows, requestedRadiusKm * 1000).size;

      const allNearbyDishIds = [...nearbyStats.keys()];
      if (allNearbyDishIds.length > 0) {
        // Query toàn bộ ứng viên quán gần đúng 1 lần duy nhất với các điều kiện CỨNG
        const hardWhere = this.eligibility.buildHardWhere(eligibilityProfile, 'random', {
          excludeDishIds: excludeDishIds.length ? excludeDishIds : undefined,
        });

        const pool = await this.prisma.db.dish.findMany({
          where: {
            AND: [hardWhere, { id: { in: allNearbyDishIds } }],
          },
          include: candidateLightInclude,
          take: 1000,
        });

        let prevSize = -1;
        outer: for (const radiusKm of radiusCascade) {
          const inRadius = aggregateNearbyDishes(rows, radiusKm * 1000);
          if (inRadius.size === 0 || inRadius.size === prevSize) continue;
          prevSize = inRadius.size;
          const radiusDishes = pool.filter((d) => inRadius.has(d.id));

          for (const [i, opts] of relaxLevels.entries()) {
            const matched = this.filterCandidateListInMemory(
              radiusDishes,
              opts,
              userAllergenCodes,
              mealSlot,
              dietTypeCodes,
              budgetMax,
              budgetMin,
              nearbyStats,
            );
            if (matched.length > 0) {
              candidates = matched;
              markRelaxed(i, opts);
              nearbyRadiusUsedKm = radiusKm;
              usedRadiusStats = inRadius;
              if (radiusKm > requestedRadiusKm) fallbackApplied.push('radius');
              break outer;
            }
          }
        }
      }

      if (candidates.length === 0 && strictLocation) {
        let placeCountInRadius = 0;
        try {
          placeCountInRadius = await this.places.countPlacesWithin(userLat!, userLng!, requestedRadiusKm * 1000);
        } catch (_) {}
        return this.noNearbyDishResult(userId, dto, {
          source,
          mealSlot,
          budgetMode,
          budgetMin,
          budgetMax,
          requestedRadiusKm,
          dishCountInRadius: nearbyDishCountInRadius,
          placeCountInRadius,
          warmupStatus,
          failReasonCode: 'NO_NEARBY_DISH',
        });
      }
      if (candidates.length === 0) nearbyFallback = true;
    }

    if (candidates.length === 0) {
      for (const [i, opts] of relaxLevels.entries()) {
        candidates = await fetchCandidates(opts);
        if (candidates.length > 0) {
          markRelaxed(i, opts);
          if (nearbyFallback) fallbackApplied.push('nearby');
          break;
        }
      }
    }

    if (candidates.length === 0) {
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
        nearby: null,
      };
    }

    // ── Score & Softmax Sample ───────────────────────────────────────────────────
    const currentHour = vietnamHour();
    const scored = candidates.map((dish) => {
      const breakdown = this.scoreCandidate(dish, {
        goalCodes,
        currentHour,
        weatherCode,
        recentDishIds,
        lastSeenMap,
        tasteProfile,
        budgetMax,
        hasLocation,
        nearbyStat: nearbyStats.get(dish.id),
      });
      return { dish, score: breakdown.total, breakdown, samplingWeight: 0 };
    });

    const selected = this.softmaxRandomSample(scored, 12);
    const top5 = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);

    const tCandidates = Date.now() - tCandidatesStart;
    const tDetailStart = Date.now();

    // ── Tải chi tiết duy nhất món trúng + Quán gần bán món (song song) ─────────
    const selectedNearbyStat = nearbyStats.get(selected.dish.id);
    const nearbyQueryRadiusKm = nearbyRadiusUsedKm ?? maxRadiusKm;

    const [fullDish, nearbyPlaces] = await Promise.all([
      typeof this.prisma.db.dish?.findUnique === 'function'
        ? this.prisma.db.dish.findUnique({
            where: { id: selected.dish.id },
            include: dishDetailInclude,
          })
        : Promise.resolve(null),
      hasLocation && selectedNearbyStat
        ? this.places
            .findNearbyPlacesForDish(
              selected.dish.id,
              userLat!,
              userLng!,
              nearbyQueryRadiusKm * 1000,
              NEARBY_TOP_PLACES,
            )
            .catch((err) => {
              this.logger.warn(`[Randomization] nearby places for dish failed: ${err}`);
              return [] as PlaceDto[];
            })
        : Promise.resolve([] as PlaceDto[]),
    ]);

    const targetDish = fullDish ?? selected.dish;
    const selectedUsedStat = usedRadiusStats.get(selected.dish.id);
    const nearbyInfo = hasLocation
      ? {
          mode: strictLocation ? 'STRICT' : 'PREFER',
          requestedRadiusKm,
          radiusKm: nearbyRadiusUsedKm,
          placeCount: selectedUsedStat?.placeCount ?? 0,
          openCount: selectedUsedStat?.openCount ?? 0,
          nearestMeters: selectedNearbyStat?.nearestMeters ?? null,
          dishCountInRadius: nearbyDishCountInRadius,
          fallback: nearbyFallback,
          warmup: warmupStatus,
          places: nearbyPlaces,
        }
      : null;

    // ── Build explanation ────────────────────────────────────────────────────────
    const isPersonalized = selected.breakdown.personalFit >= 13;
    const reason = this.buildReason(targetDish, {
      goalCodes,
      mealSlot,
      weatherCode,
      isPersonalized,
      nearby:
        nearbyInfo && nearbyInfo.radiusKm != null && selectedNearbyStat
          ? {
              radiusKm: nearbyInfo.radiusKm,
              placeCount: nearbyInfo.placeCount,
              openCount: nearbyInfo.openCount,
              nearestMeters: selectedNearbyStat.nearestMeters,
            }
          : undefined,
    });
    const compatibilityPercent = Math.min(100, Math.round((selected.score / MAX_TOTAL_SCORE) * 100));

    const tDetail = Date.now() - tDetailStart;
    const tPersistStart = Date.now();

    // ── Save history & candidates trong 1 nested transaction ─────────────────────
    const durationMs = Date.now() - startMs;
    const rawMealSource = dto.meal?.selectionSource;
    const mealSelectionSource =
      rawMealSource === 'USER_SELECTED' ||
      rawMealSource === 'AUTO_TIME' ||
      rawMealSource === 'PROFILE_DEFAULT' ||
      rawMealSource === 'SYSTEM_DEFAULT'
        ? rawMealSource
        : rawMealSource === 'AUTO_SUGGESTED'
          ? 'AUTO_TIME'
          : 'AUTO_TIME';

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
        mealSelectionSource: mealSelectionSource as any,
        budgetMode: budgetMode as any,
        budgetMinVnd: budgetMin ?? null,
        budgetMaxVnd: budgetMax ?? null,
        candidateCount: candidates.length,
        totalScore: selected.score,
        compatibilityPercent,
        durationMs,
        fallbackSnapshot:
          fallbackApplied.length || nearbyInfo
            ? ({
                relaxed: fallbackApplied,
                ...(nearbyInfo
                  ? {
                      nearby: {
                        mode: nearbyInfo.mode,
                        requestedRadiusKm: nearbyInfo.requestedRadiusKm,
                        radiusUsedKm: nearbyInfo.radiusKm,
                        placeCount: nearbyInfo.placeCount,
                        dishCountInRadius: nearbyInfo.dishCountInRadius,
                        warmup: nearbyInfo.warmup,
                      },
                    }
                  : {}),
              } as any)
            : null,
        candidates: {
          create: top5.map((s, i) => ({
            dishId: s.dish.id,
            rank: i + 1,
            totalScore: s.score,
            samplingWeight: s.samplingWeight,
            scoreBreakdown: s.breakdown as any,
            isChosen: s.dish.id === selected.dish.id,
          })),
        },
        updatedAt: new Date(),
      },
    });

    const tPersist = Date.now() - tPersistStart;
    const totalMs = Date.now() - startMs;

    this.logger.log(
      `[Randomization] done in ${totalMs}ms (pre: ${tPre}ms, candidates: ${tCandidates}ms, detail: ${tDetail}ms, persist: ${tPersist}ms) - dish: "${targetDish.name}"`,
    );

    const nearbyFactor = reason.factors.find((f) => f.startsWith('Có ') && f.includes('quán bán'));

    // ── Kích hoạt AI sinh lời giải thích ở nền (KHÔNG block response) ───────────
    void this.triggerBackgroundAiExplanation({
      historyId: history.id,
      dish: targetDish,
      profile: {
        age: profile.dateOfBirth
          ? Math.floor((Date.now() - new Date(profile.dateOfBirth as any).getTime()) / (365.25 * 86400_000))
          : null,
        goals: profile.userGoals?.map((g: any) => g.goal?.name).filter(Boolean) ?? goalCodes,
        allergenNames: profile.userAllergens?.map((a: any) => a.allergen?.name).filter(Boolean) ?? [],
        dietTypeNames: profile.userDietTypes?.map((d: any) => d.dietType?.name).filter(Boolean) ?? [],
      },
      mealSlot,
      compatibilityPercent,
      scoreBreakdown: selected.breakdown as any,
      nearbyFactor,
      baseReason: reason,
    });

    const dishDto = this.mapDishDetail(targetDish, selectedNearbyStat);

    const nutObj = Array.isArray(targetDish.nutrition) ? targetDish.nutrition[0] : targetDish.nutrition;
    const initialExplanation = {
      summary: reason.summary,
      compatibilityPercent,
      factors: reason.factors,
      nutritionHighlight: nutObj?.calories
        ? `Cung cấp ${nutObj.calories} kcal cho bữa ăn của bạn.`
        : null,
      matchTags: reason.factors.slice(0, 3),
      tip: null,
      fallbackApplied,
      relaxableCriteria: fallbackApplied,
    };

    return {
      randomizationId: history.id,
      dish: dishDto,
      reason,
      explanation: initialExplanation,
      scoreBreakdown: selected.breakdown,
      nearby: nearbyInfo,
      ...(process.env.NODE_ENV === 'development'
        ? {
            timings: {
              totalMs,
              preMs: tPre,
              candidatesMs: tCandidates,
              detailMs: tDetail,
              persistMs: tPersist,
            },
          }
        : {}),
    };
  }

  /** Lọc mảng ứng viên theo các tiêu chí mềm trong RAM (0 database round-trip). */
  private filterCandidateListInMemory(
    dishes: any[],
    opts: SoftFilterOpts,
    userAllergenCodes: string[],
    mealSlot: MealSlotEnum,
    dietTypeCodes: string[],
    budgetMax?: number,
    budgetMin?: number,
    nearbyStats?: Map<string, NearbyDishStat>,
  ): any[] {
    return dishes.filter((dish) => {
      // 1. softExcludeMayContain
      if (opts.softExcludeMayContain && userAllergenCodes.length > 0) {
        const hasMayContain = dish.dishAllergens?.some(
          (da: any) =>
            da.level === 'MAY_CONTAIN' &&
            userAllergenCodes.includes(da.allergen?.code),
        );
        if (hasMayContain) return false;
      }

      // 2. withMealType
      if (opts.withMealType && mealSlot && mealSlot !== MealSlotEnum.ANY) {
        const mealCodes = dish.mealTypes?.map((mt: any) => mt.mealTypeTag?.code) ?? [];
        const matchesMeal = mealCodes.includes(mealSlot) || mealCodes.includes('ANY');
        if (!matchesMeal) return false;
      }

      // 3. withSoftDiet
      if (opts.withSoftDiet && dietTypeCodes.length > 0) {
        const dishDietCodes = dish.dietTypes?.map((dt: any) => dt.dietType?.code) ?? [];
        const matchesDiet = dietTypeCodes.some((code) => dishDietCodes.includes(code));
        if (!matchesDiet) return false;
      }

      // 4. withBudget
      if (opts.withBudget && (budgetMax != null || budgetMin != null)) {
        const eatOut = resolveEatOutPrice(dish as any, nearbyStats?.get(dish.id));
        if (eatOut) {
          if (budgetMax != null && eatOut.min > budgetMax) return false;
          if (budgetMin != null && eatOut.max < budgetMin) return false;
        }
      }

      return true;
    });
  }

  /** Format dữ liệu chi tiết của 1 món ăn trả về mobile. */
  private mapDishDetail(d: any, selectedNearbyStat?: NearbyDishStat) {
    const imageUrl = buildImageUrl(pickDishMedia(d.media));
    const nutrition = Array.isArray(d.nutrition) ? d.nutrition[0] : d.nutrition;
    const eatOutPrice = resolveEatOutPrice(d, selectedNearbyStat);

    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      shortDescription: d.shortDescription ?? null,
      imageUrl,
      priceMin: d.priceMin,
      priceMax: d.priceMax,
      dineOutPriceMin: d.dineOutPriceMin ?? null,
      dineOutPriceMax: d.dineOutPriceMax ?? null,
      eatOutPrice: eatOutPrice
        ? {
            min: eatOutPrice.min,
            max: eatOutPrice.max,
            source: eatOutPrice.source,
            sampleCount: eatOutPrice.sampleCount,
          }
        : null,
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
      nutrition: nutrition
        ? {
            calories: nutrition.calories ? Number(nutrition.calories) : null,
            proteinG: nutrition.proteinG ? Number(nutrition.proteinG) : null,
            carbsG: nutrition.carbsG ? Number(nutrition.carbsG) : null,
            fatG: nutrition.fatG ? Number(nutrition.fatG) : null,
            fiberG: nutrition.fiberG ? Number(nutrition.fiberG) : null,
            servingName: nutrition.servingName ?? null,
          }
        : null,
      ingredients: (d.dishIngredients ?? []).map((ing: any) => {
        const supabaseUrl = process.env.SUPABASE_URL ?? '';
        let ingImageUrl: string | null = null;
        if (ing.ingredient?.imageUrl) {
          const raw = ing.ingredient.imageUrl as string;
          ingImageUrl = raw.startsWith('http')
            ? raw
            : raw.startsWith('/storage')
              ? `${supabaseUrl}${raw}`
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
  }

  /** Chạy AI explanation ở nền và ghi đè vào randomHistory.reasonSnapshot. */
  private async triggerBackgroundAiExplanation(ctx: {
    historyId: string;
    dish: any;
    profile: {
      age?: number | null;
      goals?: string[];
      allergenNames?: string[];
      dietTypeNames?: string[];
    };
    mealSlot?: string;
    compatibilityPercent?: number;
    scoreBreakdown?: Record<string, number>;
    nearbyFactor?: string;
    baseReason: any;
  }): Promise<void> {
    try {
      const ai = await this.generateAiExplanation({
        dish: ctx.dish,
        profile: ctx.profile,
        mealSlot: ctx.mealSlot,
        compatibilityPercent: ctx.compatibilityPercent,
        scoreBreakdown: ctx.scoreBreakdown,
      });
      if (!ai) return;

      const finalSummary = ai.summary ?? ctx.baseReason.summary;
      const finalFactors = ai.factors?.length
        ? ctx.nearbyFactor
          ? [ctx.nearbyFactor, ...ai.factors].slice(0, 6)
          : ai.factors
        : ctx.baseReason.factors;

      const aiExplanationData = {
        summary: finalSummary,
        compatibilityPercent: ctx.compatibilityPercent,
        factors: finalFactors,
        nutritionHighlight: ai.nutritionHighlight ?? null,
        matchTags: ai.matchTags?.length ? ai.matchTags.slice(0, 5) : ctx.baseReason.factors.slice(0, 3),
        tip: ai.tip ?? null,
      };

      await this.prisma.db.randomHistory.update({
        where: { id: ctx.historyId },
        data: {
          reasonSnapshot: {
            ...ctx.baseReason,
            aiExplanation: aiExplanationData,
          },
        },
      });
    } catch (err) {
      this.logger.warn(`[Randomization] background AI explanation failed for history ${ctx.historyId}: ${err}`);
    }
  }

  /** Lấy thông tin một lần random trước đó kèm explanation AI (nếu có). */
  async getRandomizationById(userId: string, id: string) {
    const history = await this.prisma.db.randomHistory.findFirst({
      where: { id, userId },
      include: {
        dish: {
          include: dishDetailInclude,
        },
      },
    });
    if (!history) throw new NotFoundException({ error: { code: 'RANDOMIZATION_NOT_FOUND' } });

    const reasonSnap = history.reasonSnapshot as any;
    const ai = reasonSnap?.aiExplanation;

    const dishDto = history.dish ? this.mapDishDetail(history.dish) : null;

    return {
      randomizationId: history.id,
      status: history.status,
      dish: dishDto,
      reason: reasonSnap,
      explanation: {
        summary: ai?.summary ?? reasonSnap?.summary ?? 'Phù hợp với nhu cầu của bạn.',
        compatibilityPercent: history.compatibilityPercent ?? 0,
        factors: ai?.factors ?? reasonSnap?.factors ?? [],
        nutritionHighlight: ai?.nutritionHighlight ?? null,
        matchTags: ai?.matchTags ?? reasonSnap?.factors?.slice(0, 3) ?? [],
        tip: ai?.tip ?? null,
        fallbackApplied: (history.fallbackSnapshot as any)?.relaxed ?? [],
        relaxableCriteria: (history.fallbackSnapshot as any)?.relaxed ?? [],
      },
      scoreBreakdown: history.scoreBreakdown,
      fallbackSnapshot: history.fallbackSnapshot,
      createdAt: history.createdAt,
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
      include: { dish: { include: { nutrition: true } } },
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

      // Tự động ghi vào Nhật ký bữa ăn (DiaryMealLog)
      if (row.dish) {
        try {
          const mappedNut = mapNutritionToPlanServing(row.dish.nutrition as any);
          const rawSlot = String(row.mealSlot || '').toUpperCase();
          let slot: DiaryMealSlot = DiaryMealSlot.LUNCH;
          if (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].includes(rawSlot)) {
            slot = rawSlot as DiaryMealSlot;
          } else {
            const h = vietnamHour();
            if (h >= 5 && h <= 10) slot = DiaryMealSlot.BREAKFAST;
            else if (h >= 11 && h <= 14) slot = DiaryMealSlot.LUNCH;
            else if (h >= 15 && h <= 16) slot = DiaryMealSlot.SNACK;
            else slot = DiaryMealSlot.DINNER;
          }

          await this.mealLogs.createFromRandomization({
            userId,
            randomizationId,
            dishId: row.dish.id,
            dishName: row.dish.name,
            mealSlot: slot,
            occurredAt: new Date(),
            timezone: 'Asia/Ho_Chi_Minh',
            kcal: mappedNut.kcal ?? 0,
            proteinG: mappedNut.proteinG,
            carbsG: mappedNut.carbsG,
            fatG: mappedNut.fatG,
          });
          this.logger.log(`[Randomization] Auto-created diary meal log for dish "${row.dish.name}" (id: ${row.dish.id})`);
        } catch (mealErr) {
          this.logger.warn(`[Randomization] Failed to auto-create diary meal log: ${mealErr}`);
        }
      }
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
  private encodeHistoryCursor(createdAt: Date, id: string) {
    return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
  }

  private decodeHistoryCursor(cursor?: string): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const [iso, id] = raw.split('|');
      if (!iso || !id) return null;
      return { createdAt: new Date(iso), id };
    } catch {
      return null;
    }
  }

  async getHistory(userId: string, query: RandomHistoryQueryDto) {
    const take = Math.min(query.limit ?? 20, 50);
    const decoded = this.decodeHistoryCursor(query.cursor);
    const outcome = (query.outcome ?? '').toUpperCase();

    const where: Prisma.RandomHistoryWhereInput = {
      userId,
      ...(query.selectedOnly || outcome === 'SELECTED'
        ? { isSelected: true }
        : outcome === 'SKIPPED'
          ? { isSelected: false }
          : {}),
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: decoded.createdAt } },
              { createdAt: decoded.createdAt, id: { lt: decoded.id } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.db.randomHistory.findMany({
      where,
      include: {
        dish: {
          select: {
            id: true, name: true, slug: true, status: true,
            media: {
              orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
              select: {
                storageKey: true,
                bucket: true,
                isPrimary: true,
                moderationStatus: true,
              },
              take: 5,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    const hasNextPage = rows.length > take;
    const data = hasNextPage ? rows.slice(0, take) : rows;
    const last = data[data.length - 1];

    return {
      data: data.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        outcome: r.isSelected ? 'SELECTED' : 'SKIPPED',
        isSelected: r.isSelected,
        mealSlot: r.mealSlot,
        dishId: r.dishId,
        dish: r.dish
          ? { ...r.dish, imageUrl: buildImageUrl(pickDishMedia(r.dish.media)) }
          : null,
      })),
      items: data.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        outcome: r.isSelected ? 'SELECTED' : 'SKIPPED',
        isSelected: r.isSelected,
        mealSlot: r.mealSlot,
        dishId: r.dishId,
        dish: r.dish
          ? { ...r.dish, imageUrl: buildImageUrl(pickDishMedia(r.dish.media)) }
          : null,
      })),
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? this.encodeHistoryCursor(last.createdAt, last.id)
            : null,
        hasNextPage,
      },
    };
  }

  async getHistorySummary(userId: string) {
    const [total, selected, last7] = await Promise.all([
      this.prisma.db.randomHistory.count({ where: { userId } }),
      this.prisma.db.randomHistory.count({ where: { userId, isSelected: true } }),
      this.prisma.db.randomHistory.count({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return {
      totalRuns: total,
      selectedCount: selected,
      skippedCount: Math.max(total - selected, 0),
      runsLast7Days: last7,
      definitionVersion: 'random-history-summary-v1',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Kết quả khi chế độ STRICT không tìm được món nào có quán bán trong bán kính.
   * Ghi history NO_CANDIDATE + trả thông điệp rõ ràng; KHÔNG gợi ý mở rộng bán kính (yêu cầu nghiệp vụ).
   */
  private async noNearbyDishResult(
    userId: string,
    dto: RandomizationRequestDto,
    ctx: {
      source: RecommendationSourceEnum;
      mealSlot: MealSlotEnum;
      budgetMode: BudgetModeEnum;
      budgetMin?: number;
      budgetMax?: number;
      requestedRadiusKm: number;
      dishCountInRadius: number;
      placeCountInRadius: number;
      warmupStatus: string | null;
      failReasonCode: 'NO_NEARBY_DISH' | 'NEARBY_LOOKUP_FAILED' | 'LOCATION_REQUIRED';
    },
  ) {
    try {
      await this.prisma.db.randomHistory.create({
        data: {
          userId,
          dishId: null,
          criteriaSnapshot: dto as any,
          algorithmVersion: ALGORITHM_VERSION,
          status: 'NO_CANDIDATE',
          source: ctx.source as any,
          mealSlot: ctx.mealSlot,
          budgetMode: ctx.budgetMode as any,
          budgetMinVnd: ctx.budgetMin ?? null,
          budgetMaxVnd: ctx.budgetMax ?? null,
          candidateCount: 0,
          failReasonCode: ctx.failReasonCode,
          fallbackSnapshot: {
            relaxed: [],
            nearby: {
              mode: 'STRICT',
              requestedRadiusKm: ctx.requestedRadiusKm,
              radiusUsedKm: null,
              placeCount: ctx.placeCountInRadius,
              dishCountInRadius: ctx.dishCountInRadius,
              warmup: ctx.warmupStatus,
            },
          } as any,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`[Randomization] ghi history NO_NEARBY_DISH lỗi: ${err}`);
    }

    const km = ctx.requestedRadiusKm;
    const summary =
      ctx.failReasonCode === 'LOCATION_REQUIRED'
        ? `Cần vị trí của bạn để tìm món có quán bán trong bán kính ${km}km.`
        : ctx.failReasonCode === 'NEARBY_LOOKUP_FAILED'
          ? `Không kiểm tra được quán quanh bạn lúc này. Vui lòng thử lại sau.`
        : ctx.dishCountInRadius > 0
          ? `Trong ${km}km quanh bạn có ${ctx.dishCountInRadius} món đang bán nhưng không món nào hợp với hồ sơ/tiêu chí hiện tại.`
          : ctx.placeCountInRadius > 0
            ? `Trong ${km}km quanh bạn có ${ctx.placeCountInRadius} quán nhưng chưa xác định được món nào trùng với thực đơn Mogu.`
            : `Chưa tìm thấy quán nào bán món trong ${km}km quanh vị trí của bạn.`;

    // Chỉ cho nới các tiêu chí mềm; KHÔNG có 'radius' / 'location'
    const relaxableCriteria =
      ctx.failReasonCode === 'NO_NEARBY_DISH' && ctx.dishCountInRadius > 0
        ? ['mealType', 'budget', 'dietType', 'excludeList']
        : [];

    return {
      randomizationId: null,
      dish: null,
      reason: null,
      explanation: {
        summary,
        compatibilityPercent: 0,
        factors: [],
        relaxableCriteria,
        fallbackApplied: [],
        failReasonCode: ctx.failReasonCode,
      },
      nearby: {
        mode: 'STRICT',
        requestedRadiusKm: km,
        radiusKm: null,
        placeCount: ctx.placeCountInRadius,
        openCount: 0,
        nearestMeters: null,
        dishCountInRadius: ctx.dishCountInRadius,
        fallback: false,
        warmup: ctx.warmupStatus,
        places: [] as PlaceDto[],
      },
    };
  }

  private scoreCandidate(
    dish: any,
    ctx: {
      goalCodes: string[];
      currentHour: number;
      weatherCode?: string;
      recentDishIds?: string[];
      lastSeenMap?: Map<string, Date>;
      tasteProfile?: UserTasteProfile;
      budgetMax?: number;
      hasLocation?: boolean;
      nearbyStat?: NearbyDishStat;
    },
  ): ScoreBreakdown {
    const { goalCodes, currentHour, weatherCode, recentDishIds = [], lastSeenMap, tasteProfile, budgetMax } = ctx;

    // 1. Goal match 0-30
    let goalMatch = goalCodes.length === 0 ? 15 : 0;
    if (goalCodes.length > 0 && dish.dishGoals?.length > 0) {
      const matched = dish.dishGoals.filter((dg: any) => goalCodes.includes(dg.goal?.code));
      if (matched.length > 0) {
        goalMatch = Math.round((matched.reduce((s: number, g: any) => s + g.score, 0) / matched.length / 100) * 30);
      }
    }

    // 2. Personal fit 0-20 (học từ 90 ngày randomHistory: mealType, region, price, skipped penalty)
    let personalFit = 10;
    if (tasteProfile && tasteProfile.totalHistories > 0) {
      let pf = 10;
      const dishMealCodes: string[] = dish.mealTypes?.map((mt: any) => mt.mealTypeTag?.code).filter(Boolean) ?? [];

      // Vùng miền quen thuộc
      if (dish.regionId && tasteProfile.selectedRegionScores.has(dish.regionId)) {
        const hits = tasteProfile.selectedRegionScores.get(dish.regionId)!;
        pf += Math.min(3, hits);
      }

      // Loại bữa ăn thường chọn
      const mealHits = dishMealCodes.reduce((sum, c) => sum + (tasteProfile.selectedMealTypeScores.get(c) ?? 0), 0);
      if (mealHits > 0) {
        pf += Math.min(4, Math.round(mealHits * 1.5));
      }

      // Giá món gần với mức giá thường chọn (±35%)
      const eatOutPrice = resolveEatOutPrice(dish, ctx.nearbyStat);
      const effectivePrice = eatOutPrice?.min ?? dish.dineOutPriceMin ?? dish.priceMin;
      if (tasteProfile.avgSelectedPrice && effectivePrice && tasteProfile.avgSelectedPrice > 0) {
        const diffRatio = Math.abs(effectivePrice - tasteProfile.avgSelectedPrice) / tasteProfile.avgSelectedPrice;
        if (diffRatio <= 0.35) {
          pf += 2;
        }
      }

      // Phạt nếu người dùng đã bỏ qua món này >= 2 lần
      const timesSkipped = tasteProfile.skippedDishCounts.get(dish.id) ?? 0;
      if (timesSkipped >= 2) {
        pf -= Math.min(6, timesSkipped * 2);
      }

      // Phạt nếu loại món này bị bỏ qua liên tục mà chưa từng chọn
      const mealSkips = dishMealCodes.reduce((sum, c) => sum + (tasteProfile.skippedMealTypeScores.get(c) ?? 0), 0);
      if (mealSkips >= 4 && mealHits === 0) {
        pf -= 3;
      }

      personalFit = Math.max(0, Math.min(20, Math.round(pf)));
    }

    // 3. Novelty 0-15 (suy giảm theo thời gian: 15 * min(1, daysSinceLastSeen / 7))
    let novelty = 15;
    if (lastSeenMap && lastSeenMap.has(dish.id)) {
      const lastSeen = lastSeenMap.get(dish.id)!;
      const diffMs = Date.now() - lastSeen.getTime();
      const daysSince = diffMs / 86400_000;
      novelty = Math.min(15, Math.max(0, Math.round(15 * Math.min(1, daysSince / 7))));
    } else if (recentDishIds.includes(dish.id)) {
      novelty = 0;
    }

    // 4. Data quality 0-10
    let dataQuality = 4;
    if (dish.nutrition) dataQuality += 3;
    if (dish.media?.length > 0) dataQuality += 3;

    // 5. Time suitability 0-10
    const mealCodes: string[] = dish.mealTypes?.map((mt: any) => mt.mealTypeTag?.code) ?? [];
    let timeSuitability = 5;
    if (currentHour >= 5 && currentHour < 10 && mealCodes.includes('BREAKFAST')) timeSuitability = 10;
    if (currentHour >= 10 && currentHour < 14 && mealCodes.includes('LUNCH')) timeSuitability = 10;
    if (currentHour >= 14 && currentHour < 17 && mealCodes.includes('SNACK')) timeSuitability = 10;
    if (currentHour >= 17 && mealCodes.includes('DINNER')) timeSuitability = 10;

    // 6. Weather suitability 0-10 (ưu tiên món nóng/nước khi mưa/lạnh, món mát/nhẹ khi nắng nóng)
    let weatherFit = 6;
    if (weatherCode) {
      const code = weatherCode.toUpperCase();
      const nameLower = (dish.name ?? '').toLowerCase();
      const descLower = (dish.shortDescription ?? '').toLowerCase();
      const text = `${nameLower} ${descLower}`;

      const isWarmOrSoup =
        /\b(canh|súp|sup|lẩu|lau|cháo|chao|phở|pho|hủ tiếu|hu tieu|bún nước|mì nước|bánh canh|hầm|kho tiêu|om|nóng)\b/i.test(text) ||
        dish.mealTypes?.some((mt: any) => ['SOUP', 'HOTPOT', 'STEW'].includes(mt.mealTypeTag?.code));

      const isCoolOrRefreshing =
        /\b(gỏi|goi|salad|nộm|nom|cuốn|cuon|thanh mát|chè|sinh tố|nước ép|trộn|trái cây)\b/i.test(text) ||
        dish.mealTypes?.some((mt: any) => ['SALAD', 'COLD_DISH', 'BEVERAGE', 'DESSERT'].includes(mt.mealTypeTag?.code));

      if (code === 'RAIN' || code === 'COLD' || code === 'CHILLY') {
        if (isWarmOrSoup) weatherFit = 10;
        else if (isCoolOrRefreshing) weatherFit = 3;
        else weatherFit = 6;
      } else if (code === 'HOT' || code === 'SUNNY') {
        if (isCoolOrRefreshing) weatherFit = 10;
        else if (isWarmOrSoup) weatherFit = 3;
        else weatherFit = 6;
      }
    }

    // 7. Popularity 0-10 (Bayesian average rating + isFeatured bonus)
    const C = 10; // trọng số prior
    const globalMean = 4.0; // rating trung bình mặc định
    const rawRating = Number(dish.ratingAvg);
    const rAvg = rawRating > 0 ? rawRating : globalMean;
    const rCount = Number(dish.ratingCount) || 0;
    const bayesianRating = (rAvg * rCount + globalMean * C) / (rCount + C);

    // Map bayesian rating (2.5 -> 5.0) sang 0 -> 8 điểm
    const basePop = Math.min(8, Math.max(1, ((bayesianRating - 2.5) / 2.5) * 8));
    const featuredBonus = dish.isFeatured ? 2 : 0;
    const popularity = Math.min(10, Math.round(basePop + featuredBonus));

    // 8. Budget fit 0-5
    let budgetFit = 4;
    const eatOut = resolveEatOutPrice(dish, ctx.nearbyStat);
    const candidatePrice = eatOut?.min ?? dish.dineOutPriceMin ?? dish.priceMin;
    if (budgetMax && candidatePrice) {
      budgetFit = candidatePrice <= budgetMax * 0.85 ? 5 : 2;
    }

    // 9. Proximity 0-10 (quán bán món gần người dùng)
    const proximity = proximityScore(ctx.nearbyStat, !!ctx.hasLocation);

    const total =
      goalMatch + personalFit + novelty + dataQuality + timeSuitability + weatherFit + popularity + budgetFit + proximity;
    return {
      goalMatch,
      personalFit,
      novelty,
      dataQuality,
      timeSuitability,
      weatherFit,
      popularity,
      budgetFit,
      proximity,
      total,
    };
  }

  private softmaxRandomSample(
    scored: Array<{ dish: any; score: number; breakdown: ScoreBreakdown; samplingWeight?: number }>,
    temperature = 12,
  ) {
    if (scored.length === 0) {
      throw new Error('No candidates to sample');
    }
    if (scored.length === 1) {
      scored[0].samplingWeight = 1;
      return scored[0];
    }

    const maxScore = Math.max(...scored.map((s) => s.score));
    const expWeights = scored.map((s) => Math.exp((s.score - maxScore) / temperature));
    const totalWeight = expWeights.reduce((sum, w) => sum + w, 0);

    scored.forEach((s, idx) => {
      s.samplingWeight = totalWeight > 0 ? expWeights[idx] / totalWeight : 1 / scored.length;
    });

    let r = Math.random() * totalWeight;
    for (let i = 0; i < scored.length; i++) {
      r -= expWeights[i];
      if (r <= 0) return scored[i];
    }
    return scored[scored.length - 1];
  }

  private buildReason(
    dish: any,
    ctx: {
      goalCodes: string[];
      mealSlot?: MealSlotEnum;
      weatherCode?: string;
      isPersonalized?: boolean;
      nearby?: { radiusKm: number; placeCount: number; openCount?: number; nearestMeters: number };
    },
  ) {
    const factors: string[] = [];
    if (ctx.nearby && ctx.nearby.placeCount > 0) {
      const open = ctx.nearby.openCount ?? 0;
      factors.push(
        `Có ${ctx.nearby.placeCount} quán bán trong bán kính ${ctx.nearby.radiusKm}km, gần nhất ~${formatMeters(ctx.nearby.nearestMeters)}` +
          (open > 0 ? `, ${open} quán đang mở` : ''),
      );
    }
    if (ctx.goalCodes?.length > 0) factors.push('Phù hợp với mục tiêu của bạn');
    if (ctx.mealSlot && ctx.mealSlot !== MealSlotEnum.ANY) {
      const label: Record<string, string> = {
        BREAKFAST: 'bữa sáng', LUNCH: 'bữa trưa', DINNER: 'bữa tối', SNACK: 'bữa snack',
      };
      factors.push(`Thích hợp cho ${label[ctx.mealSlot] ?? ctx.mealSlot}`);
    }
    if (dish.isFeatured) factors.push('Món được đề xuất nổi bật');
    if (dish.region?.name) factors.push(`Đặc trưng ${dish.region.name}`);
    if (ctx.weatherCode) {
      const code = ctx.weatherCode.toUpperCase();
      if (code === 'RAIN') factors.push('Ấm áp, phù hợp cho ngày trời mưa');
      else if (code === 'COLD' || code === 'CHILLY') factors.push('Nóng hổi, sưởi ấm ngày se lạnh');
      else if (code === 'HOT' || code === 'SUNNY') factors.push('Thanh mát, giải nhiệt cho ngày nắng ấm');
    }
    if (ctx.isPersonalized) factors.push('Hợp khẩu vị thường chọn của bạn');
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
      age?: number | null;
      goals?: string[];
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
    const eatOut = (dish as any).eatOutPrice ?? resolveEatOutPrice(dish as any, null);
    const priceStr = eatOut
      ? `${Math.round(eatOut.min / 1000)}K–${Math.round(eatOut.max / 1000)}K`
      : dish.priceMin && dish.priceMax
        ? `${Math.round(dish.priceMin / 1000)}K–${Math.round(dish.priceMax / 1000)}K`
        : dish.priceMax ? `~${Math.round(dish.priceMax / 1000)}K` : 'không rõ';

    const mealLabel: Record<string, string> = {
      BREAKFAST: 'bữa sáng', LUNCH: 'bữa trưa', DINNER: 'bữa tối', SNACK: 'bữa phụ', ANY: 'bất kỳ',
    };

    const profileStr = [
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
      // Model reasoning (deepseek-v3.x) tiêu ~500-700 token cho "reasoning_tokens" trước khi
      // sinh nội dung, nên max_tokens phải đủ lớn để JSON không bị cắt giữa chừng.
      const response = await this.aiService['client'].chat.completions.create(
        {
          model: this.explanationModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        },
        { timeout: AI_EXPLANATION_TIMEOUT_MS, maxRetries: 0 },
      );

      const choice = response.choices[0];
      const content = choice?.message?.content ?? '';
      if (choice?.finish_reason === 'length') {
        throw new Error('AI explanation truncated (finish_reason=length)');
      }
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
