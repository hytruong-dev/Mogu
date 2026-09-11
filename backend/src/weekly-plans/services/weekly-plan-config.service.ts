import { Injectable } from '@nestjs/common';
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
      return {
        id: null,
        userId,
        budgetVnd: 300000,
        kcalPerDay: 2000,
        kcalMode: 'PROFILE',
        durationDays: 7,
        mealsPerDay: DEFAULT_ENABLED_SLOTS.length,
        enabledSlots: DEFAULT_ENABLED_SLOTS,
        avoidRepeat: true,
        preferHomeCook: false,
        calorieTolerancePercent: 10,
        createdAt: null,
        updatedAt: null,
      };
    }
    const slots = Array.from(new Set(config.enabledSlots as WeeklyMealSlot[]));
    return { ...config, enabledSlots: slots, mealsPerDay: slots.length };
  }

  async upsertConfig(userId: string, dto: UpsertWeeklyPlanConfigDto) {
    const enabledSlots = dto.enabledSlots
      ? Array.from(new Set(dto.enabledSlots))
      : undefined;
    const mealsPerDay = enabledSlots?.length ?? dto.mealsPerDay;

    const data = {
      budgetVnd: dto.budgetVnd,
      kcalPerDay: dto.kcalPerDay,
      ...(dto.kcalMode !== undefined && { kcalMode: dto.kcalMode }),
      ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
      ...(mealsPerDay !== undefined && { mealsPerDay }),
      ...(enabledSlots !== undefined && { enabledSlots }),
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
        enabledSlots: enabledSlots ?? DEFAULT_ENABLED_SLOTS,
        mealsPerDay: mealsPerDay ?? DEFAULT_ENABLED_SLOTS.length,
        ...data,
      },
      update: data,
    });
  }
}
