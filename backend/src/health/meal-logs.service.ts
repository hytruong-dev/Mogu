import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  PreconditionFailedException,
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

function buildImageUrl(media: { storageKey?: string | null; bucket?: string | null } | undefined | null): string | null {
  if (!media?.storageKey) return null;
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!supabaseUrl) return null;
  const bucket = media.bucket ?? 'dish-images';
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${media.storageKey}`;
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

    const dishIds = items
      .flatMap((x) => x.items)
      .filter((i) => i.referenceType === DiaryItemReferenceType.DISH && i.referenceId)
      .map((i) => i.referenceId as string);

    const dishes =
      dishIds.length > 0
        ? await this.prisma.db.dish.findMany({
            where: { id: { in: dishIds } },
            select: {
              id: true,
              media: {
                select: { storageKey: true, bucket: true, sourceUrl: true, isPrimary: true, moderationStatus: true },
              },
            },
          })
        : [];

    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    return {
      items: items.map((x) => {
        const formatted = this.format(x);
        formatted.items = formatted.items.map((it: any) => {
          const dish = it.referenceId ? dishMap.get(it.referenceId) : null;
          let thumb: string | null = null;
          if (dish?.media?.length) {
            const primary =
              dish.media.find((m: any) => m.isPrimary && m.storageKey) ??
              dish.media.find((m: any) => !!m.storageKey);
            thumb = buildImageUrl(primary) ?? primary?.sourceUrl ?? null;
          }
          return {
            ...it,
            thumbnailUrl: thumb,
          };
        });
        return formatted;
      }),
      timezone,
    };
  }

  async getById(userId: string, id: string) {
    const log = await this.prisma.db.diaryMealLog.findFirst({
      where: { id, userId, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!log) throw new NotFoundException({ error: { code: 'MEAL_LOG_NOT_FOUND' } });
    return this.format(log);
  }

  async getStats(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'day',
    dateParam?: string,
    timezone = 'Asia/Ho_Chi_Minh',
  ) {
    const todayStr = localDateInTz(new Date(), timezone);
    const refDateStr = dateParam || todayStr;

    // Parse ref date
    const [yStr, mStr, dStr] = refDateStr.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);

    let startDateStr = refDateStr;
    let endDateStr = refDateStr;
    let label = '';

    if (period === 'day') {
      startDateStr = refDateStr;
      endDateStr = refDateStr;
      const isToday = refDateStr === todayStr;
      label = `${isToday ? 'Hôm nay, ' : ''}${day} tháng ${month}`;
    } else if (period === 'week') {
      const refDate = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = (refDate.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
      const monday = new Date(refDate);
      monday.setUTCDate(refDate.getUTCDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      startDateStr = monday.toISOString().slice(0, 10);
      endDateStr = sunday.toISOString().slice(0, 10);

      const firstDayOfYear = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
      const pastDaysOfYear = (monday.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);

      const [, sM, sD] = startDateStr.split('-');
      const [eY, eM, eD] = endDateStr.split('-');
      label = `Tuần ${weekNum} (${sD}/${sM} - ${eD}/${eM}/${eY})`;
    } else if (period === 'month') {
      startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      label = `Tháng ${String(month).padStart(2, '0')}/${year}`;
    } else if (period === 'year') {
      startDateStr = `${year}-01-01`;
      endDateStr = `${year}-12-31`;
      label = `Năm ${year}`;
    }

    const [mealLogs, profile, healthTarget] = await Promise.all([
      this.prisma.db.diaryMealLog.findMany({
        where: {
          userId,
          deletedAt: null,
          localDate: {
            gte: new Date(`${startDateStr}T00:00:00.000Z`),
            lte: new Date(`${endDateStr}T00:00:00.000Z`),
          },
        },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ occurredAt: 'desc' }],
      }),
      this.prisma.db.profile.findUnique({
        where: { userId },
        select: { goalKcal: true },
      }),
      (this.prisma.db as any).healthTarget
        .findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        })
        .catch(() => null),
    ]);

    // Fetch dish media for thumbnails
    const dishIds = mealLogs
      .flatMap((x) => x.items)
      .filter((i) => i.referenceType === DiaryItemReferenceType.DISH && i.referenceId)
      .map((i) => i.referenceId as string);

    const dishes =
      dishIds.length > 0
        ? await this.prisma.db.dish.findMany({
            where: { id: { in: dishIds } },
            select: {
              id: true,
              media: {
                select: { storageKey: true, bucket: true, sourceUrl: true, isPrimary: true, moderationStatus: true },
              },
            },
          })
        : [];

    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    const formattedLogs = mealLogs.map((x) => {
      const formatted = this.format(x);
      formatted.items = formatted.items.map((it: any) => {
        const dish = it.referenceId ? dishMap.get(it.referenceId) : null;
        let thumb: string | null = null;
        if (dish?.media?.length) {
          const primary =
            dish.media.find((m: any) => m.isPrimary && m.storageKey) ??
            dish.media.find((m: any) => !!m.storageKey);
          thumb = buildImageUrl(primary) ?? primary?.sourceUrl ?? null;
        }
        return {
          ...it,
          thumbnailUrl: thumb,
        };
      });
      return formatted;
    });

    // Totals
    const totalKcal = mealLogs.reduce((s, m) => s + (m.totalKcal || 0), 0);
    const totalProteinG = mealLogs.reduce((s, m) => s + (m.totalProteinG ? Number(m.totalProteinG) : 0), 0);
    const totalCarbsG = mealLogs.reduce((s, m) => s + (m.totalCarbsG ? Number(m.totalCarbsG) : 0), 0);
    const totalFatG = mealLogs.reduce((s, m) => s + (m.totalFatG ? Number(m.totalFatG) : 0), 0);

    // Days logged
    const distinctDates = new Set(mealLogs.map((m) => m.localDate.toISOString().slice(0, 10)));
    const activeDays = distinctDates.size;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const totalDaysInPeriod =
      period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? daysInMonth : 365;

    // Macro targets
    const dailyTargetKcal = healthTarget?.energyKcal ?? profile?.goalKcal ?? null;
    const dailyProteinG =
      healthTarget?.proteinG ?? (dailyTargetKcal ? Math.round((dailyTargetKcal * 0.2) / 4) : null);
    const dailyCarbsG =
      healthTarget?.carbsG ?? (dailyTargetKcal ? Math.round((dailyTargetKcal * 0.5) / 4) : null);
    const dailyFatG =
      healthTarget?.fatG ?? (dailyTargetKcal ? Math.round((dailyTargetKcal * 0.3) / 9) : null);

    const mult = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? daysInMonth : 365;
    const periodTargetKcal = dailyTargetKcal ? dailyTargetKcal * mult : null;
    const periodProteinG = dailyProteinG ? dailyProteinG * mult : null;
    const periodCarbsG = dailyCarbsG ? dailyCarbsG * mult : null;
    const periodFatG = dailyFatG ? dailyFatG * mult : null;

    // Series (with consumedKcal: number | null)
    let series: Array<{
      key: string;
      label: string;
      subLabel?: string;
      date?: string;
      consumedKcal: number | null;
      mealCount: number;
    }> = [];

    if (period === 'day') {
      const slots = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
      const slotLabels: Record<string, string> = {
        BREAKFAST: 'Bữa sáng',
        LUNCH: 'Bữa trưa',
        DINNER: 'Bữa tối',
        SNACK: 'Bữa phụ',
      };
      series = slots.map((s) => {
        const slotMeals = mealLogs.filter((m) => m.mealSlot === s);
        const hasMeal = slotMeals.length > 0;
        const sum = slotMeals.reduce((acc, m) => acc + (m.totalKcal || 0), 0);
        return {
          key: s,
          label: slotLabels[s] || s,
          consumedKcal: hasMeal ? sum : null,
          kcal: sum,
          mealCount: slotMeals.length,
        };
      });
    } else if (period === 'week') {
      const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
      series = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.UTC(startYear, startMonth - 1, startDay + i));
        const dStr = d.toISOString().slice(0, 10);
        const dayMeals = mealLogs.filter((m) => m.localDate.toISOString().slice(0, 10) === dStr);
        const hasMeal = dayMeals.length > 0;
        const sum = dayMeals.reduce((acc, m) => acc + (m.totalKcal || 0), 0);
        return {
          key: dStr,
          label: dayNames[i],
          subLabel: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
          date: dStr,
          consumedKcal: hasMeal ? sum : null,
          kcal: sum,
          mealCount: dayMeals.length,
        };
      });
    } else if (period === 'month') {
      series = Array.from({ length: daysInMonth }, (_, i) => {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const dayMeals = mealLogs.filter((m) => m.localDate.toISOString().slice(0, 10) === dStr);
        const hasMeal = dayMeals.length > 0;
        const sum = dayMeals.reduce((acc, m) => acc + (m.totalKcal || 0), 0);
        return {
          key: dStr,
          label: `${i + 1}`,
          date: dStr,
          consumedKcal: hasMeal ? sum : null,
          kcal: sum,
          mealCount: dayMeals.length,
        };
      });
    } else if (period === 'year') {
      series = Array.from({ length: 12 }, (_, i) => {
        const mKey = `${year}-${String(i + 1).padStart(2, '0')}`;
        const monthMeals = mealLogs.filter((m) => m.localDate.toISOString().slice(0, 7) === mKey);
        const hasMeal = monthMeals.length > 0;
        const sum = monthMeals.reduce((acc, m) => acc + (m.totalKcal || 0), 0);
        return {
          key: mKey,
          label: `T${i + 1}`,
          consumedKcal: hasMeal ? sum : null,
          kcal: sum,
          mealCount: monthMeals.length,
        };
      });
    }

    // Weekly series for Month view
    const weeklySeries: Array<{
      key: string;
      label: string;
      subLabel: string;
      consumedKcal: number | null;
      mealCount: number;
    }> = [];

    if (period === 'month') {
      const weekRanges = [
        { label: 'Tuần 1', start: 1, end: 7 },
        { label: 'Tuần 2', start: 8, end: 14 },
        { label: 'Tuần 3', start: 15, end: 21 },
        { label: 'Tuần 4', start: 22, end: 28 },
        { label: 'Tuần 5', start: 29, end: daysInMonth },
      ];
      for (const wr of weekRanges) {
        if (wr.start > daysInMonth) break;
        const actualEnd = Math.min(wr.end, daysInMonth);
        const weekMeals = mealLogs.filter((m) => {
          const dNum = parseInt(m.localDate.toISOString().slice(8, 10), 10);
          return dNum >= wr.start && dNum <= actualEnd;
        });
        const hasMeal = weekMeals.length > 0;
        weeklySeries.push({
          key: `w-${wr.start}`,
          label: wr.label,
          subLabel: `${wr.start}-${actualEnd}/${month}`,
          consumedKcal: hasMeal ? weekMeals.reduce((acc, m) => acc + (m.totalKcal || 0), 0) : null,
          mealCount: weekMeals.length,
        });
      }
    }

    // dayGroups: group meals by date
    const vnWeekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const logsByDate = new Map<string, typeof formattedLogs>();
    for (const log of formattedLogs) {
      const dStr = log.localDate;
      const list = logsByDate.get(dStr) ?? [];
      list.push(log);
      logsByDate.set(dStr, list);
    }

    const dayGroups: Array<{
      localDate: string;
      label: string;
      consumedKcal: number;
      mealCount: number;
      previewMediaUrls: string[];
      meals: typeof formattedLogs;
    }> = [];

    // Sort dates descending
    const sortedDates = Array.from(logsByDate.keys()).sort((a, b) => b.localeCompare(a));
    for (const dStr of sortedDates) {
      const dMeals = logsByDate.get(dStr) || [];
      const [y, m, d] = dStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const dayName = vnWeekdays[dateObj.getUTCDay()] || '';
      const dayKcal = dMeals.reduce((acc, it) => acc + (it.totals?.kcal || 0), 0);

      // Collect up to 4 unique thumbnails
      const thumbs: string[] = [];
      for (const meal of dMeals) {
        for (const item of meal.items || []) {
          if (item.thumbnailUrl && !thumbs.includes(item.thumbnailUrl)) {
            thumbs.push(item.thumbnailUrl);
          }
          if (thumbs.length >= 4) break;
        }
        if (thumbs.length >= 4) break;
      }

      dayGroups.push({
        localDate: dStr,
        label: `${dayName}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        consumedKcal: dayKcal,
        mealCount: dMeals.length,
        previewMediaUrls: thumbs,
        meals: dMeals,
      });
    }

    // monthGroups: group by 12 months for Year view
    const monthGroups: Array<{
      monthKey: string;
      monthNumber: number;
      label: string;
      shortLabel: string;
      consumedKcal: number;
      mealCount: number;
      hasData: boolean;
      previewMediaUrls: string[];
    }> = [];

    if (period === 'year') {
      for (let i = 1; i <= 12; i++) {
        const mKey = `${year}-${String(i).padStart(2, '0')}`;
        const monthMeals = formattedLogs.filter((m) => m.localDate.slice(0, 7) === mKey);
        const mKcal = monthMeals.reduce((acc, m) => acc + (m.totals?.kcal || 0), 0);
        const thumbs: string[] = [];
        for (const meal of monthMeals) {
          for (const item of meal.items || []) {
            if (item.thumbnailUrl && !thumbs.includes(item.thumbnailUrl)) {
              thumbs.push(item.thumbnailUrl);
            }
            if (thumbs.length >= 4) break;
          }
          if (thumbs.length >= 4) break;
        }
        monthGroups.push({
          monthKey: mKey,
          monthNumber: i,
          label: `Tháng ${i}, ${year}`,
          shortLabel: `T${i}`,
          consumedKcal: mKcal,
          mealCount: monthMeals.length,
          hasData: monthMeals.length > 0,
          previewMediaUrls: thumbs,
        });
      }
    }

    // Insights calculation
    let highestDay: { date: string; label: string; kcal: number; mealCount: number } | null = null;
    for (const dg of dayGroups) {
      if (!highestDay || dg.consumedKcal > highestDay.kcal) {
        highestDay = {
          date: dg.localDate,
          label: dg.label,
          kcal: dg.consumedKcal,
          mealCount: dg.mealCount,
        };
      }
    }

    let highestMonth: { monthKey: string; label: string; kcal: number; mealCount: number } | null = null;
    if (period === 'year') {
      for (const mg of monthGroups) {
        if (mg.hasData && (!highestMonth || mg.mealCount > highestMonth.mealCount)) {
          highestMonth = {
            monthKey: mg.monthKey,
            label: mg.label,
            kcal: mg.consumedKcal,
            mealCount: mg.mealCount,
          };
        }
      }
    }

    const avgKcalPerActiveDay = activeDays > 0 ? Math.round(totalKcal / activeDays) : 0;
    const avgKcalPerCalendarDay = Math.round(totalKcal / totalDaysInPeriod);
    const coveragePercent = Math.round((activeDays / totalDaysInPeriod) * 100);

    let summaryInsight = '';
    if (period === 'week') {
      summaryInsight = highestDay
        ? `${highestDay.label} là ngày nạp nhiều năng lượng nhất với ${highestDay.kcal.toLocaleString('vi-VN')} kcal.`
        : 'Chưa có bữa ăn nào được ghi lại trong tuần này.';
    } else if (period === 'month') {
      summaryInsight = `Bạn đã ghi ${activeDays}/${daysInMonth} ngày (${coveragePercent}%) · Trung bình ${avgKcalPerActiveDay.toLocaleString('vi-VN')} kcal/ngày có ghi`;
    } else if (period === 'year') {
      summaryInsight = highestMonth
        ? `${highestMonth.label} là tháng hoạt động tích cực nhất với ${highestMonth.mealCount} bữa ăn.`
        : 'Chưa có dữ liệu bữa ăn trong năm nay.';
    }

    return {
      period,
      date: refDateStr,
      startDate: startDateStr,
      endDate: endDateStr,
      label,
      totals: {
        kcal: totalKcal,
        proteinG: Math.round(totalProteinG * 10) / 10,
        carbsG: Math.round(totalCarbsG * 10) / 10,
        fatG: Math.round(totalFatG * 10) / 10,
      },
      targets: {
        dailyKcalTarget: dailyTargetKcal,
        periodKcalTarget: periodTargetKcal,
        dailyProteinG,
        periodProteinG,
        dailyCarbsG,
        periodCarbsG,
        dailyFatG,
        periodFatG,
      },
      avgKcalPerDay: avgKcalPerCalendarDay,
      avgKcalPerActiveDay,
      daysLogged: activeDays,
      totalDays: totalDaysInPeriod,
      coveragePercent,
      totalMeals: mealLogs.length,
      series,
      breakdown: series,
      weeklySeries,
      dayGroups,
      monthGroups,
      insights: {
        highestDay,
        highestMonth,
        summary: summaryInsight,
      },
      items: formattedLogs,
    };
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<CreateMealLogDto> & { items?: CreateMealLogDto['items'] },
    ifMatch?: string,
  ) {
    if (!ifMatch) {
      throw new PreconditionFailedException({
        error: { code: 'PRECONDITION_REQUIRED', message: 'Thiếu header If-Match.' },
      });
    }
    const expectedVersion = parseInt(ifMatch.replace(/"/g, '').trim(), 10);

    const existing = await this.prisma.db.diaryMealLog.findFirst({
      where: { id, userId, deletedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: { code: 'MEAL_LOG_NOT_FOUND' } });
    }
    if (isNaN(expectedVersion) || existing.version !== expectedVersion) {
      throw new ConflictException({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Meal log đã được cập nhật ở nơi khác.',
          details: { expectedVersion: existing.version },
        },
      });
    }

    const resolvedItems = dto.items
      ? await this.resolveItems(dto.items)
      : null;

    const totals = resolvedItems
      ? resolvedItems.reduce(
          (acc, it) => {
            acc.kcal += Number(it.caloriesSnapshot ?? 0) * Number(it.quantity);
            acc.protein += Number(it.proteinGSnapshot ?? 0) * Number(it.quantity);
            acc.carbs += Number(it.carbsGSnapshot ?? 0) * Number(it.quantity);
            acc.fat += Number(it.fatGSnapshot ?? 0) * Number(it.quantity);
            return acc;
          },
          { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        )
      : null;

    const updated = await this.prisma.db.$transaction(async (tx) => {
      if (resolvedItems) {
        await tx.diaryMealLogItem.deleteMany({ where: { mealLogId: id } });
        await tx.diaryMealLogItem.createMany({
          data: resolvedItems.map((it, idx) => ({
            mealLogId: id,
            ...it,
            sortOrder: idx,
          })),
        });
      }

      return tx.diaryMealLog.update({
        where: { id },
        data: {
          ...(dto.mealSlot ? { mealSlot: dto.mealSlot } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(dto.occurredAt ? { occurredAt: new Date(dto.occurredAt) } : {}),
          ...(totals
            ? {
                totalKcal: Math.round(totals.kcal),
                totalProteinG: totals.protein,
                totalCarbsG: totals.carbs,
                totalFatG: totals.fat,
                nutritionCoverage: resolvedItems!.every((i) => i.caloriesSnapshot != null)
                  ? 1
                  : 0.5,
              }
            : {}),
          version: { increment: 1 },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return this.format(updated);
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

  /** Idempotent create from random selection */
  async createFromRandomization(params: {
    userId: string;
    randomizationId: string;
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
      where: { randomizationId: params.randomizationId, deletedAt: null },
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
        sourceType: DiaryMealSourceType.RANDOM,
        randomizationId: params.randomizationId,
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
      randomizationId: log.randomizationId,
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
