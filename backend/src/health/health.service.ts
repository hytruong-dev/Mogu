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
    const hasAny =
      meals.items.length > 0 || water.totalMl > 0;

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
}
