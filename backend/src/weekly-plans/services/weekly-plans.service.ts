import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
  Inject,
  Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { WeeklyPlanStatus, WeeklyPlanSlotStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyPlanGeneratorService } from './weekly-plan-generator.service';
import { MealLogsService } from '../../health/meal-logs.service';
import { DiaryMealSlot } from '@prisma/client';
import { GenerateWeeklyPlanDto } from '../dto/generate-weekly-plan.dto';
import { LockWeeklyPlanSlotDto } from '../dto/lock-weekly-plan-slot.dto';
import { CompleteWeeklyPlanSlotDto } from '../dto/complete-weekly-plan-slot.dto';
import { WeeklyPlanQueryDto } from '../dto/weekly-plan-query.dto';
import { WEEKLY_PLAN_ERRORS } from '../constants/weekly-plan-errors';
import { ALGORITHM_VERSION } from '../constants/weekly-plan-weights';

export const WEEKLY_PLAN_QUEUE = 'weekly-plan-generation';
export const WEEKLY_PLAN_QUEUE_TOKEN = `BullQueue_${WEEKLY_PLAN_QUEUE}`;

@Injectable()
export class WeeklyPlansService {
  private readonly logger = new Logger(WeeklyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: WeeklyPlanGeneratorService,
    private readonly mealLogs: MealLogsService,
    @Optional() @Inject(WEEKLY_PLAN_QUEUE_TOKEN) private readonly queue: Queue | null,
  ) {}

  // ── Config helpers ─────────────────────────────────────────────────────────

  private async requireConfig(userId: string) {
    // Lấy hoặc tạo config mặc định nếu user chưa thiết lập
    const existing = await this.prisma.db.weeklyPlanConfig.findUnique({ where: { userId } });
    if (existing) return existing;

    // Auto-create default config
    this.logger.log(`[WeeklyPlans] Auto-creating default config for user ${userId}`);
    return this.prisma.db.weeklyPlanConfig.create({
      data: {
        userId,
        budgetVnd: 300000,
        kcalPerDay: 2000,
        durationDays: 7,
        mealsPerDay: 3,
        enabledSlots: ['MORNING', 'LUNCH', 'DINNER'] as any,
        avoidRepeat: true,
      },
    });
  }

  // ── Plans ──────────────────────────────────────────────────────────────────

  async generate(userId: string, dto: GenerateWeeklyPlanDto) {
    const config = await this.requireConfig(userId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + config.durationDays);

    // Config snapshot
    const configSnapshot = {
      budgetVnd: config.budgetVnd,
      kcalPerDay: config.kcalPerDay,
      kcalMode: config.kcalMode,
      durationDays: config.durationDays,
      enabledSlots: config.enabledSlots,
      avoidRepeat: config.avoidRepeat,
      calorieTolerancePercent: config.calorieTolerancePercent,
      mealsPerDay: Array.from(new Set(config.enabledSlots as string[])).length,
    };

    // Create plan in GENERATING state
    const plan = await this.prisma.db.weeklyPlan.create({
      data: {
        userId,
        configId: config.id,
        startDate,
        endDate,
        budgetLimitVnd: config.budgetVnd,
        targetKcal: config.kcalPerDay * config.durationDays,
        configSnapshot: configSnapshot as any,
        algorithmVersion: ALGORITHM_VERSION,
      },
    });

    // Enqueue generation job — nếu có Redis thì async, không có thì chạy đồng bộ ngay
    if (this.queue) {
      await this.queue.add(
        'generate',
        { planId: plan.id },
        {
          jobId: `plan-${plan.id}`,
          removeOnComplete: 100,
          removeOnFail: 200,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
      this.logger.log(`[WeeklyPlans] Plan ${plan.id} queued for async generation.`);
    } else {
      // Không có Redis → chạy generator đồng bộ ngay lập tức
      this.logger.warn(`[WeeklyPlans] Redis not configured — running generator synchronously for plan ${plan.id}`);
      try {
        await this.generator.run(plan.id);
        this.logger.log(`[WeeklyPlans] Synchronous generation completed for plan ${plan.id}`);
      } catch (err) {
        this.logger.error(`[WeeklyPlans] Synchronous generation failed for plan ${plan.id}`, err);
      }
    }

    return { planId: plan.id, status: plan.status };
  }

  async getCurrent(userId: string) {
    // Priority: ACTIVE > READY > GENERATING (mới nhất)
    const activePlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (activePlan) return this.formatPlan(activePlan);

    const readyPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.READY },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (readyPlan) return this.formatPlan(readyPlan);

    // Trả GENERATING để mobile hiển thị banner "đang tạo..."
    const generatingPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.GENERATING },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (generatingPlan) return this.formatPlan(generatingPlan);

    // Trả FAILED mới nhất để mobile hiển thị lỗi thay vì che giấu
    const failedPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (failedPlan) return this.formatPlan(failedPlan);

    return null;
  }

