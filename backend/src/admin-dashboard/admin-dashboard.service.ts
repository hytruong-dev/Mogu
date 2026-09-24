import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_IMPORT_STATUSES: ImportJobStatus[] = [
  'PENDING',
  'SEARCHING',
  'EXTRACTING',
  'NORMALIZING',
  'RECONCILING',
  'ENRICHING',
];

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class AdminDashboardService {
  private readonly supabaseUrl: string;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
  }

  private getCached<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return hit.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): T {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  private buildPublicUrl(storageKey?: string | null, bucket?: string | null): string | null {
    if (!storageKey || !bucket) return null;
    return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${storageKey}`;
  }

  private rangeBounds(range: '7d' | '30d') {
    const days = range === '30d' ? 30 : 7;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const prevFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
    return { days, from, to, prevFrom, prevTo: from };
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  async getSummary(range: '7d' | '30d' = '7d') {
    const cacheKey = `summary:${range}`;
    const cached = this.getCached<Awaited<ReturnType<AdminDashboardService['buildSummary']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildSummary(range);
    return this.setCache(cacheKey, result);
  }

  private async buildSummary(range: '7d' | '30d') {
    const { days, from, to, prevFrom, prevTo } = this.rangeBounds(range);

    const [
      statusGroups,
      publishedThisWeek,
      publishedLastWeek,
      activeJobs,
      failedJobsLast,
      doneJobsLast,
      openReports,
      activePosts,
      lowConfidenceRows,
      unlinkedCount,
      plansInRange,
      plansPreviousRange,
      plansFailed,
      plansTotal,
      logsInRange,
      logsPreviousRange,
      logsTotal,
    ] = await Promise.all([
      this.prisma.db.dish.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.db.dish.count({
        where: { deletedAt: null, status: 'PUBLISHED', publishedAt: { gte: from, lte: to } },
      }),
      this.prisma.db.dish.count({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          publishedAt: { gte: prevFrom, lt: prevTo },
        },
      }),
      this.prisma.db.importJob.count({
        where: { status: { in: ACTIVE_IMPORT_STATUSES } },
      }),
      this.prisma.db.importJob.count({
        where: { status: 'FAILED', createdAt: { gte: from } },
      }),
      this.prisma.db.importJob.count({
        where: { status: 'DONE', createdAt: { gte: from } },
      }),
      this.prisma.db.moderationReport.count({
        where: { status: { in: ['OPEN', 'REVIEWING'] } },
      }),
      this.prisma.db.communityPost.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT d.id
          FROM dishes d
          JOIN dish_sources s ON s.dish_id = d.id
          WHERE d.deleted_at IS NULL
            AND d.status IN ('PUBLISHED', 'PENDING_REVIEW')
          GROUP BY d.id
          HAVING AVG(s.reliability) < 70
        ) t
      `,
      this.prisma.db.dishIngredient.count({
        where: { ingredientId: null },
      }),
      this.prisma.db.weeklyPlan.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.db.weeklyPlan.count({
        where: { createdAt: { gte: prevFrom, lt: prevTo } },
      }),
      this.prisma.db.weeklyPlan.count({
        where: { status: 'FAILED', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.db.weeklyPlan.count(),
      this.prisma.db.mealLog.count({
        where: { loggedAt: { gte: from, lte: to } },
      }),
      this.prisma.db.mealLog.count({
        where: { loggedAt: { gte: prevFrom, lt: prevTo } },
      }),
      this.prisma.db.mealLog.count(),
    ]);

    const countBy = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    ) as Record<string, number>;

    const total =
      statusGroups.reduce((sum, g) => sum + g._count._all, 0);
    const published = countBy['PUBLISHED'] ?? 0;
    const pendingReview = countBy['PENDING_REVIEW'] ?? 0;
    const failed = countBy['FAILED'] ?? 0;
    const draft = countBy['DRAFT'] ?? 0;
    const lowConfidence = Number(lowConfidenceRows[0]?.count ?? 0);

    const publishedGrowthPercent =
      publishedLastWeek === 0
        ? null
        : Math.round(((publishedThisWeek - publishedLastWeek) / publishedLastWeek) * 1000) / 10;

    const plansGrowthPercent =
      plansPreviousRange === 0
        ? null
        : Math.round(((plansInRange - plansPreviousRange) / plansPreviousRange) * 1000) / 10;

    const failureRatePercent =
      plansInRange === 0
        ? 0
        : Math.round((plansFailed / plansInRange) * 1000) / 10;

    const avgLogsPerDay = Math.round((logsInRange / days) * 10) / 10;

    const logsGrowthPercent =
      logsPreviousRange === 0
        ? null
        : Math.round(((logsInRange - logsPreviousRange) / logsPreviousRange) * 1000) / 10;

    const tasks = [
      {
        key: 'PENDING_REVIEW',
        count: pendingReview,
        route: '/review',
        priority: 'high' as const,
      },
      {
        key: 'LOW_CONFIDENCE',
        count: lowConfidence,
        route: '/foods?filter=low-confidence',
        priority: 'medium' as const,
      },
      {
        key: 'OPEN_REPORTS',
        count: openReports,
        route: '/community',
        priority: 'high' as const,
      },
      {
        key: 'UNLINKED_INGREDIENTS',
        count: unlinkedCount,
        route: '/food-data',
        priority: 'low' as const,
      },
      {
        key: 'FAILED_JOBS',
        count: failedJobsLast,
        route: '/ingest',
        priority: 'medium' as const,
      },
    ];

    const insight =
      pendingReview > 0
        ? {
            code: 'REVIEW_BACKLOG',
            message: `Có ${pendingReview} món ăn đang chờ kiểm duyệt. Ưu tiên xử lý các món có độ tin cậy cao để sớm làm phong phú feed khám phá trên app người dùng.`,
            ctaRoute: '/review',
          }
        : openReports > 0
          ? {
              code: 'OPEN_REPORTS',
              message: `Có ${openReports} báo cáo vi phạm đang mở. Kiểm tra hàng đợi cộng đồng để giữ môi trường an toàn.`,
              ctaRoute: '/community',
            }
          : {
              code: 'ALL_CLEAR',
              message:
                'Hiện không có món nào đang chờ kiểm duyệt. Có thể tập trung nhập món mới hoặc biên tập bài viết khám phá.',
              ctaRoute: '/foods/new',
            };

    return {
      generatedAt: new Date().toISOString(),
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      kpi: {
        dishes: {
          total,
          published,
          draft,
          pendingReview,
          failed,
          publishedThisWeek,
          publishedLastWeek,
          publishedGrowthPercent,
        },
        importJobs: {
          active: activeJobs,
          failedLast7d: failedJobsLast,
          doneLast7d: doneJobsLast,
        },
        moderation: {
          openReports,
          activePosts,
          pendingComments: 0,
        },
        weeklyPlans: {
          total: plansTotal,
          inRange: plansInRange,
          previousRange: plansPreviousRange,
          growthPercent: plansGrowthPercent,
          failed: plansFailed,
          failureRatePercent,
        },
        mealLogs: {
          total: logsTotal,
          inRange: logsInRange,
          previousRange: logsPreviousRange,
          avgPerDay: avgLogsPerDay,
          growthPercent: logsGrowthPercent,
        },
      },
      tasks,
      insight,
    };
  }

  // ── Growth ───────────────────────────────────────────────────────────────

  async getGrowth(days = 7) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const cacheKey = `growth:${safeDays}`;
    const cached = this.getCached<{ days: number; series: unknown[] }>(cacheKey);
    if (cached) return cached;

    const to = new Date();
    const from = new Date(to.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    const rows = await this.prisma.db.$queryRaw<
      { date: Date; new_dishes: bigint; published_dishes: bigint }[]
    >`
      SELECT d.day::date AS date,
             COUNT(ds.id) FILTER (WHERE ds.created_at::date = d.day)   AS new_dishes,
             COUNT(ds.id) FILTER (WHERE ds.published_at::date = d.day) AS published_dishes
      FROM generate_series(${fromDate}::date, ${toDate}::date, interval '1 day') AS d(day)
      LEFT JOIN dishes ds
        ON ds.deleted_at IS NULL
       AND (ds.created_at::date = d.day OR ds.published_at::date = d.day)
      GROUP BY d.day
      ORDER BY d.day
    `;

    const result = {
      days: safeDays,
      series: rows.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        newDishes: Number(r.new_dishes),
        publishedDishes: Number(r.published_dishes),
      })),
    };
    return this.setCache(cacheKey, result);
  }

  // ── Trending ─────────────────────────────────────────────────────────────

  async getTrendingDishes(window: '24h' | '7d' = '7d', limit = 5) {
    const take = Math.min(Math.max(limit, 1), 20);
    const cacheKey = `trending:${window}:${take}`;
    const cached = this.getCached<unknown>(cacheKey);
    if (cached) return cached;

    const hours = window === '24h' ? 24 : 7 * 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    let ranked: {
      dish_id: string;
      clicks: bigint;
      saves: bigint;
      impressions: bigint;
      views: bigint;
    }[] = [];

    try {
      ranked = await this.prisma.db.$queryRaw`
        WITH all_events AS (
          SELECT rl.dish_id, rl.event
          FROM recommendation_logs rl
          WHERE rl.created_at >= ${since} AND rl.dish_id IS NOT NULL

          UNION ALL

          SELECT eee.content_id AS dish_id,
                 CASE 
                   WHEN eee.event_type IN ('OPEN_DETAIL', 'VIEW') THEN 'view'
                   WHEN eee.event_type IN ('CLICK') THEN 'click'
                   WHEN eee.event_type IN ('SAVE') THEN 'save'
                   ELSE 'impression'
                 END AS event
          FROM explore_engagement_events eee
          WHERE eee.created_at >= ${since}
            AND UPPER(eee.content_type) = 'DISH'
            AND eee.content_id IS NOT NULL
        )
        SELECT e.dish_id,
               COUNT(*) FILTER (WHERE e.event = 'click')      AS clicks,
               COUNT(*) FILTER (WHERE e.event = 'save')       AS saves,
               COUNT(*) FILTER (WHERE e.event = 'impression') AS impressions,
               COUNT(*) FILTER (WHERE e.event = 'view')       AS views
        FROM all_events e
        GROUP BY e.dish_id
        ORDER BY (COUNT(*) FILTER (WHERE e.event = 'click')) * 2
               + (COUNT(*) FILTER (WHERE e.event = 'save')) * 5
               + (COUNT(*) FILTER (WHERE e.event = 'view')) * 3
               + (COUNT(*) FILTER (WHERE e.event = 'impression')) * 0.1 DESC
        LIMIT ${take}
      `;
    } catch {
      ranked = await this.prisma.db.$queryRaw<{
        dish_id: string;
        clicks: bigint;
        saves: bigint;
        impressions: bigint;
        views: bigint;
      }[]>`
        SELECT rl.dish_id,
               COUNT(*) FILTER (WHERE rl.event = 'click')      AS clicks,
               COUNT(*) FILTER (WHERE rl.event = 'save')       AS saves,
               COUNT(*) FILTER (WHERE rl.event = 'impression') AS impressions,
               COUNT(*) FILTER (WHERE rl.event = 'view')       AS views
        FROM recommendation_logs rl
        WHERE rl.created_at >= ${since}
          AND rl.dish_id IS NOT NULL
        GROUP BY rl.dish_id
        ORDER BY (COUNT(*) FILTER (WHERE rl.event = 'click')) * 2
               + (COUNT(*) FILTER (WHERE rl.event = 'save')) * 5
               + (COUNT(*) FILTER (WHERE rl.event = 'view')) * 3
               + (COUNT(*) FILTER (WHERE rl.event = 'impression')) * 0.1 DESC
        LIMIT ${take}
      `.catch(() => []);
    }

    const rankedMap = new Map(ranked.map((r) => [r.dish_id, r]));
    const rankedIds = ranked.map((r) => r.dish_id);

    // If ranked dishes count is less than requested limit, supplement with top fallback dishes
    let finalIds = [...rankedIds];
    const needed = take - finalIds.length;
    let fallbackIds: string[] = [];

    if (needed > 0) {
      fallbackIds = await this.getFallbackDishIds(needed, new Set(finalIds));
      finalIds = [...finalIds, ...fallbackIds];
    }

    if (finalIds.length === 0) {
      return this.setCache(cacheKey, { window, items: [], fallback: true }, 15_000);
    }

    const dishes = await this.hydrateDishes(finalIds);
    const dishById = new Map(dishes.map((d) => [d.id, d]));

    // Fetch view/click metrics for fallback dishes
    const extraMetrics = fallbackIds.length > 0
      ? await this.getMetricsForDishes(fallbackIds, since)
      : new Map<string, { views: number; saves: number; clicks: number }>();

    // Also get save counts from savedDish table
    const saveCounts = await this.getSaveCounts(finalIds);

    const items = finalIds
      .map((id, i) => {
        const dish = dishById.get(id);
        if (!dish) return null;

        const rankEntry = rankedMap.get(id);
        let views = 0;
        let saves = saveCounts.get(id) ?? 0;
        let clicks = 0;

        if (rankEntry) {
          views = Number(rankEntry.views);
          saves = Math.max(saves, Number(rankEntry.saves));
          clicks = Number(rankEntry.clicks);
        } else {
          const fm = extraMetrics.get(id);
          if (fm) {
            views = fm.views;
            saves = Math.max(saves, fm.saves);
            clicks = fm.clicks;
          }
        }

        const trendScore = clicks * 2 + saves * 5 + views * 3;

        return {
          dishId: dish.id,
          name: dish.name,
          slug: dish.slug,
          imageUrl: dish.imageUrl,
          categoryName: dish.categoryName,
          metrics: {
            views,
            saves,
            clicks,
            ratingAvg: dish.ratingAvg,
          },
          trendScore: Math.round(trendScore * 10) / 10,
          rank: i + 1,
        };
      })
      .filter(Boolean) as Array<{
        dishId: string;
        name: string;
        slug: string;
        imageUrl: string | null;
        categoryName: string | null;
        metrics: { views: number; saves: number; clicks: number; ratingAvg: number };
        trendScore: number;
        rank: number;
      }>;

    const fallback = ranked.length === 0;
    const result = { window, items, fallback };
    return this.setCache(cacheKey, result, 15_000);
  }

  private async hydrateDishes(ids: string[]) {
    if (ids.length === 0) return [];
    const dishes = await this.prisma.db.dish.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        ratingAvg: true,
        media: {
          where: { isPrimary: true },
          select: { storageKey: true, bucket: true },
          take: 1,
        },
        categories: {
          include: { category: { select: { name: true } } },
          take: 1,
        },
      },
    });

    return dishes.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      ratingAvg: Number(d.ratingAvg ?? 0),
      imageUrl: this.buildPublicUrl(d.media[0]?.storageKey, d.media[0]?.bucket),
      categoryName: d.categories[0]?.category?.name ?? null,
    }));
  }

  private async getFallbackDishIds(limit: number, excludeIds: Set<string>): Promise<string[]> {
    if (limit <= 0) return [];

    const saved = await this.prisma.db.savedDish.groupBy({
      by: ['dishId'],
      _count: { _all: true },
      where: excludeIds.size > 0 ? { dishId: { notIn: Array.from(excludeIds) } } : undefined,
      orderBy: { _count: { dishId: 'desc' } },
      take: limit,
    }).catch(async () => {
      const all = await this.prisma.db.savedDish.groupBy({
        by: ['dishId'],
        _count: { _all: true },
        where: excludeIds.size > 0 ? { dishId: { notIn: Array.from(excludeIds) } } : undefined,
      });
      return all.sort((a, b) => b._count._all - a._count._all).slice(0, limit);
    });

    let ids = saved.map((s) => s.dishId);
    ids.forEach((id) => excludeIds.add(id));

    if (ids.length < limit) {
      const topRated = await this.prisma.db.dish.findMany({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          ...(excludeIds.size ? { id: { notIn: Array.from(excludeIds) } } : {}),
        },
        orderBy: [{ ratingCount: 'desc' }, { ratingAvg: 'desc' }],
        take: limit - ids.length,
        select: { id: true },
      });
      ids = [...ids, ...topRated.map((d) => d.id)];
      topRated.forEach((d) => excludeIds.add(d.id));
    }

    if (ids.length < limit) {
      const recent = await this.prisma.db.dish.findMany({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          ...(excludeIds.size ? { id: { notIn: Array.from(excludeIds) } } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: limit - ids.length,
        select: { id: true },
      });
      ids = [...ids, ...recent.map((d) => d.id)];
    }

    return ids;
  }

  private async getSaveCounts(dishIds: string[]): Promise<Map<string, number>> {
    if (dishIds.length === 0) return new Map();
    const rows = await this.prisma.db.savedDish.groupBy({
      by: ['dishId'],
      _count: { _all: true },
      where: { dishId: { in: dishIds } },
    }).catch(() => []);
    return new Map(rows.map((r) => [r.dishId, r._count._all]));
  }

  private async getMetricsForDishes(
    dishIds: string[],
    since: Date,
  ): Promise<Map<string, { views: number; saves: number; clicks: number }>> {
    if (dishIds.length === 0) return new Map();
    try {
      const rows = await this.prisma.db.$queryRaw<{
        dish_id: string;
        views: bigint;
        clicks: bigint;
        saves: bigint;
      }[]>`
        WITH all_events AS (
          SELECT rl.dish_id, rl.event
          FROM recommendation_logs rl
          WHERE rl.created_at >= ${since}
            AND rl.dish_id = ANY(${dishIds}::uuid[])

          UNION ALL

          SELECT eee.content_id AS dish_id,
                 CASE 
                   WHEN eee.event_type IN ('OPEN_DETAIL', 'VIEW') THEN 'view'
                   WHEN eee.event_type IN ('CLICK') THEN 'click'
                   WHEN eee.event_type IN ('SAVE') THEN 'save'
                   ELSE 'impression'
                 END AS event
          FROM explore_engagement_events eee
          WHERE eee.created_at >= ${since}
            AND UPPER(eee.content_type) = 'DISH'
            AND eee.content_id = ANY(${dishIds}::uuid[])
        )
        SELECT dish_id,
               COUNT(*) FILTER (WHERE event = 'view') AS views,
               COUNT(*) FILTER (WHERE event = 'click') AS clicks,
               COUNT(*) FILTER (WHERE event = 'save') AS saves
        FROM all_events
        GROUP BY dish_id
      `;
      return new Map(
        rows.map((r) => [
          r.dish_id,
          {
            views: Number(r.views),
            clicks: Number(r.clicks),
            saves: Number(r.saves),
          },
        ]),
      );
    } catch {
      try {
        const rows = await this.prisma.db.$queryRaw<{
          dish_id: string;
          views: bigint;
          clicks: bigint;
          saves: bigint;
        }[]>`
          SELECT rl.dish_id,
                 COUNT(*) FILTER (WHERE rl.event = 'view') AS views,
                 COUNT(*) FILTER (WHERE rl.event = 'click') AS clicks,
                 COUNT(*) FILTER (WHERE rl.event = 'save') AS saves
          FROM recommendation_logs rl
          WHERE rl.created_at >= ${since}
            AND rl.dish_id = ANY(${dishIds}::uuid[])
          GROUP BY rl.dish_id
        `;
        return new Map(
          rows.map((r) => [
            r.dish_id,
            {
              views: Number(r.views),
              clicks: Number(r.clicks),
              saves: Number(r.saves),
            },
          ]),
        );
      } catch {
        return new Map();
      }
    }
  }

  // ── Activities ───────────────────────────────────────────────────────────

  async getActivities(opts: { limit?: number; types?: string; cursor?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const typeFilter = opts.types
      ? opts.types.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
      : null;
    const cursorDate = opts.cursor ? new Date(opts.cursor) : null;

    const take = limit;
    const [jobs, audits, reports, adminActions] = await Promise.all([
      !typeFilter || typeFilter.includes('IMPORT_JOB')
        ? this.prisma.db.importJob.findMany({
            orderBy: { updatedAt: 'desc' },
            take,
            ...(cursorDate ? { where: { updatedAt: { lt: cursorDate } } } : {}),
          })
        : Promise.resolve([]),
      !typeFilter || typeFilter.includes('DISH_REVIEW')
        ? this.prisma.db.dishEditorAuditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take,
            where: {
              ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
              action: {
                in: [
                  'DISH_SUBMITTED_REVIEW',
                  'DISH_APPROVED',
                  'DISH_REJECTED',
                  'DISH_CHANGES_REQUESTED',
                  'DISH_DRAFT_CREATED',
                  'DISH_SECTION_UPDATED',
                ],
              },
            },
          })
        : Promise.resolve([]),
      !typeFilter || typeFilter.includes('MODERATION')
        ? this.prisma.db.moderationReport.findMany({
            where: {
              status: { notIn: ['OPEN', 'REVIEWING'] },
              ...(cursorDate ? { updatedAt: { lt: cursorDate } } : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
      !typeFilter || typeFilter.includes('ADMIN_ACTION')
        ? this.prisma.db.adminActionAudit.findMany({
            where: {
              ...(cursorDate ? { occurredAt: { lt: cursorDate } } : {}),
            },
            orderBy: { occurredAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
    ]);

    const dishIds = [
      ...new Set(
        audits.map((a) => a.dishId).filter((id): id is string => !!id),
      ),
    ];
    const dishNames = dishIds.length
      ? await this.prisma.db.dish.findMany({
          where: { id: { in: dishIds } },
          select: { id: true, name: true },
        })
      : [];
    const dishNameById = new Map(dishNames.map((d) => [d.id, d.name]));

    const actorIds = [
      ...new Set([
        ...audits.map((a) => a.actorId),
        ...adminActions.map((a) => a.actorUserId),
      ]),
    ];
    const profiles = actorIds.length
      ? await this.prisma.db.profile.findMany({
          where: { userId: { in: actorIds } },
          select: { userId: true, displayName: true },
        })
      : [];
    const nameByUser = new Map(
      profiles.map((p) => [p.userId, p.displayName ?? 'Admin']),
    );

    type ActivityItem = {
      id: string;
      type: string;
      status: string;
      title: string;
      description: string;
      actor: { id: string; displayName: string };
      route: string;
      occurredAt: string;
    };

    const items: ActivityItem[] = [];

    for (const job of jobs) {
      const isDone = job.status === 'DONE';
      const isFail = job.status === 'FAILED';
      items.push({
        id: `importjob:${job.id}`,
        type: 'IMPORT_JOB',
        status: isDone ? 'DONE' : isFail ? 'FAILED' : 'IN_PROGRESS',
        title: `"${job.query}" — ${job.status}`,
        description: `${job.progress}% • ${(job.sourceTypes ?? []).slice(0, 2).join(', ') || 'AI'}`,
        actor: { id: job.requestedBy ?? 'system', displayName: 'Hệ thống' },
        route: '/ingest',
        occurredAt: (job.updatedAt ?? job.createdAt).toISOString(),
      });
    }

    for (const log of audits) {
      const dishName = log.dishId ? dishNameById.get(log.dishId) ?? 'món' : 'món';
      const statusMap: Record<string, string> = {
        DISH_APPROVED: 'DONE',
        DISH_REJECTED: 'FAILED',
        DISH_CHANGES_REQUESTED: 'INFO',
        DISH_SUBMITTED_REVIEW: 'IN_PROGRESS',
      };
      items.push({
        id: `dishreview:${log.id}`,
        type: 'DISH_REVIEW',
        status: statusMap[log.action] ?? 'INFO',
        title: `${log.action.replace(/_/g, ' ')} — "${dishName}"`,
        description: [log.fromStatus, log.toStatus].filter(Boolean).join(' → ') || log.action,
        actor: {
          id: log.actorId,
          displayName: nameByUser.get(log.actorId) ?? 'Reviewer',
        },
        route: '/review',
        occurredAt: log.createdAt.toISOString(),
      });
    }

    for (const report of reports) {
      items.push({
        id: `moderation:${report.id}`,
        type: 'MODERATION',
        status: report.status === 'RESOLVED' ? 'DONE' : 'INFO',
        title: `Báo cáo ${report.targetType} — ${report.status}`,
        description: report.reasonCode ?? 'Đã xử lý',
        actor: {
          id: 'system',
          displayName: 'Hệ thống',
        },
        route: '/community',
        occurredAt: (report.updatedAt ?? report.createdAt).toISOString(),
      });
    }

    for (const action of adminActions) {
      items.push({
        id: `admin:${action.id}`,
        type: 'ADMIN_ACTION',
        status: action.result === 'SUCCESS' ? 'DONE' : 'FAILED',
        title: `${action.action} — ${action.targetType}`,
        description: action.reasonCode ?? action.result,
        actor: {
          id: action.actorUserId,
          displayName: nameByUser.get(action.actorUserId) ?? 'Admin',
        },
        route: action.targetType === 'USER' ? '/users' : '/community',
        occurredAt: action.occurredAt.toISOString(),
      });
    }

    items.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    const slice = items.slice(0, limit);
    const hasNextPage = items.length > limit;
    const nextCursor = hasNextPage ? slice[slice.length - 1]?.occurredAt : null;

    return {
      items: slice,
      pageInfo: { nextCursor, hasNextPage },
    };
  }
}
