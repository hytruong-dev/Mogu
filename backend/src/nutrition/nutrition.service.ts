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

  /** GET /nutrition/today */
  async getTodaySummary(
    userId: string,
    query: NutritionTodayQueryDto,
  ): Promise<NutritionTodayResponseDto> {
    // HOME-BR-011: localDate tính theo múi giờ user (VN mặc định)
    const localDate = query.localDate ?? getVNLocalDate();

    // Tìm tất cả meals trong ngày local (theo VN timezone +07:00)
    const dayStart = new Date(`${localDate}T00:00:00+07:00`);
    const dayEnd = new Date(`${localDate}T23:59:59+07:00`);

    // Query meal logs trong ngày
    const mealLogs = await this.prisma.db.mealLog.findMany({
      where: {
        userId,
        loggedAt: { gte: dayStart, lte: dayEnd },
      },
      select: { totalKcal: true, mealId: true },
    });

    // HOME-BR-012: không có dữ liệu → trả no_data, không hiển thị 0
    if (mealLogs.length === 0) {
      return { date: localDate, dataStatus: 'no_data' };
    }

    const caloriesConsumed = mealLogs.reduce((sum, l) => sum + l.totalKcal, 0);
    const mealIds = mealLogs.map((l) => l.mealId);

    // Query protein từ meal items + foods
    const mealItems = await this.prisma.db.mealItem.findMany({
      where: { mealId: { in: mealIds } },
      select: {
        quantity: true,
        grams: true,
        food: { select: { protein: true } },
      },
    });

    const proteinG = mealItems.reduce((sum, item) => {
      const factor = item.grams ? item.grams / 100 : item.quantity;
      return sum + item.food.protein * factor;
    }, 0);

    // Lấy goal kcal từ profile
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: { goalKcal: true },
    });
    const calorieTarget = profile?.goalKcal ?? undefined;

    // Xác định dataStatus
    const dataStatus: 'partial' | 'complete' =
      calorieTarget && caloriesConsumed >= calorieTarget * 0.8 ? 'complete' : 'partial';

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

