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
  ) { }

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
        preferHomeCook: true,
        allowOutsideMeals: true,
        repeatWindowDays: 7,
        preferNewDishes: true,
        keepLockedMeals: true,
        preserveLoggedDays: true,
      },
    });
  }

  // ── Plans ──────────────────────────────────────────────────────────────────

  async generate(userId: string, dto: GenerateWeeklyPlanDto) {
    const config = await this.requireConfig(userId);

    // Dọn dẹp/lưu trữ các bản nháp (READY/GENERATING) cũ của user trước khi sinh kế hoạch mới
    await this.prisma.db.weeklyPlan.updateMany({
      where: { userId, status: WeeklyPlanStatus.READY },
      data: { status: WeeklyPlanStatus.ARCHIVED, archivedAt: new Date() },
    });

    const durationDays = dto.durationDays ?? config.durationDays;
    const budgetVnd = dto.budget ?? config.budgetVnd;
    const kcalPerDay = dto.dailyCalories ?? config.kcalPerDay;
    const kcalMode = dto.calorieSource ?? config.kcalMode;
    const enabledSlots = dto.mealSlots?.length
      ? Array.from(new Set(dto.mealSlots))
      : (config.enabledSlots as string[]);
    const avoidRepeat =
      dto.advanced?.limitRepeats !== undefined
        ? dto.advanced.limitRepeats
        : config.avoidRepeat;
    const preferHomeCook =
      dto.advanced?.preferSelfCook !== undefined
        ? dto.advanced.preferSelfCook
        : config.preferHomeCook;

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const mealsPerDay = Array.from(new Set(enabledSlots)).length;
    const mealCount = durationDays * mealsPerDay;

    // Config snapshot (immutable for this generation run)
    const configSnapshot = {
      budgetVnd,
      kcalPerDay,
      kcalMode,
      durationDays,
      enabledSlots,
      avoidRepeat,
      preferHomeCook,
      allowOutsideMeals:
        dto.advanced?.allowOutsideMeals ?? config.allowOutsideMeals ?? true,
      repeatWindowDays:
        dto.advanced?.repeatWindowDays ?? config.repeatWindowDays ?? 7,
      preferNewDishes:
        dto.advanced?.preferNewDishes ?? config.preferNewDishes ?? true,
      likedDishPreference:
        dto.advanced?.likedDishPreference ??
        config.likedDishPreference ??
        'LIGHT',
      keepLockedMeals:
        dto.advanced?.keepLockedMeals ?? config.keepLockedMeals ?? true,
      preserveLoggedDays:
        dto.advanced?.preserveLoggedDays ?? config.preserveLoggedDays ?? true,
      calorieTolerancePercent: config.calorieTolerancePercent,
      mealsPerDay,
    };

    // Create plan in GENERATING state
    const plan = await this.prisma.db.weeklyPlan.create({
      data: {
        userId,
        configId: config.id,
        startDate,
        endDate,
        budgetLimitVnd: budgetVnd,
        targetKcal: kcalPerDay * durationDays,
        configSnapshot: configSnapshot as any,
        algorithmVersion: ALGORITHM_VERSION,
      },
    });

    // Minimal transactional outbox for generation tracking
    await (this.prisma.db as any).outboxEvent
      .create({
        data: {
          userId,
          eventType: 'WEEKLY_PLAN_GENERATE',
          aggregateId: plan.id,
          payload: { planId: plan.id, startDate: dto.startDate },
          status: 'PENDING',
        },
      })
      .catch((err: Error) =>
        this.logger.warn(`[WeeklyPlans] outbox create failed: ${err.message}`),
      );

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
        await (this.prisma.db as any).outboxEvent
          .updateMany({
            where: { aggregateId: plan.id, eventType: 'WEEKLY_PLAN_GENERATE' },
            data: { status: 'PROCESSED', processedAt: new Date() },
          })
          .catch(() => null);
        this.logger.log(`[WeeklyPlans] Synchronous generation completed for plan ${plan.id}`);
      } catch (err) {
        await (this.prisma.db as any).outboxEvent
          .updateMany({
            where: { aggregateId: plan.id, eventType: 'WEEKLY_PLAN_GENERATE' },
            data: {
              status: 'FAILED',
              lastError: err instanceof Error ? err.message : String(err),
              attempts: { increment: 1 },
            },
          })
          .catch(() => null);
        this.logger.error(`[WeeklyPlans] Synchronous generation failed for plan ${plan.id}`, err);
      }
    }

    return {
      status: 'CREATED' as const,
      planId: plan.id,
      startDate: dto.startDate,
      durationDays,
      mealCount,
      estimatedBudget: budgetVnd,
      generationStatus: plan.status,
    };
  }

  async getCurrent(userId: string) {
    const now = new Date();

    // 1. Tự động chuyển các kế hoạch ACTIVE đã hết hạn sang COMPLETED
    const activePlans = await this.prisma.db.weeklyPlan.findMany({
      where: { userId, status: WeeklyPlanStatus.ACTIVE },
      include: this.planInclude(),
    });

    for (const plan of activePlans) {
      if (this.isPlanExpired(plan)) {
        await this.prisma.db.weeklyPlan.update({
          where: { id: plan.id },
          data: {
            status: WeeklyPlanStatus.COMPLETED,
            completedAt: plan.completedAt ?? now,
          },
        });
      }
    }

    // 2. Tự động lưu trữ các kế hoạch READY đã quá hạn
    const readyPlans = await this.prisma.db.weeklyPlan.findMany({
      where: { userId, status: WeeklyPlanStatus.READY },
      include: this.planInclude(),
    });

    for (const plan of readyPlans) {
      if (this.isPlanExpired(plan)) {
        await this.prisma.db.weeklyPlan.update({
          where: { id: plan.id },
          data: {
            status: WeeklyPlanStatus.ARCHIVED,
            archivedAt: now,
          },
        });
      }
    }

    // 3. Lấy kế hoạch ACTIVE và READY mới nhất
    const activePlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });

    const readyPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.READY },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });

    // Nếu người dùng có kế hoạch READY được sinh ra SAU kế hoạch ACTIVE (vừa tạo kế hoạch mới)
    // -> Ưu tiên trả về readyPlan để client thấy và xem/kích hoạt thực đơn mới tạo!
    if (activePlan && readyPlan) {
      if (readyPlan.createdAt.getTime() > activePlan.createdAt.getTime()) {
        return this.formatPlan(readyPlan);
      }
      return this.formatPlan(activePlan);
    }

    if (activePlan) return this.formatPlan(activePlan);
    if (readyPlan) return this.formatPlan(readyPlan);

    // Trả GENERATING để mobile hiển thị banner "đang tạo..."
    const generatingPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.GENERATING },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (generatingPlan) {
      const diffMin = (Date.now() - generatingPlan.createdAt.getTime()) / 60000;
      if (diffMin > 30) {
        await this.prisma.db.weeklyPlan.update({
          where: { id: generatingPlan.id },
          data: { status: WeeklyPlanStatus.FAILED, generationErrorCode: 'TIMEOUT' },
        });
      } else {
        return this.formatPlan(generatingPlan);
      }
    }

    // Trả FAILED mới nhất để mobile hiển thị lỗi thay vì che giấu
    const failedPlan = await this.prisma.db.weeklyPlan.findFirst({
      where: { userId, status: WeeklyPlanStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    if (failedPlan) return this.formatPlan(failedPlan);

    return null;
  }

  private isPlanExpired(plan: { endDate: Date; slots?: { date: Date }[] }): boolean {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    const endDateStr = plan.endDate.toISOString().split('T')[0];

    // Nếu ngày hiện tại >= ngày kết thúc (endDate là 1 ngày sau ngày slot cuối)
    if (todayStr >= endDateStr) {
      return true;
    }

    // Kiểm tra thêm ngày của slot cuối cùng
    if (plan.slots && plan.slots.length > 0) {
      const lastSlotDateStr = plan.slots.reduce((max, s) => {
        const dStr = s.date.toISOString().split('T')[0];
        return dStr > max ? dStr : max;
      }, '');
      if (lastSlotDateStr && todayStr > lastSlotDateStr) {
        return true;
      }
    }

    return now.getTime() >= plan.endDate.getTime();
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

  /**
   * Gom nguyên liệu các món trong 1 ngày của plan (bỏ slot SKIPPED).
   * Gộp theo ingredientId hoặc tên chuẩn hóa; cộng dồn quantity cùng đơn vị.
   */
  async getDayIngredients(planId: string, userId: string, date: string) {
    const plan = await this.prisma.db.weeklyPlan.findUnique({
      where: { id: planId },
      select: { id: true, userId: true },
    });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException({ error: { code: WEEKLY_PLAN_ERRORS.PLAN_NOT_FOUND } });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException({
        error: { code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD' },
      });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const slots = await this.prisma.db.weeklyPlanSlot.findMany({
      where: {
        planId,
        date: { gte: dayStart, lte: dayEnd },
        status: { not: WeeklyPlanSlotStatus.SKIPPED },
      },
      select: {
        mealSlot: true,
        dishId: true,
        dishNameSnapshot: true,
      },
      orderBy: { mealSlot: 'asc' },
    });

    const dishIds = [...new Set(slots.map((s) => s.dishId).filter(Boolean))] as string[];
    if (dishIds.length === 0) {
      return { date, planId, totalCount: 0, dishes: [], items: [] };
    }

    const rows = await this.prisma.db.dishIngredient.findMany({
      where: { dishId: { in: dishIds } },
      include: {
        ingredient: {
          select: { id: true, name: true, imageUrl: true, imageKey: true, unit: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const dishNameById = new Map(
      slots.map((s) => [s.dishId, s.dishNameSnapshot] as const),
    );

    type Agg = {
      key: string;
      ingredientId: string | null;
      name: string;
      imageUrl: string | null;
      quantity: number | null;
      unit: string | null;
      isOptional: boolean;
      usedInDishes: string[];
    };

    const agg = new Map<string, Agg>();

    for (const row of rows) {
      const name =
        row.ingredient?.name?.trim() ||
        row.parsedName?.trim() ||
        row.rawText.trim() ||
        'Nguyên liệu';
      const unit = row.unit ?? row.ingredient?.unit ?? null;
      const qty = row.quantity != null ? Number(row.quantity) : null;
      const keyBase = row.ingredientId ?? this.normalizeIngredientKey(name);
      const key = `${keyBase}|${(unit ?? '').toLowerCase()}`;

      const dishName = dishNameById.get(row.dishId) ?? 'Món';
      const existing = agg.get(key);
      if (!existing) {
        agg.set(key, {
          key,
          ingredientId: row.ingredientId,
          name,
          imageUrl: this.buildIngredientImageUrl(
            row.ingredient?.imageUrl,
            row.ingredient?.imageKey,
          ),
          quantity: qty,
          unit,
          isOptional: row.isOptional,
          usedInDishes: [dishName],
        });
      } else {
        if (qty != null && existing.quantity != null) {
          existing.quantity += qty;
        } else if (qty != null && existing.quantity == null) {
          existing.quantity = qty;
        }
        existing.isOptional = existing.isOptional && row.isOptional;
        if (!existing.usedInDishes.includes(dishName)) {
          existing.usedInDishes.push(dishName);
        }
        if (!existing.imageUrl) {
          existing.imageUrl = this.buildIngredientImageUrl(
            row.ingredient?.imageUrl,
            row.ingredient?.imageKey,
          );
        }
      }
    }

    const items = Array.from(agg.values())
      .map(({ key: _k, ...rest }) => rest)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    const dishes = slots.map((s) => ({
      dishId: s.dishId,
      mealSlot: s.mealSlot,
      name: s.dishNameSnapshot,
    }));

    return {
      date,
      planId,
      totalCount: items.length,
      dishes,
      items,
    };
  }

  async getWeeklyIngredients(planId: string, userId: string) {
    const plan = await this.findPlanForUser(planId, userId);

    const slots = await this.prisma.db.weeklyPlanSlot.findMany({
      where: {
        planId,
        status: { not: WeeklyPlanSlotStatus.SKIPPED },
      },
      select: {
        id: true,
        dishId: true,
        dishNameSnapshot: true,
        date: true,
        mealSlot: true,
        priceSnapshotVnd: true,
      },
      orderBy: [{ date: 'asc' }, { mealSlot: 'asc' }],
    });

    const dishIds = [
      ...new Set(slots.map((s) => s.dishId).filter(Boolean)),
    ] as string[];

    if (dishIds.length === 0) {
      return {
        planId,
        startDate: plan.startDate,
        endDate: plan.endDate,
        totalMeals: 0,
        totalDishes: 0,
        totalIngredientsCount: 0,
        totalEstimatedCostVnd: plan.projectedCostVnd ?? 0,
        items: [],
        byCategory: [],
      };
    }

    const toIsoDate = (d: Date | string) => {
      if (typeof d === 'string') return d.slice(0, 10);
      return d.toISOString().slice(0, 10);
    };

    const dishMap = new Map<string, { name: string; dates: string[]; slots: string[] }>();
    for (const s of slots) {
      const dateIso = toIsoDate(s.date);
      const existing = dishMap.get(s.dishId);
      if (!existing) {
        dishMap.set(s.dishId, {
          name: s.dishNameSnapshot,
          dates: [dateIso],
          slots: [s.mealSlot],
        });
      } else {
        if (!existing.dates.includes(dateIso)) existing.dates.push(dateIso);
        if (!existing.slots.includes(s.mealSlot)) existing.slots.push(s.mealSlot);
      }
    }

    const dishIngredients = await this.prisma.db.dishIngredient.findMany({
      where: { dishId: { in: dishIds } },
      include: {
        ingredient: {
          select: { id: true, name: true, imageUrl: true, imageKey: true, unit: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    type AggItem = {
      key: string;
      ingredientId: string | null;
      name: string;
      category: 'MEAT_SEAFOOD' | 'VEGGIES' | 'CARBS' | 'SEASONING' | 'OTHER';
      categoryLabel: string;
      imageUrl: string | null;
      quantity: number | null;
      unit: string | null;
      isOptional: boolean;
      usedInDishes: string[];
      dishCount: number;
    };

    const agg = new Map<string, AggItem>();

    for (const row of dishIngredients) {
      const name =
        row.ingredient?.name?.trim() ||
        row.parsedName?.trim() ||
        row.rawText.trim() ||
        'Nguyên liệu';
      const unit = row.unit ?? row.ingredient?.unit ?? null;
      const qty = row.quantity != null ? Number(row.quantity) : null;
      const keyBase = row.ingredientId ?? this.normalizeIngredientKey(name);
      const key = `${keyBase}|${(unit ?? '').toLowerCase()}`;

      const dishInfo = dishMap.get(row.dishId);
      const dishName = dishInfo?.name ?? 'Món';

      const existing = agg.get(key);
      if (!existing) {
        const { category, categoryLabel } = this.categorizeIngredient(name, row.groupLabel);
        agg.set(key, {
          key,
          ingredientId: row.ingredientId,
          name,
          category,
          categoryLabel,
          imageUrl: this.buildIngredientImageUrl(
            row.ingredient?.imageUrl,
            row.ingredient?.imageKey,
          ),
          quantity: qty,
          unit,
          isOptional: row.isOptional,
          usedInDishes: [dishName],
          dishCount: 1,
        });
      } else {
        if (qty != null && existing.quantity != null) {
          existing.quantity += qty;
        } else if (qty != null && existing.quantity == null) {
          existing.quantity = qty;
        }
        existing.isOptional = existing.isOptional && row.isOptional;
        if (!existing.usedInDishes.includes(dishName)) {
          existing.usedInDishes.push(dishName);
          existing.dishCount += 1;
        }
        if (!existing.imageUrl) {
          existing.imageUrl = this.buildIngredientImageUrl(
            row.ingredient?.imageUrl,
            row.ingredient?.imageKey,
          );
        }
      }
    }

    const items = Array.from(agg.values())
      .map(({ key: _k, ...rest }) => rest)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    const categoriesOrder = [
      { key: 'MEAT_SEAFOOD' as const, label: 'Thịt & Hải sản' },
      { key: 'VEGGIES' as const, label: 'Rau củ & Trái cây' },
      { key: 'CARBS' as const, label: 'Tinh bột & Đậu' },
      { key: 'SEASONING' as const, label: 'Gia vị & Dầu ăn' },
      { key: 'OTHER' as const, label: 'Khác' },
    ];

    const byCategory = categoriesOrder
      .map((cat) => ({
        category: cat.key,
        label: cat.label,
        items: items.filter((it) => it.category === cat.key),
      }))
      .filter((group) => group.items.length > 0);

    return {
      planId,
      startDate: plan.startDate,
      endDate: plan.endDate,
      totalMeals: slots.length,
      totalDishes: dishIds.length,
      totalIngredientsCount: items.length,
      totalEstimatedCostVnd: plan.projectedCostVnd ?? 0,
      items,
      byCategory,
    };
  }

  private categorizeIngredient(name: string, groupLabel?: string | null): {
    category: 'MEAT_SEAFOOD' | 'VEGGIES' | 'CARBS' | 'SEASONING' | 'OTHER';
    categoryLabel: string;
  } {
    const lower = name.toLowerCase();
    const groupLower = (groupLabel ?? '').toLowerCase();

    // Check meat & seafood
    if (
      /(thịt|heo|lợn|bò|gà|vịt|ngan|chim|cá|tôm|cua|mực|nghêu|sò|ốc|hến|bạch tuộc|chả|xúc xích|lạp xưởng|trứng|bào ngư|hàu)/i.test(lower) ||
      /(thịt|hải sản|thủy sản)/i.test(groupLower)
    ) {
      return { category: 'MEAT_SEAFOOD', categoryLabel: 'Thịt & Hải sản' };
    }

    // Check carbs & legumes
    if (
      /(gạo|cơm|bún|mì|miến|phở|bánh mì|nui|yến mạch|đậu phụ|đậu hũ|tàu hũ|đậu xanh|đậu đen|đậu đỏ|đậu phộng|lạc|mè)/i.test(lower) ||
      /(tinh bột|ngũ cốc|đậu)/i.test(groupLower)
    ) {
      return { category: 'CARBS', categoryLabel: 'Tinh bột & Đậu' };
    }

    // Check seasonings
    if (
      /(muối|đường|nước mắm|mắm|xì dầu|nước tương|dầu ăn|dầu hào|tiêu|bột ngọt|mì chính|hạt nêm|giấm|ngũ vị hương|sa tế|tương ớt|tương cà|bột chiên|bột mì|bột năng)/i.test(lower) ||
      /(gia vị|nước chấm|dầu mỡ)/i.test(groupLower)
    ) {
      return { category: 'SEASONING', categoryLabel: 'Gia vị & Dầu ăn' };
    }

    // Check veggies, fruits & herbs
    if (
      /(rau|cải|xà lách|muống|dền|ngót|mồng tơi|cà chua|cà rốt|khoai|hành|tỏi|ớt|sả|gừng|nấm|dưa|bí|bầu|chanh|ngò|thì là|tía tô|húng|diếp cá|chuối|táo|xoài|cam|bưởi)/i.test(lower) ||
      /(rau|củ|quả|trái cây)/i.test(groupLower)
    ) {
      return { category: 'VEGGIES', categoryLabel: 'Rau củ & Trái cây' };
    }

    return { category: 'OTHER', categoryLabel: 'Khác' };
  }

  private normalizeIngredientKey(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildIngredientImageUrl(
    imageUrl: string | null | undefined,
    imageKey: string | null | undefined,
  ): string | null {
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (imageUrl) {
      if (imageUrl.startsWith('http')) return imageUrl;
      if (imageUrl.startsWith('/storage') && base) return `${base}${imageUrl}`;
      if (base) return `${base}/storage/v1/object/public/ingredients/${imageUrl}`;
    }
    if (imageKey && base) {
      return `${base}/storage/v1/object/public/ingredients/${imageKey}`;
    }
    return null;
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

    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    const planStartStr = plan.startDate.toISOString().split('T')[0];
    const targetStartDate = planStartStr < todayStr ? todayStr : planStartStr;

    const newPlan = await this.generate(userId, {
      startDate: targetStartDate,
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
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!base) return null;
    const b = bucket ?? 'dish-images';
    return `${base}/storage/v1/object/public/${b}/${storageKey}`;
  }

  /** Snapshot may be relative (`/storage/...`) if generated before SUPABASE_URL was available. */
  private resolveSlotImageUrl(
    snapshot: string | null | undefined,
    storageKey: string | null | undefined,
    bucket: string | null | undefined,
  ): string | null {
    if (snapshot) {
      if (snapshot.startsWith('http://') || snapshot.startsWith('https://')) return snapshot;
      if (snapshot.startsWith('/storage')) {
        const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
        return base ? `${base}${snapshot}` : null;
      }
      // Treat bare storage key as storageKey
      return this.buildImageUrl(snapshot, bucket);
    }
    return this.buildImageUrl(storageKey, bucket);
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
          imageUrl: this.resolveSlotImageUrl(
            s.imageUrlSnapshot,
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
      generationErrorData: plan.generationErrorData ?? null,
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
      errorData: plan.generationErrorData ?? null,
    };
  }
}