  async getById(planId: string, userId: string) {
    const plan = await this.prisma.db.weeklyPlan.findUnique({
      where: { id: planId },
      include: this.planInclude(),
    });

    if (!plan || plan.userId !== userId) {
      throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_NOT_FOUND } });
    }

    return this.formatPlan(plan);
  }

  async listPlans(userId: string, query: WeeklyPlanQueryDto) {
    const { cursor, limit = 10 } = query;

    const plans = await this.prisma.db.weeklyPlan.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { slots: true } },
      },
    });

    const hasNextPage = plans.length > limit;
    const items = hasNextPage ? plans.slice(0, limit) : plans;

    return {
      items: items.map((p) => ({
        id: p.id,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        projectedCostVnd: p.projectedCostVnd,
        budgetLimitVnd: p.budgetLimitVnd,
        projectedKcal: p.projectedKcal,
        targetKcal: p.targetKcal,
        slotCount: p._count.slots,
        createdAt: p.createdAt,
      })),
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    };
  }

  async startPlan(planId: string, userId: string, expectedVersion: number) {
    const plan = await this.findPlanForUser(planId, userId);

    if (plan.status !== WeeklyPlanStatus.READY) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_NOT_READY } });
    }

    if (plan.version !== expectedVersion) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    const existing = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.ACTIVE, id: { not: planId } },
    });
    if (existing) {
      // User explicitly starts a new READY plan → archive previous ACTIVE (BR-04 handoff)
      await this.prisma.db.weeklyPlan.update({
        where: { id: existing.id },
        data: { status: WeeklyPlanStatus.ARCHIVED, archivedAt: new Date() },
      });
    }

    // CAS: only start if still READY at expected version
    const result = await this.prisma.db.weeklyPlan.updateMany({
      where: {
        id: planId,
        version: expectedVersion,
        status: WeeklyPlanStatus.READY,
      },
      data: {
        status: WeeklyPlanStatus.ACTIVE,
        startedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    return this.prisma.db.weeklyPlan.findUniqueOrThrow({ where: { id: planId } });
  }

  /**
   * BR-04: Do not archive old plan until the new one is READY.
   * Keep current ACTIVE/READY while generating; return new planId for polling.
   */
  async regeneratePlan(planId: string, userId: string) {
    const plan = await this.findPlanForUser(planId, userId);

    if (
      plan.status === WeeklyPlanStatus.ARCHIVED ||
      plan.status === WeeklyPlanStatus.CANCELLED
    ) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_NOT_READY } });
    }

    const newPlan = await this.generate(userId, {
      startDate: plan.startDate.toISOString().split('T')[0],
    });

    return {
      ...newPlan,
      previousPlanId: planId,
      note: 'Previous plan stays ACTIVE/READY until you start the new plan.',
    };
  }

  async archivePlan(planId: string, userId: string) {
    const plan = await this.findPlanForUser(planId, userId);

    return this.prisma.db.weeklyPlan.update({
      where: { id: planId },
      data: { status: WeeklyPlanStatus.ARCHIVED, archivedAt: new Date() },
    });
  }

  // ── Slots ──────────────────────────────────────────────────────────────────

  async lockSlot(planId: string, slotId: string, userId: string, dto: LockWeeklyPlanSlotDto) {
    const slot = await this.findSlotForUser(planId, slotId, userId);

    if (slot.version !== dto.version) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    return this.prisma.db.weeklyPlanSlot.update({
      where: { id: slotId },
      data: { isLocked: dto.isLocked, version: { increment: 1 } },
    });
  }

  async completeSlot(planId: string, slotId: string, userId: string, dto: CompleteWeeklyPlanSlotDto) {
    const slot = await this.findSlotForUser(planId, slotId, userId);

    if (slot.version !== dto.version) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    // Idempotent: already completed
    if (slot.status === WeeklyPlanSlotStatus.COMPLETED) {
      return slot;
    }

    if (slot.status !== WeeklyPlanSlotStatus.PLANNED) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_NOT_PLANNED } });
    }

    const actualCostVnd = dto.actualCostVnd ?? slot.priceSnapshotVnd;
    const actualKcal = dto.actualKcal ?? slot.kcalSnapshot;

    const updatedSlot = await this.prisma.db.$transaction(async (tx) => {
      const cas = await tx.weeklyPlanSlot.updateMany({
        where: {
          id: slotId,
          version: dto.version,
          status: WeeklyPlanSlotStatus.PLANNED,
        },
        data: {
          status: WeeklyPlanSlotStatus.COMPLETED,
          actualCostVnd,
          actualKcal,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (cas.count === 0) {
        throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
      }

      // Legacy MealLog (dual-read window)
      await this.upsertMealLogForSlot(tx, userId, slot, actualKcal);

      return tx.weeklyPlanSlot.findUniqueOrThrow({ where: { id: slotId } });
    });

    // New diary meal log (idempotent on weeklyPlanSlotId)
    const slotMap: Record<string, DiaryMealSlot> = {
      MORNING: DiaryMealSlot.BREAKFAST,
      LUNCH: DiaryMealSlot.LUNCH,
      DINNER: DiaryMealSlot.DINNER,
      SNACK: DiaryMealSlot.SNACK,
    };
    try {
      await this.mealLogs.createFromWeeklySlot({
        userId,
        weeklyPlanSlotId: slotId,
        dishId: slot.dishId,
        dishName: slot.dishNameSnapshot,
        mealSlot: slotMap[slot.mealSlot] ?? DiaryMealSlot.SNACK,
        occurredAt: new Date(),
        timezone: 'Asia/Ho_Chi_Minh',
        kcal: actualKcal,
        proteinG: slot.proteinGSnapshot != null ? Number(slot.proteinGSnapshot) : null,
        carbsG: slot.carbsGSnapshot != null ? Number(slot.carbsGSnapshot) : null,
        fatG: slot.fatGSnapshot != null ? Number(slot.fatGSnapshot) : null,
      });
    } catch (err) {
      this.logger.warn(`[WeeklyPlans] diary meal log skipped for slot ${slotId}: ${err}`);
    }

    await this.updatePlanActuals(planId);
    await this.checkPlanCompletion(planId);

    return updatedSlot;
  }

  /**
   * BR-05: COMPLETE → MealLog + actuals (idempotent via note = weekly-slot:{id})
   */
  private async upsertMealLogForSlot(
    tx: any,
    userId: string,
    slot: { id: string; date: Date; mealSlot: string },
    totalKcal: number,
  ) {
    const mealTypeMap: Record<string, 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'> = {
      MORNING: 'BREAKFAST',
      LUNCH: 'LUNCH',
      DINNER: 'DINNER',
      SNACK: 'SNACK',
    };
    const type = mealTypeMap[slot.mealSlot] ?? 'SNACK';
    const note = `weekly-slot:${slot.id}`;

    const existing = await tx.mealLog.findFirst({
      where: { userId, note },
      select: { id: true },
    });
    if (existing) return;

    const meal = await tx.meal.upsert({
      where: {
        userId_type_date: {
          userId,
          type,
          date: slot.date,
        },
      },
      create: { userId, type, date: slot.date },
      update: {},
    });

    await tx.mealLog.create({
      data: {
        userId,
        mealId: meal.id,
        totalKcal,
        note,
      },
    });
  }

  async skipSlot(planId: string, slotId: string, userId: string, version: number) {
    const slot = await this.findSlotForUser(planId, slotId, userId);

    if (slot.version !== version) {
      throw new ConflictException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_VERSION_CONFLICT } });
    }

    if (slot.status !== WeeklyPlanSlotStatus.PLANNED) {
      throw new BadRequestException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_NOT_PLANNED } });
    }

    return this.prisma.db.weeklyPlanSlot.update({
      where: { id: slotId },
      data: {
        status: WeeklyPlanSlotStatus.SKIPPED,
        skippedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findPlanForUser(planId: string, userId: string) {
    const plan = await this.prisma.db.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_NOT_FOUND } });
    }
    return plan;
  }

  private async findSlotForUser(planId: string, slotId: string, userId: string) {
    const slot = await this.prisma.db.weeklyPlanSlot.findUnique({
      where: { id: slotId },
      include: { plan: true },
    });
    if (!slot || slot.planId !== planId || slot.plan.userId !== userId) {
      throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.SLOT_NOT_FOUND } });
    }
    return slot;
  }

  private planInclude() {
    return {
      slots: {
        orderBy: [
          { date: 'asc' as const },
          { mealSlot: 'asc' as const },
        ],
        include: {
          dish: {
            select: {
              id: true,
              media: {
                where: { isPrimary: true, moderationStatus: 'APPROVED' as any },
                select: { storageKey: true, bucket: true },
                take: 1,
              },
            },
          },
        },
      },
    };
  }

  private buildImageUrl(storageKey: string | null | undefined, bucket: string | null | undefined): string | null {
    if (!storageKey) return null;
    const b = bucket ?? 'dish-images';
    const base = process.env.SUPABASE_URL ?? '';
    return `${base}/storage/v1/object/public/${b}/${storageKey}`;
  }

  private formatPlan(plan: any) {
    // Group slots by date
    const dayMap = new Map<string, typeof plan.slots>();
    for (const slot of plan.slots) {
      const key = slot.date.toISOString().split('T')[0];
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(slot);
    }

    const days = Array.from(dayMap.entries()).map(([date, slots]) => ({
      date,
      slots: slots.map((s: any) => ({
        id: s.id,
        mealSlot: s.mealSlot,
        status: s.status,
        isLocked: s.isLocked,
        swapCount: s.swapCount,
        version: s.version,
        dish: {
          id: s.dishId,
          name: s.dishNameSnapshot,
          imageUrl: s.imageUrlSnapshot
            ?? this.buildImageUrl(
                s.dish?.media?.[0]?.storageKey,
                s.dish?.media?.[0]?.bucket,
              ),
          priceVnd: s.priceSnapshotVnd,
          kcal: s.kcalSnapshot,
          proteinG: s.proteinGSnapshot,
          carbsG: s.carbsGSnapshot,
          fatG: s.fatGSnapshot,
        },
        actualCostVnd: s.actualCostVnd,
        actualKcal: s.actualKcal,
        completedAt: s.completedAt,
        skippedAt: s.skippedAt,
      })),
    }));

    return {
      id: plan.id,
      status: plan.status,
      startDate: plan.startDate,
      endDate: plan.endDate,
      budgetLimitVnd: plan.budgetLimitVnd,
      projectedCostVnd: plan.projectedCostVnd,
      actualSpentVnd: plan.actualSpentVnd,
      targetKcal: plan.targetKcal,
      projectedKcal: plan.projectedKcal,
      actualKcal: plan.actualKcal,
      algorithmVersion: plan.algorithmVersion,
      generationErrorCode: plan.generationErrorCode,
      version: plan.version,
      createdAt: plan.createdAt,
      startedAt: plan.startedAt,
      completedAt: plan.completedAt,
      forecast: {
        spentVnd: plan.actualSpentVnd ?? 0,
        remainingProjectedVnd: Math.max(
          0,
          (plan.projectedCostVnd ?? 0) - (plan.actualSpentVnd ?? 0),
        ),
        endOfPeriodProjectedVnd: plan.projectedCostVnd ?? 0,
        budgetLimitVnd: plan.budgetLimitVnd,
        remainingBudgetVnd: Math.max(0, plan.budgetLimitVnd - (plan.actualSpentVnd ?? 0)),
      },
      days,
    };
  }

  private async updatePlanActuals(planId: string) {
    const completedSlots = await this.prisma.db.weeklyPlanSlot.findMany({
      where: { planId, status: WeeklyPlanSlotStatus.COMPLETED },
      select: { actualCostVnd: true, actualKcal: true, priceSnapshotVnd: true, kcalSnapshot: true },
    });

    const actualSpentVnd = completedSlots.reduce(
      (s, sl) => s + (sl.actualCostVnd ?? sl.priceSnapshotVnd),
      0,
    );
    const actualKcal = completedSlots.reduce(
      (s, sl) => s + (sl.actualKcal ?? sl.kcalSnapshot),
      0,
    );

    await this.prisma.db.weeklyPlan.update({
      where: { id: planId },
      data: { actualSpentVnd, actualKcal },
    });
  }

  private async checkPlanCompletion(planId: string) {
    const plan = await this.prisma.db.weeklyPlan.findUnique({
      where: { id: planId },
      include: { slots: { select: { status: true } } },
    });

    if (!plan || plan.status !== WeeklyPlanStatus.ACTIVE) return;

    const allDone = plan.slots.every(
      (s) => s.status === WeeklyPlanSlotStatus.COMPLETED || s.status === WeeklyPlanSlotStatus.SKIPPED,
    );

    if (allDone) {
      await this.prisma.db.weeklyPlan.update({
        where: { id: planId },
        data: { status: WeeklyPlanStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }

  async getGenerationStatus(planId: string, userId: string) {
    const plan = await this.prisma.db.weeklyPlan.findFirst({
      where: { id: planId, userId },
      include: {
        slots: { select: { id: true, dishId: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException(WEEKLY_PLAN_ERRORS.PLAN_NOT_FOUND);
    }

    const totalSlots = plan.slots.length;
    const completedSlots = plan.slots.filter((s) => s.dishId != null).length;
    const percent = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;

    return {
      planId: plan.id,
      status: plan.status,
      progress: {
        totalSlots,
        completedSlots,
        percent,
      },
      error: plan.generationErrorCode ?? null,
    };
  }
}
