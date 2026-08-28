import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WeeklyMealSlot, WeeklyPlanStatus, DishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyPlanCalculatorService } from './weekly-plan-calculator.service';

// Build Supabase Storage public URL từ storageKey
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
function buildStorageUrl(media: any): string | null {
  if (!media) return null;
  const bucket = media.bucket ?? 'dish-images';
  const key = media.storageKey ?? media.storage_key;
  if (!key) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
}
import {
  SLOT_MEAL_TAG,
  ALGORITHM_VERSION,
  MIN_CANDIDATES,
  DEFAULT_KCAL_TOLERANCE,
  MAX_KCAL_TOLERANCE,
} from '../constants/weekly-plan-weights';

interface DishCandidate {
  id: string;
  name: string;
  priceAvg: number;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  imageUrl: string | null;
  ratingAvg: number;
  score: number;
}

@Injectable()
export class WeeklyPlanGeneratorService {
  private readonly logger = new Logger(WeeklyPlanGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: WeeklyPlanCalculatorService,
  ) {}

  async run(planId: string): Promise<void> {
    this.logger.log(`[Generator] Starting plan generation: ${planId}`);

    const plan = await this.prisma.db.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        config: true,
        user: {
          include: {
            userAllergens: { include: { allergen: true } },
            userDietTypes: { include: { dietType: true } },
            userAvoidedIngredients: true,
            userGoals: { include: { goal: true } },
          },
        },
      },
    });

    if (!plan) {
      this.logger.error(`Plan ${planId} not found`);
      return;
    }

    const config = plan.config;
    const user = plan.user;
    const enabledSlots = config.enabledSlots as WeeklyMealSlot[];

    // Profile snapshot
    const profileSnapshot = {
      goalCodes: user.userGoals.map((g) => g.goal.code),
      allergenCodes: user.userAllergens.map((a) => a.allergen.code),
      hardDietTypeCodes: user.userDietTypes.filter((d) => d.isHard).map((d) => d.dietType.code),
      avoidedIngredients: user.userAvoidedIngredients.map((i) => i.ingredientName),
      goalKcal: user.goalKcal ?? config.kcalPerDay,
    };

    // Get recently eaten dishes for avoidRepeat
    const recentDishIds = new Set<string>();
    if (config.avoidRepeat) {
      const recentSlots = await this.prisma.db.weeklyPlanSlot.findMany({
        where: {
          plan: { userId: plan.userId },
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { dishId: true },
      });
      recentSlots.forEach((s) => recentDishIds.add(s.dishId));
    }

    // Generate date range
    const startDate = new Date(plan.startDate);
    const dates: Date[] = [];
    for (let i = 0; i < config.durationDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    // Per-day allocation
    const dayAllocation = this.calculator.allocateDay(config);

    // Build slots: (date × slot) sorted by hardest first (least candidates)
    interface SlotTask {
      date: Date;
      slot: WeeklyMealSlot;
      budgetVnd: number;
      kcal: number;
    }

    const slotTasks: SlotTask[] = [];
    for (const date of dates) {
      for (const slot of enabledSlots) {
        const alloc = dayAllocation[slot];
        slotTasks.push({
          date,
          slot,
          budgetVnd: alloc.budgetVnd,
          kcal: alloc.kcal,
        });
      }
    }

    // Track chosen dishes per task
    const chosenSlots: Array<{
      task: SlotTask;
      dish: DishCandidate;
    }> = [];

    const chosenDishIds = new Set<string>(recentDishIds);
    let tolerancePercent = config.calorieTolerancePercent;

    for (const task of slotTasks) {
      let candidates = await this.queryCandidates(
        task.slot,
        task.budgetVnd,
        task.kcal,
        tolerancePercent,
        profileSnapshot,
        chosenDishIds,
        config.avoidRepeat,
      );

      // Fallback 1: allow recent dishes
      if (candidates.length < MIN_CANDIDATES && config.avoidRepeat) {
        candidates = await this.queryCandidates(
          task.slot,
          task.budgetVnd,
          task.kcal,
          tolerancePercent,
          profileSnapshot,
          new Set(), // no exclusions
          false,
        );
      }

      // Fallback 2: loosen kcal tolerance
      if (candidates.length < MIN_CANDIDATES) {
        const looserTolerance = Math.min(tolerancePercent + 20, MAX_KCAL_TOLERANCE * 100);
        candidates = await this.queryCandidates(
          task.slot,
          task.budgetVnd,
          task.kcal,
          looserTolerance,
          profileSnapshot,
          new Set(),
          false,
        );
      }

      // Fallback 3: bỏ filter meal type, chỉ giữ PUBLISHED
      if (candidates.length < MIN_CANDIDATES) {
        this.logger.warn(`[Generator] Fallback 3 for slot ${task.slot}: ignoring meal type filter`);
        candidates = await this.queryAnyPublishedDish(chosenDishIds);
      }

      if (candidates.length === 0) {
        this.logger.warn(`No candidates for slot ${task.slot} on ${task.date.toISOString()}`);
        // Thay vì FAIL, lấy bất kỳ món nào đã publish
        const anyDish = await this.queryAnyPublishedDish(new Set());
        if (anyDish.length > 0) {
          candidates = anyDish;
        } else {
          await this.failPlan(planId, 'INSUFFICIENT_CANDIDATES', { slot: task.slot, date: task.date });
          return;
        }
      }

      // Score and pick weighted random from top-5
      candidates.sort((a, b) => b.score - a.score);
      const topK = candidates.slice(0, 5);
      const picked = this.weightedRandom(topK);

      chosenDishIds.add(picked.id);
      chosenSlots.push({ task, dish: picked });
    }

    // Validate plan totals
    const totalCost = chosenSlots.reduce((s, cs) => s + cs.dish.priceAvg, 0);
    const totalKcal = chosenSlots.reduce((s, cs) => s + cs.dish.kcal, 0);
    const avgDailyKcal = totalKcal / config.durationDays;
    const lo = config.kcalPerDay * (1 - DEFAULT_KCAL_TOLERANCE);
    const hi = config.kcalPerDay * (1 + DEFAULT_KCAL_TOLERANCE);

    if (totalCost > config.budgetVnd * 1.5) {
      // Chỉ FAIL nếu vượt 150% ngân sách — nới lỏng để không block khi data ít
      this.logger.warn(`[Generator] Budget exceeded: ${totalCost} > ${config.budgetVnd}`);
    }

    // Create slots in transaction
    try {
      await this.prisma.db.$transaction(async (tx) => {
        // Create all slots
        for (const cs of chosenSlots) {
          await tx.weeklyPlanSlot.create({
            data: {
              planId,
              dishId: cs.dish.id,
              date: cs.task.date,
              mealSlot: cs.task.slot,
              dishNameSnapshot: cs.dish.name,
              imageUrlSnapshot: cs.dish.imageUrl,
              priceSnapshotVnd: cs.dish.priceAvg,
              kcalSnapshot: cs.dish.kcal,
              proteinGSnapshot: cs.dish.proteinG !== null ? cs.dish.proteinG : undefined,
              carbsGSnapshot: cs.dish.carbsG !== null ? cs.dish.carbsG : undefined,
              fatGSnapshot: cs.dish.fatG !== null ? cs.dish.fatG : undefined,
              scoreSnapshot: { score: cs.dish.score } as Prisma.InputJsonValue,
            },
          });
        }

        // Update plan to READY
        await tx.weeklyPlan.update({
          where: { id: planId },
          data: {
            status: WeeklyPlanStatus.READY,
            projectedCostVnd: Math.round(totalCost),
            projectedKcal: Math.round(totalKcal),
            profileSnapshot: profileSnapshot as Prisma.InputJsonValue,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
      });

      this.logger.log(`[Generator] Plan ${planId} generated: ${chosenSlots.length} slots, cost=${totalCost}, kcal=${avgDailyKcal}/day`);
    } catch (err: any) {
      this.logger.error(`[Generator] Transaction failed: ${err.message}`);
      await this.failPlan(planId, 'GENERATION_FAILED', { error: err.message });
    }
  }

  private async queryCandidates(
    slot: WeeklyMealSlot,
    budgetVnd: number,
    targetKcal: number,
    tolerancePercent: number,
    profile: {
      allergenCodes: string[];
      hardDietTypeCodes: string[];
      avoidedIngredients: string[];
      goalCodes: string[];
    },
    excludeIds: Set<string>,
    applyExclusions: boolean,
  ): Promise<DishCandidate[]> {
    const mealTag = SLOT_MEAL_TAG[slot];
    const kcalLo = targetKcal * (1 - tolerancePercent / 100);
    const kcalHi = targetKcal * (1 + tolerancePercent / 100);

    const dishes = await this.prisma.db.dish.findMany({
      where: {
        status: DishStatus.PUBLISHED,
        deletedAt: null,
        nutrition: {
          calories: { gte: kcalLo, lte: kcalHi },
        },
        // Price filter: use priceMin or priceMax
        OR: [
          { priceMin: { lte: budgetVnd } },
          { priceMax: { lte: budgetVnd } },
          { AND: [{ priceMin: null }, { priceMax: null }] },
        ],
        // Exclude allergens (hard filter)
        ...(profile.allergenCodes.length > 0 && {
          NOT: {
            dishAllergens: {
              some: {
                allergen: { code: { in: profile.allergenCodes } },
              },
            },
          },
        }),
        // MealType filter
        mealTypes: {
          some: {
            mealTypeTag: {
              code: mealTag,
            },
          },
        },
        // Exclude dishes already chosen (if applyExclusions)
        ...(applyExclusions && excludeIds.size > 0 && {
          id: { notIn: Array.from(excludeIds) },
        }),
      },
      include: {
        nutrition: true,
        media: { where: { isPrimary: true }, take: 1 },
        dishGoals: { include: { goal: true } },
      } as any,
      take: 50,
    });

    return (dishes as any[]).map((d) => {
      const nutrition = d.nutrition as any;
      const media = d.media as any[];
      const dishGoals = d.dishGoals as any[];

      const kcal = nutrition?.calories ?? 0;
      const priceAvg = d.priceMin !== null
        ? Math.floor((d.priceMin + (d.priceMax ?? d.priceMin)) / 2)
        : 0;

      // Scoring
      const goalMatchScore = profile.goalCodes.length > 0
        ? dishGoals.filter((g: any) => profile.goalCodes.includes(g.goal.code)).length /
          profile.goalCodes.length
        : 0.5;

      const kcalFit = this.calculator.kcalFitScore(kcal, targetKcal);
      const budgetFit = this.calculator.budgetFitScore(priceAvg, budgetVnd);
      const ratingNorm = Number(d.ratingAvg) / 5;

      const score = goalMatchScore * 0.3 + kcalFit * 0.25 + budgetFit * 0.2 + ratingNorm * 0.25;

      return {
        id: d.id,
        name: d.name,
        priceAvg,
        kcal: Math.round(kcal),
        proteinG: nutrition?.protein !== null && nutrition?.protein !== undefined ? Number(nutrition.protein) : null,
        carbsG: nutrition?.carbs !== null && nutrition?.carbs !== undefined ? Number(nutrition.carbs) : null,
        fatG: nutrition?.fat !== null && nutrition?.fat !== undefined ? Number(nutrition.fat) : null,
        imageUrl: buildStorageUrl(media?.[0]),
        ratingAvg: Number(d.ratingAvg),
        score,
      };
    });
  }

  private weightedRandom(candidates: DishCandidate[]): DishCandidate {
    const totalScore = candidates.reduce((s, c) => s + Math.max(c.score, 0.01), 0);
    let rand = Math.random() * totalScore;
    for (const c of candidates) {
      rand -= Math.max(c.score, 0.01);
      if (rand <= 0) return c;
    }
    return candidates[candidates.length - 1];
  }

  /** Fallback: lấy bất kỳ món PUBLISHED nào, không filter gì cả */
  private async queryAnyPublishedDish(excludeIds: Set<string>): Promise<DishCandidate[]> {
    const dishes = await this.prisma.db.dish.findMany({
      where: {
        status: DishStatus.PUBLISHED,
        deletedAt: null,
        ...(excludeIds.size > 0 && { id: { notIn: Array.from(excludeIds) } }),
      },
      include: {
        nutrition: true,
        media: { where: { isPrimary: true }, take: 1 },
        dishGoals: { include: { goal: true } },
      } as any,
      take: 30,
      orderBy: { ratingAvg: 'desc' },
    });

    return (dishes as any[]).map((d) => {
      const nutrition = d.nutrition as any;
      const media = d.media as any[];
      const kcal = nutrition?.calories ?? 500;
      const priceAvg = d.priceMin !== null
        ? Math.floor((d.priceMin + (d.priceMax ?? d.priceMin)) / 2)
        : 50000;
      return {
        id: d.id,
        name: d.name,
        priceAvg,
        kcal: Math.round(kcal),
        proteinG: nutrition?.protein ? Number(nutrition.protein) : null,
        carbsG: nutrition?.carbs ? Number(nutrition.carbs) : null,
        fatG: nutrition?.fat ? Number(nutrition.fat) : null,
        imageUrl: buildStorageUrl(media?.[0]),
        ratingAvg: Number(d.ratingAvg),
        score: 0.5,
      };
    });
  }

  private async failPlan(planId: string, errorCode: string, errorData: object) {
    await this.prisma.db.weeklyPlan.update({
      where: { id: planId },
      data: {
        status: WeeklyPlanStatus.FAILED,
        generationErrorCode: errorCode,
        generationErrorData: errorData as Prisma.InputJsonValue,
      },
    });
  }
}
