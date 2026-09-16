import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NutritionTodayQueryDto, NutritionTodayResponseDto } from './dto/nutrition.dto';

/** Lấy ngày local VN theo định dạng YYYY-MM-DD */
function getVNLocalDate(): string {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnTime.toISOString().slice(0, 10);
}

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /nutrition/today — nguồn sự thật: DiaryMealLog */
  async getTodaySummary(
    userId: string,
    query: NutritionTodayQueryDto,
  ): Promise<NutritionTodayResponseDto> {
    const localDate = query.localDate ?? getVNLocalDate();
    const localDateValue = new Date(`${localDate}T00:00:00.000Z`);

    const mealLogs = await this.prisma.db.diaryMealLog.findMany({
      where: {
        userId,
        localDate: localDateValue,
        deletedAt: null,
      },
      select: {
        totalKcal: true,
        totalProteinG: true,
      },
    });

    if (mealLogs.length === 0) {
      return { date: localDate, dataStatus: 'no_data' };
    }

    const caloriesConsumed = mealLogs.reduce((sum, l) => sum + l.totalKcal, 0);
    const proteinG = mealLogs.reduce(
      (sum, l) => sum + (l.totalProteinG != null ? Number(l.totalProteinG) : 0),
      0,
    );

    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: { goalKcal: true },
    });
    const healthTarget = await (this.prisma.db as any).healthTarget
      .findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } })
      .catch(() => null);

    const calorieTarget =
      healthTarget?.energyKcal ?? profile?.goalKcal ?? undefined;

    const dataStatus: 'partial' | 'complete' =
      calorieTarget && caloriesConsumed >= calorieTarget * 0.8
        ? 'complete'
        : 'partial';

    return {
      date: localDate,
      dataStatus,
      caloriesConsumed,
      calorieTarget,
      proteinG: Math.round(proteinG * 10) / 10,
      mealsLogged: mealLogs.length,
    };
  }
}
