import { Injectable } from '@nestjs/common';
import { LikedDishPreference, Prisma, WeeklyMealSlot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertWeeklyPlanConfigDto } from '../dto/upsert-weekly-plan-config.dto';

const DEFAULT_ENABLED_SLOTS: WeeklyMealSlot[] = [
  WeeklyMealSlot.MORNING,
  WeeklyMealSlot.LUNCH,
  WeeklyMealSlot.DINNER,
];

const DEFAULT_SCHEDULE = [
  { type: WeeklyMealSlot.MORNING, enabled: true, time: '07:00' },
  { type: WeeklyMealSlot.LUNCH, enabled: true, time: '12:00' },
  { type: WeeklyMealSlot.DINNER, enabled: true, time: '18:30' },
  { type: WeeklyMealSlot.SNACK, enabled: false, time: null },
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
        mealSlotSchedule: DEFAULT_SCHEDULE,
        avoidRepeat: true,
        preferHomeCook: true,
        allowOutsideMeals: true,
        repeatWindowDays: 7,
        preferNewDishes: true,
        likedDishPreference: LikedDishPreference.LIGHT,
        keepLockedMeals: true,
        preserveLoggedDays: true,
        calorieTolerancePercent: 10,
        createdAt: null,
        updatedAt: null,
      };
    }
    const slots = Array.from(new Set(config.enabledSlots as WeeklyMealSlot[]));
    return {
      ...config,
      enabledSlots: slots,
      mealsPerDay: slots.length,
      mealSlotSchedule: config.mealSlotSchedule ?? this.scheduleFromSlots(slots),
    };
  }

  async upsertConfig(userId: string, dto: UpsertWeeklyPlanConfigDto) {
    const advanced = dto.advanced;
    const preferHomeCook =
      advanced?.preferSelfCook !== undefined
        ? advanced.preferSelfCook
        : dto.preferHomeCook;
    const avoidRepeat =
      advanced?.limitRepeats !== undefined ? advanced.limitRepeats : dto.avoidRepeat;

    let enabledSlots = dto.enabledSlots
      ? Array.from(new Set(dto.enabledSlots))
      : undefined;

    if (dto.mealSlotSchedule?.length) {
      enabledSlots = dto.mealSlotSchedule
        .filter((s) => s.enabled)
        .map((s) => s.type);
      enabledSlots = Array.from(new Set(enabledSlots));
    }

    const mealsPerDay = enabledSlots?.length ?? dto.mealsPerDay;
    const mealSlotScheduleJson = dto.mealSlotSchedule
      ? (JSON.parse(JSON.stringify(dto.mealSlotSchedule)) as Prisma.InputJsonValue)
      : undefined;

    const data: Prisma.WeeklyPlanConfigUncheckedUpdateInput = {
      budgetVnd: dto.budgetVnd,
      kcalPerDay: dto.kcalPerDay,
      ...(dto.kcalMode !== undefined && { kcalMode: dto.kcalMode }),
      ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
      ...(mealsPerDay !== undefined && { mealsPerDay }),
      ...(enabledSlots !== undefined && { enabledSlots }),
      ...(mealSlotScheduleJson !== undefined && {
        mealSlotSchedule: mealSlotScheduleJson,
      }),
      ...(avoidRepeat !== undefined && { avoidRepeat }),
      ...(preferHomeCook !== undefined && { preferHomeCook }),
      ...(advanced?.allowOutsideMeals !== undefined
        ? { allowOutsideMeals: advanced.allowOutsideMeals }
        : dto.allowOutsideMeals !== undefined
          ? { allowOutsideMeals: dto.allowOutsideMeals }
          : {}),
      ...(advanced?.repeatWindowDays !== undefined
        ? { repeatWindowDays: advanced.repeatWindowDays }
        : dto.repeatWindowDays !== undefined
          ? { repeatWindowDays: dto.repeatWindowDays }
          : {}),
      ...(advanced?.preferNewDishes !== undefined
        ? { preferNewDishes: advanced.preferNewDishes }
        : dto.preferNewDishes !== undefined
          ? { preferNewDishes: dto.preferNewDishes }
          : {}),
      ...(advanced?.likedDishPreference !== undefined
        ? { likedDishPreference: advanced.likedDishPreference }
        : dto.likedDishPreference !== undefined
          ? { likedDishPreference: dto.likedDishPreference }
          : {}),
      ...(advanced?.keepLockedMeals !== undefined
        ? { keepLockedMeals: advanced.keepLockedMeals }
        : dto.keepLockedMeals !== undefined
          ? { keepLockedMeals: dto.keepLockedMeals }
          : {}),
      ...(advanced?.preserveLoggedDays !== undefined
        ? { preserveLoggedDays: advanced.preserveLoggedDays }
        : dto.preserveLoggedDays !== undefined
          ? { preserveLoggedDays: dto.preserveLoggedDays }
          : {}),
      ...(dto.calorieTolerancePercent !== undefined && {
        calorieTolerancePercent: dto.calorieTolerancePercent,
      }),
    };

    const createSchedule =
      mealSlotScheduleJson ??
      (JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)) as Prisma.InputJsonValue);

    return this.prisma.db.weeklyPlanConfig.upsert({
      where: { userId },
      create: {
        userId,
        budgetVnd: dto.budgetVnd,
        kcalPerDay: dto.kcalPerDay,
        kcalMode: dto.kcalMode,
        durationDays: dto.durationDays,
        enabledSlots: enabledSlots ?? DEFAULT_ENABLED_SLOTS,
        mealsPerDay: mealsPerDay ?? DEFAULT_ENABLED_SLOTS.length,
        mealSlotSchedule: createSchedule,
        preferHomeCook: preferHomeCook ?? true,
        avoidRepeat: avoidRepeat ?? true,
        allowOutsideMeals: advanced?.allowOutsideMeals ?? dto.allowOutsideMeals ?? true,
        repeatWindowDays: advanced?.repeatWindowDays ?? dto.repeatWindowDays ?? 7,
        preferNewDishes: advanced?.preferNewDishes ?? dto.preferNewDishes ?? true,
        likedDishPreference:
          advanced?.likedDishPreference ??
          dto.likedDishPreference ??
          LikedDishPreference.LIGHT,
        keepLockedMeals: advanced?.keepLockedMeals ?? dto.keepLockedMeals ?? true,
        preserveLoggedDays:
          advanced?.preserveLoggedDays ?? dto.preserveLoggedDays ?? true,
        calorieTolerancePercent: dto.calorieTolerancePercent,
      },
      update: data,
    });
  }

  private scheduleFromSlots(slots: WeeklyMealSlot[]) {
    const enabled = new Set(slots);
    return DEFAULT_SCHEDULE.map((item) => ({
      ...item,
      enabled: enabled.has(item.type),
    }));
  }
}
