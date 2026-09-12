import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MealLogsService } from './meal-logs.service';
import { WaterLogsService } from './water-logs.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealLogs: MealLogsService,
    private readonly waterLogs: WaterLogsService,
  ) {}

  async getDay(userId: string, localDate: string, timezone = 'Asia/Ho_Chi_Minh') {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: { goalKcal: true },
    });

    const meals = await this.mealLogs.list(userId, localDate, timezone);
    const water = await this.waterLogs.list(userId, localDate);

    const consumedKcal = meals.items.reduce((s, m) => s + (m.totals.kcal || 0), 0);
    const proteinG = meals.items.reduce((s, m) => s + (m.totals.proteinG || 0), 0);
    const carbsG = meals.items.reduce((s, m) => s + (m.totals.carbsG || 0), 0);
    const fatG = meals.items.reduce((s, m) => s + (m.totals.fatG || 0), 0);

    const targetKcal = profile?.goalKcal ?? null;
    const hasAny = meals.items.length > 0 || water.totalMl > 0;

    const mealGroups = (['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((slot) => {
      const slotMeals = meals.items.filter((m) => m.mealSlot === slot);
      return {
        mealSlot: slot,
        meals: slotMeals,
        totalKcal: slotMeals.reduce((s, m) => s + (m.totals.kcal || 0), 0),
      };
    });

    return {
      localDate,
      timezone,
      dataStatus: hasAny ? (meals.items.length ? 'OK' : 'PARTIAL') : 'no_data',
      energy: {
        consumedKcal: hasAny ? consumedKcal : null,
        targetKcal,
        remainingKcal:
          targetKcal != null ? Math.max(targetKcal - consumedKcal, 0) : null,
        burnedKcal: null,
      },
      macros: {
        protein: { consumedG: hasAny ? proteinG : null, targetG: null },
        carbs: { consumedG: hasAny ? carbsG : null, targetG: null },
        fat: { consumedG: hasAny ? fatG : null, targetG: null },
      },
      water: {
        consumedMl: hasAny ? water.totalMl : null,
        targetMl: 2000,
      },
      steps: { count: null, target: null, source: null, syncedAt: null },
      mealGroups,
      tips: [],
      coverage: {
        energy: meals.items.length ? 1 : 0,
        macros: meals.items.some((m) => m.totals.proteinG != null) ? 0.8 : 0,
        micronutrients: 0,
      },
    };
  }

  async getCalendar(userId: string, monthParam?: string, timezone = 'Asia/Ho_Chi_Minh') {
    const month = monthParam ?? new Date().toISOString().slice(0, 7);
    const [yearStr, mStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(mStr, 10);

    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 1));

    const mealLogs = await (this.prisma.db as any).diaryMealLog.findMany({
      where: {
        userId,
        localDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: { localDate: true },
    });

    const waterLogs = await (this.prisma.db as any).waterLog.findMany({
      where: {
        userId,
        localDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: { localDate: true },
    });

    const dateMap = new Map<string, { mealCount: number; waterCount: number }>();

    for (const log of mealLogs) {
      const dateStr = log.localDate.toISOString().slice(0, 10);
      const existing = dateMap.get(dateStr) ?? { mealCount: 0, waterCount: 0 };
      existing.mealCount++;
      dateMap.set(dateStr, existing);
    }

    for (const log of waterLogs) {
      const dateStr = log.localDate.toISOString().slice(0, 10);
      const existing = dateMap.get(dateStr) ?? { mealCount: 0, waterCount: 0 };
      existing.waterCount++;
      dateMap.set(dateStr, existing);
    }

    const days: Array<{
      localDate: string;
      hasMealLog: boolean;
      hasWaterLog: boolean;
      completionRatio: number;
    }> = [];

    dateMap.forEach((val, dateStr) => {
      const completionRatio = Math.min(
        1.0,
        (val.mealCount > 0 ? 0.7 : 0) + (val.waterCount > 0 ? 0.3 : 0),
      );
      days.push({
        localDate: dateStr,
        hasMealLog: val.mealCount > 0,
        hasWaterLog: val.waterCount > 0,
        completionRatio,
      });
    });

    days.sort((a, b) => a.localDate.localeCompare(b.localDate));

    return {
      month,
      timezone,
      days,
    };
  }
}
