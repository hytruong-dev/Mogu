import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertWeeklyPlanConfigDto } from '../dto/upsert-weekly-plan-config.dto';
import { WeeklyMealSlot } from '@prisma/client';

const DEFAULT_ENABLED_SLOTS: WeeklyMealSlot[] = [
  WeeklyMealSlot.MORNING,
  WeeklyMealSlot.LUNCH,
  WeeklyMealSlot.DINNER,
];

@Injectable()
export class WeeklyPlanConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyConfig(userId: string) {
    const config = await this.prisma.db.weeklyPlanConfig.findUnique({
      where: { userId },
    });
    if (!config) {
      // Return default config (not persisted yet)
      return {
        id: null,
        userId,
        budgetVnd: 300000,
        kcalPerDay: 2000,
        kcalMode: 'PROFILE',
        durationDays: 7,
        mealsPerDay: 3,
        enabledSlots: DEFAULT_ENABLED_SLOTS,
        avoidRepeat: true,
        preferHomeCook: false,
        calorieTolerancePercent: 10,
        createdAt: null,
        updatedAt: null,
      };
    }
    return config;
  }

  async upsertConfig(userId: string, dto: UpsertWeeklyPlanConfigDto) {
    const data = {
      budgetVnd: dto.budgetVnd,
      kcalPerDay: dto.kcalPerDay,
      ...(dto.kcalMode !== undefined && { kcalMode: dto.kcalMode }),
      ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
      ...(dto.mealsPerDay !== undefined && { mealsPerDay: dto.mealsPerDay }),
      ...(dto.enabledSlots !== undefined && { enabledSlots: dto.enabledSlots }),
      ...(dto.avoidRepeat !== undefined && { avoidRepeat: dto.avoidRepeat }),
      ...(dto.preferHomeCook !== undefined && { preferHomeCook: dto.preferHomeCook }),
      ...(dto.calorieTolerancePercent !== undefined && {
        calorieTolerancePercent: dto.calorieTolerancePercent,
      }),
    };

    return this.prisma.db.weeklyPlanConfig.upsert({
      where: { userId },
      create: {
        userId,
        enabledSlots: DEFAULT_ENABLED_SLOTS,
        ...data,
      },
      update: data,
    });
  }
}
