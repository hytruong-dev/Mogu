import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  DiaryItemReferenceType,
  DiaryMealSlot,
  DiaryMealSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealLogDto } from './dto/health.dto';
import { mapNutritionToPlanServing } from '../dishes/eligibility/dish-nutrition.mapper';

function localDateInTz(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMealLogDto, idempotencyKey?: string) {
    const timezone = dto.timezone || 'Asia/Ho_Chi_Minh';
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const localDateStr = localDateInTz(occurredAt, timezone);
    const localDate = new Date(`${localDateStr}T00:00:00.000Z`);
    const sourceType = dto.source?.type ?? DiaryMealSourceType.MANUAL;
    const weeklyPlanSlotId = dto.source?.weeklyPlanSlotId ?? null;

    if (weeklyPlanSlotId) {
      const existing = await this.prisma.db.diaryMealLog.findFirst({
        where: { weeklyPlanSlotId, deletedAt: null },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      if (existing) return this.format(existing);
    }

    const resolvedItems = await this.resolveItems(dto.items);
    const totals = resolvedItems.reduce(
      (acc, it) => {
        acc.kcal += Number(it.caloriesSnapshot ?? 0) * Number(it.quantity);
        acc.protein += Number(it.proteinGSnapshot ?? 0) * Number(it.quantity);
        acc.carbs += Number(it.carbsGSnapshot ?? 0) * Number(it.quantity);
        acc.fat += Number(it.fatGSnapshot ?? 0) * Number(it.quantity);
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const created = await this.prisma.db.diaryMealLog.create({
      data: {
        userId,
        mealSlot: dto.mealSlot,
        occurredAt,
        localDate,
        timezone,
        sourceType,
        randomizationId: dto.source?.randomizationId ?? null,
        weeklyPlanSlotId,
        note: dto.note ?? null,
        totalKcal: Math.round(totals.kcal),
        totalProteinG: totals.protein,
        totalCarbsG: totals.carbs,
        totalFatG: totals.fat,
        nutritionCoverage: resolvedItems.every((i) => i.caloriesSnapshot != null) ? 1 : 0.5,
        items: {
          create: resolvedItems.map((it, idx) => ({
            ...it,
            sortOrder: idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    return this.format(created);
  }

  async list(userId: string, localDate?: string, timezone = 'Asia/Ho_Chi_Minh') {
    const where: Prisma.DiaryMealLogWhereInput = {
      userId,
      deletedAt: null,
    };
    if (localDate) {
      where.localDate = new Date(`${localDate}T00:00:00.000Z`);
    }
    const items = await this.prisma.db.diaryMealLog.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ occurredAt: 'asc' }],
      take: 100,
    });
    return { items: items.map((x) => this.format(x)), timezone };
  }

  async getById(userId: string, id: string) {
    const log = await this.prisma.db.diaryMealLog.findFirst({
      where: { id, userId, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!log) throw new NotFoundException({ error: { code: 'MEAL_LOG_NOT_FOUND' } });
    return this.format(log);
  }

  async remove(userId: string, id: string, expectedVersion?: number) {
    const log = await this.prisma.db.diaryMealLog.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!log) throw new NotFoundException({ error: { code: 'MEAL_LOG_NOT_FOUND' } });
    if (expectedVersion != null && log.version !== expectedVersion) {
      throw new ConflictException({ error: { code: 'VERSION_CONFLICT' } });
    }
    await this.prisma.db.diaryMealLog.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    return { deleted: true };
  }

  /** Idempotent create from weekly slot complete */
  async createFromWeeklySlot(params: {
    userId: string;
    weeklyPlanSlotId: string;
    dishId: string;
    dishName: string;
    mealSlot: DiaryMealSlot;
    occurredAt: Date;
    timezone: string;
    kcal: number;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
  }) {
    const existing = await this.prisma.db.diaryMealLog.findFirst({
      where: { weeklyPlanSlotId: params.weeklyPlanSlotId, deletedAt: null },
      include: { items: true },
    });
    if (existing) return this.format(existing);

    const localDateStr = localDateInTz(params.occurredAt, params.timezone);
    const created = await this.prisma.db.diaryMealLog.create({
      data: {
        userId: params.userId,
        mealSlot: params.mealSlot,
        occurredAt: params.occurredAt,
        localDate: new Date(`${localDateStr}T00:00:00.000Z`),
        timezone: params.timezone,
        sourceType: DiaryMealSourceType.WEEKLY_PLAN,
        weeklyPlanSlotId: params.weeklyPlanSlotId,
        totalKcal: params.kcal,
        totalProteinG: params.proteinG ?? null,
        totalCarbsG: params.carbsG ?? null,
        totalFatG: params.fatG ?? null,
        nutritionCoverage: 1,
        items: {
          create: [
            {
              referenceType: DiaryItemReferenceType.DISH,
              referenceId: params.dishId,
              displayName: params.dishName,
              quantity: 1,
              unitCode: 'SERVING',
              caloriesSnapshot: params.kcal,
              proteinGSnapshot: params.proteinG ?? null,
              carbsGSnapshot: params.carbsG ?? null,
              fatGSnapshot: params.fatG ?? null,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { items: true },
    });
    return this.format(created);
  }

  private async resolveItems(items: CreateMealLogDto['items']) {
    const out: Array<{
      referenceType: DiaryItemReferenceType;
      referenceId: string | null;
      displayName: string;
      quantity: number;
      unitCode: string;
      gramEquivalent: number | null;
      caloriesSnapshot: number | null;
      proteinGSnapshot: number | null;
      carbsGSnapshot: number | null;
      fatGSnapshot: number | null;
      nutritionBasis: string | null;
    }> = [];

    for (const item of items) {
      if (item.referenceType === DiaryItemReferenceType.DISH) {
        if (!item.referenceId) {
          throw new BadRequestException({ error: { code: 'DISH_REFERENCE_REQUIRED' } });
        }
        const dish = await this.prisma.db.dish.findFirst({
          where: { id: item.referenceId, deletedAt: null },
          include: { nutrition: true },
        });
        if (!dish) {
          throw new NotFoundException({ error: { code: 'DISH_NOT_FOUND' } });
        }
        const mapped = mapNutritionToPlanServing(dish.nutrition as any);
        out.push({
          referenceType: DiaryItemReferenceType.DISH,
          referenceId: dish.id,
          displayName: item.displayName || dish.name,
          quantity: item.quantity,
          unitCode: item.unitCode || 'SERVING',
          gramEquivalent: item.gramEquivalent ?? null,
          caloriesSnapshot: mapped.kcal,
          proteinGSnapshot: mapped.proteinG,
          carbsGSnapshot: mapped.carbsG,
          fatGSnapshot: mapped.fatG,
          nutritionBasis: (dish.nutrition as any)?.basis ?? 'PER_SERVING',
        });
      } else {
        out.push({
          referenceType: item.referenceType,
          referenceId: item.referenceId ?? null,
          displayName: item.displayName || 'Món tùy chỉnh',
          quantity: item.quantity,
          unitCode: item.unitCode || 'SERVING',
          gramEquivalent: item.gramEquivalent ?? null,
          caloriesSnapshot: null,
          proteinGSnapshot: null,
          carbsGSnapshot: null,
          fatGSnapshot: null,
          nutritionBasis: null,
        });
      }
    }
    return out;
  }

  private format(log: any) {
    return {
      id: log.id,
      mealSlot: log.mealSlot,
      occurredAt: log.occurredAt,
      localDate: log.localDate?.toISOString?.().slice(0, 10) ?? log.localDate,
      timezone: log.timezone,
      sourceType: log.sourceType,
      weeklyPlanSlotId: log.weeklyPlanSlotId,
      note: log.note,
      totals: {
        kcal: log.totalKcal,
        proteinG: log.totalProteinG != null ? Number(log.totalProteinG) : null,
        carbsG: log.totalCarbsG != null ? Number(log.totalCarbsG) : null,
        fatG: log.totalFatG != null ? Number(log.totalFatG) : null,
      },
      nutritionCoverage: log.nutritionCoverage != null ? Number(log.nutritionCoverage) : null,
      version: log.version,
      items: (log.items ?? []).map((it: any) => ({
        id: it.id,
        referenceType: it.referenceType,
        referenceId: it.referenceId,
        displayName: it.displayName,
        quantity: Number(it.quantity),
        unitCode: it.unitCode,
        calories: it.caloriesSnapshot != null ? Number(it.caloriesSnapshot) : null,
        proteinG: it.proteinGSnapshot != null ? Number(it.proteinGSnapshot) : null,
        carbsG: it.carbsGSnapshot != null ? Number(it.carbsGSnapshot) : null,
        fatG: it.fatGSnapshot != null ? Number(it.fatGSnapshot) : null,
      })),
    };
  }
}
