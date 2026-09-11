import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  WeeklyMealSlot,
  WeeklyPlanStatus,
  WeeklyKcalMode,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyPlanCalculatorService } from './weekly-plan-calculator.service';
import { DishEligibilityService } from '../../dishes/eligibility/dish-eligibility.service';
import {
  mapNutritionToPlanServing,
  planPriceVnd,
} from '../../dishes/eligibility/dish-nutrition.mapper';
import {
  SLOT_MEAL_TAG,
  ALGORITHM_VERSION,
  DEFAULT_KCAL_TOLERANCE,
} from '../constants/weekly-plan-weights';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';

function buildStorageUrl(media: { bucket?: string; storageKey?: string } | null): string | null {
  if (!media?.storageKey) return null;
  const bucket = media.bucket ?? 'dish-images';
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${media.storageKey}`;
}

interface DishCandidate {
  id: string;
  name: string;
  priceMin: number;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  imageUrl: string | null;
  ratingAvg: number;
  score: number;
}

interface ProfileSnapshot {
  goalCodes: string[];
  allergenCodes: string[];
  hardDietTypeCodes: string[];
  avoidedIngredients: string[];
  goalKcal: number | null;
  effectiveKcalPerDay: number;
  kcalSource: 'PROFILE' | 'CUSTOM' | 'DEFAULT';
}

@Injectable()
export class WeeklyPlanGeneratorService {
  private readonly logger = new Logger(WeeklyPlanGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: WeeklyPlanCalculatorService,
    private readonly eligibility: DishEligibilityService,
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
        slots: { select: { id: true } },
      },
    });

    if (!plan) {
      this.logger.error(`Plan ${planId} not found`);
      return;
    }

    // Idempotent: already READY with slots
    if (plan.status === WeeklyPlanStatus.READY && plan.slots.length > 0) {
      this.logger.log(`[Generator] Plan ${planId} already READY — no-op`);
      return;
    }

    // Do not revive archived/cancelled
    if (
      plan.status === WeeklyPlanStatus.ARCHIVED ||
      plan.status === WeeklyPlanStatus.CANCELLED ||
      plan.status === WeeklyPlanStatus.COMPLETED
    ) {
      this.logger.warn(`[Generator] Plan ${planId} status=${plan.status} — skip`);
      return;
    }

    // Prefer immutable configSnapshot when present (R2-02)
    const snap = (plan.configSnapshot ?? null) as Record<string, unknown> | null;
    const config = {
      budgetVnd: Number(snap?.budgetVnd ?? plan.budgetLimitVnd ?? plan.config.budgetVnd),
      kcalPerDay: Number(snap?.kcalPerDay ?? plan.config.kcalPerDay),
      kcalMode: (snap?.kcalMode as WeeklyKcalMode) ?? plan.config.kcalMode,
      durationDays: Number(snap?.durationDays ?? plan.config.durationDays),
      enabledSlots: (snap?.enabledSlots as WeeklyMealSlot[]) ??
        (plan.config.enabledSlots as WeeklyMealSlot[]),
      avoidRepeat: Boolean(snap?.avoidRepeat ?? plan.config.avoidRepeat),
      calorieTolerancePercent: Number(
        snap?.calorieTolerancePercent ?? plan.config.calorieTolerancePercent ?? 10,
      ),
    };

    const enabledSlots = Array.from(new Set(config.enabledSlots));
    if (enabledSlots.length === 0) {
      await this.failPlan(planId, 'INVALID_CONFIG', { reason: 'enabledSlots empty' });
      return;
    }

    const user = plan.user;
    const profileSnapshot = this.buildProfileSnapshot(user, config);

    const recentDishIds = new Set<string>();
    if (config.avoidRepeat) {
      const recentSlots = await this.prisma.db.weeklyPlanSlot.findMany({
        where: {
          plan: { userId: plan.userId },
          status: { in: ['COMPLETED', 'PLANNED'] },
          createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { dishId: true },
      });
      recentSlots.forEach((s) => recentDishIds.add(s.dishId));
    }

    const startDate = new Date(plan.startDate);
    const dates: Date[] = [];
    for (let i = 0; i < config.durationDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    const effectiveConfig = {
      ...config,
      kcalPerDay: profileSnapshot.effectiveKcalPerDay,
      enabledSlots,
    };
    const dayAllocation = this.calculator.allocateDay(effectiveConfig);

    interface SlotTask {
      date: Date;
      slot: WeeklyMealSlot;
      budgetVnd: number;
      kcal: number;
      candidateCount: number;
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
          candidateCount: 0,
        });
      }
    }

    // Prefetch counts → process hardest (fewest candidates) first
    for (const task of slotTasks) {
      const count = await this.prisma.db.dish.count({
        where: this.eligibility.buildHardWhere(
          {
            allergenCodes: profileSnapshot.allergenCodes,
            hardDietTypeCodes: profileSnapshot.hardDietTypeCodes,
            avoidedIngredients: profileSnapshot.avoidedIngredients,
          },
          'weekly',
          {
            requirePrice: true,
            mealTypeCodes: [SLOT_MEAL_TAG[task.slot], 'ANY'],
            excludeDishIds: Array.from(recentDishIds),
          },
        ),
      });
      task.candidateCount = count;
    }
    slotTasks.sort((a, b) => a.candidateCount - b.candidateCount);

    const chosenSlots: Array<{ task: SlotTask; dish: DishCandidate }> = [];
    const chosenDishIds = new Set<string>(recentDishIds);
    let remainingBudget = config.budgetVnd;
    let remainingSlots = slotTasks.length;
    let tolerancePercent = Math.min(Math.max(config.calorieTolerancePercent, 0), 30);

    for (const task of slotTasks) {
      const slotBudgetCap = Math.min(
        task.budgetVnd,
        Math.max(0, Math.floor(remainingBudget / Math.max(remainingSlots, 1))),
      );

      let candidates = await this.queryCandidates(
        task.slot,
        slotBudgetCap,
        task.kcal,
        tolerancePercent,
        profileSnapshot,
        chosenDishIds,
        true,
      );
      const relaxations: string[] = [];

      if (candidates.length === 0 && config.avoidRepeat) {
        relaxations.push('avoid_repeat');
        candidates = await this.queryCandidates(
          task.slot,
          slotBudgetCap,
          task.kcal,
          tolerancePercent,
          profileSnapshot,
          new Set(chosenSlots.map((c) => c.dish.id)),
          true,
        );
      }

      if (candidates.length === 0) {
        const nextTol = Math.max(tolerancePercent, Math.min(tolerancePercent + 10, 30));
        if (nextTol > tolerancePercent) {
          tolerancePercent = nextTol;
          relaxations.push('kcal_tolerance');
        }
        candidates = await this.queryCandidates(
          task.slot,
          slotBudgetCap,
          task.kcal,
          tolerancePercent,
          profileSnapshot,
          new Set(chosenSlots.map((c) => c.dish.id)),
          true,
        );
      }

      // Soft: drop meal type filter but KEEP hard eligibility + price
      if (candidates.length === 0) {
        relaxations.push('meal_type');
        candidates = await this.queryCandidates(
          task.slot,
          slotBudgetCap,
          task.kcal,
          tolerancePercent,
          profileSnapshot,
          new Set(chosenSlots.map((c) => c.dish.id)),
          true,
          true,
        );
      }

      // Allow 1–2 candidates (do not require MIN_CANDIDATES)
      if (candidates.length === 0) {
        await this.failPlan(planId, 'INSUFFICIENT_CANDIDATES', {
          slot: task.slot,
          date: task.date,
          relaxations,
        });
        return;
      }

      candidates.sort((a, b) => b.score - a.score);
      const topK = candidates.slice(0, 5);
      const picked = this.weightedRandom(topK);

      if (picked.priceMin > remainingBudget) {
        await this.failPlan(planId, 'BUDGET_EXCEEDED', {
          remainingBudget,
          dishPrice: picked.priceMin,
          dishId: picked.id,
        });
        return;
      }

      chosenDishIds.add(picked.id);
      chosenSlots.push({ task, dish: picked });
      remainingBudget -= picked.priceMin;
      remainingSlots -= 1;

      if (relaxations.length) {
        this.logger.warn(
          `[Generator] Soft relaxations for ${task.slot}: ${relaxations.join(',')}`,
        );
      }
    }

    const totalCost = chosenSlots.reduce((s, cs) => s + cs.dish.priceMin, 0);
    const totalKcal = chosenSlots.reduce((s, cs) => s + (cs.dish.kcal || 0), 0);

    // Final validators
    if (totalCost > config.budgetVnd) {
      await this.failPlan(planId, 'BUDGET_EXCEEDED', {
        totalCost,
        budgetLimit: config.budgetVnd,
      });
      return;
    }

    const kcalByDay = new Map<string, number>();
    for (const cs of chosenSlots) {
      const key = cs.task.date.toISOString().slice(0, 10);
      kcalByDay.set(key, (kcalByDay.get(key) ?? 0) + (cs.dish.kcal || 0));
    }
    const lo = profileSnapshot.effectiveKcalPerDay * (1 - DEFAULT_KCAL_TOLERANCE);
    const hi = profileSnapshot.effectiveKcalPerDay * (1 + Math.max(tolerancePercent / 100, DEFAULT_KCAL_TOLERANCE));
    for (const [day, dayKcal] of kcalByDay) {
      // Only validate days that have planned meals; skip if all kcal unknown (0)
      if (dayKcal <= 0) continue;
      if (dayKcal < lo * 0.5 || dayKcal > hi * 1.5) {
        this.logger.warn(`[Generator] Day ${day} kcal=${dayKcal} outside soft band [${lo},${hi}]`);
      }
    }

    try {
      await this.prisma.db.$transaction(async (tx) => {
        const fresh = await tx.weeklyPlan.findUnique({ where: { id: planId } });
        if (!fresh || fresh.status === WeeklyPlanStatus.ARCHIVED) {
          throw new Error('PLAN_ARCHIVED_OR_MISSING');
        }
        if (fresh.status === WeeklyPlanStatus.READY) {
          return;
        }

        for (const cs of chosenSlots) {
          await tx.weeklyPlanSlot.create({
            data: {
              planId,
              dishId: cs.dish.id,
              date: cs.task.date,
              mealSlot: cs.task.slot,
              dishNameSnapshot: cs.dish.name,
              imageUrlSnapshot: cs.dish.imageUrl,
              priceSnapshotVnd: cs.dish.priceMin,
              kcalSnapshot: cs.dish.kcal,
              proteinGSnapshot: cs.dish.proteinG ?? undefined,
              carbsGSnapshot: cs.dish.carbsG ?? undefined,
              fatGSnapshot: cs.dish.fatG ?? undefined,
              scoreSnapshot: { score: cs.dish.score } as Prisma.InputJsonValue,
            },
          });
        }

        await tx.weeklyPlan.update({
          where: { id: planId },
          data: {
            status: WeeklyPlanStatus.READY,
            projectedCostVnd: Math.round(totalCost),
            projectedKcal: Math.round(totalKcal),
            targetKcal: profileSnapshot.effectiveKcalPerDay * config.durationDays,
            profileSnapshot: profileSnapshot as unknown as Prisma.InputJsonValue,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
      });

      this.logger.log(
        `[Generator] Plan ${planId} READY: ${chosenSlots.length} slots, cost=${totalCost}`,
      );
    } catch (err: any) {
      this.logger.error(`[Generator] Transaction failed: ${err.message}`);
      if (err.message !== 'PLAN_ARCHIVED_OR_MISSING') {
        await this.failPlan(planId, 'GENERATION_FAILED', { error: err.message });
      }
    }
  }

  private buildProfileSnapshot(
    user: {
      goalKcal: number | null;
      userGoals: Array<{ goal: { code: string } }>;
      userAllergens: Array<{ allergen: { code: string } }>;
      userDietTypes: Array<{ isHard: boolean; dietType: { code: string } }>;
      userAvoidedIngredients: Array<{ ingredientName: string }>;
    },
    config: { kcalPerDay: number; kcalMode: WeeklyKcalMode },
  ): ProfileSnapshot {
    let effectiveKcalPerDay = config.kcalPerDay;
    let kcalSource: ProfileSnapshot['kcalSource'] = 'CUSTOM';

    if (config.kcalMode === WeeklyKcalMode.PROFILE) {
      if (user.goalKcal != null && user.goalKcal > 0) {
        effectiveKcalPerDay = user.goalKcal;
        kcalSource = 'PROFILE';
      } else {
        effectiveKcalPerDay = config.kcalPerDay || 2000;
        kcalSource = 'DEFAULT';
      }
    }

    return {
      goalCodes: user.userGoals.map((g) => g.goal.code),
      allergenCodes: user.userAllergens.map((a) => a.allergen.code),
      hardDietTypeCodes: user.userDietTypes.filter((d) => d.isHard).map((d) => d.dietType.code),
      avoidedIngredients: user.userAvoidedIngredients.map((i) =>
        i.ingredientName.trim().toLowerCase(),
      ),
      goalKcal: user.goalKcal,
      effectiveKcalPerDay,
      kcalSource,
    };
  }

  private async queryCandidates(
    slot: WeeklyMealSlot,
    budgetVnd: number,
    targetKcal: number,
    tolerancePercent: number,
    profile: ProfileSnapshot,
    excludeIds: Set<string>,
    applyExclusions: boolean,
    ignoreMealType = false,
  ): Promise<DishCandidate[]> {
    const mealTag = SLOT_MEAL_TAG[slot];
    const kcalLo = targetKcal * (1 - tolerancePercent / 100);
    const kcalHi = targetKcal * (1 + tolerancePercent / 100);

    const hardWhere = this.eligibility.buildHardWhere(
      {
        allergenCodes: profile.allergenCodes,
        hardDietTypeCodes: profile.hardDietTypeCodes,
        avoidedIngredients: profile.avoidedIngredients,
      },
      'weekly',
      {
        requirePrice: true,
        maxPriceMin: budgetVnd,
        mealTypeCodes: ignoreMealType ? undefined : [mealTag, 'ANY'],
        excludeDishIds: applyExclusions && excludeIds.size > 0 ? Array.from(excludeIds) : undefined,
      },
    );

    const dishes = await this.prisma.db.dish.findMany({
      where: {
        AND: [
          hardWhere,
          {
            OR: [
              { nutrition: { calories: { gte: kcalLo, lte: kcalHi } } },
              { nutrition: null },
            ],
          },
        ],
      },
      include: {
        nutrition: true,
        media: { where: { isPrimary: true }, take: 1 },
        dishGoals: { include: { goal: true } },
      },
      take: 80,
      orderBy: { ratingAvg: 'desc' },
    });

    return dishes
      .map((d) => {
        const mapped = mapNutritionToPlanServing(d.nutrition as any);
        const price = planPriceVnd(d.priceMin != null ? Number(d.priceMin) : null);
        if (price === null) return null;

        const kcal = mapped.kcal ?? 0;
        const goalMatchScore =
          profile.goalCodes.length > 0
            ? d.dishGoals.filter((g) => profile.goalCodes.includes(g.goal.code)).length /
              profile.goalCodes.length
            : 0.5;

        const kcalFit = mapped.kcal != null
          ? this.calculator.kcalFitScore(mapped.kcal, targetKcal)
          : 0.3;
        const budgetFit = this.calculator.budgetFitScore(price, budgetVnd);
        const ratingNorm = Number(d.ratingAvg) / 5;
        const score = goalMatchScore * 0.3 + kcalFit * 0.25 + budgetFit * 0.2 + ratingNorm * 0.25;

        return {
          id: d.id,
          name: d.name,
          priceMin: price,
          kcal: mapped.kcal != null ? Math.round(mapped.kcal) : 0,
          proteinG: mapped.proteinG,
          carbsG: mapped.carbsG,
          fatG: mapped.fatG,
          imageUrl: buildStorageUrl(d.media?.[0] ?? null),
          ratingAvg: Number(d.ratingAvg),
          score,
        } satisfies DishCandidate;
      })
      .filter((c): c is DishCandidate => c != null);
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
