import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AccountStatus, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto, DirectPasswordResetDto } from './dto/create-admin-user.dto';

@Injectable()
export class AdminUsersService {
  private readonly supabase?: SupabaseClient;
  private readonly INTERNAL_DOMAIN = 'user.mogu.internal';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {
    const url =
      this.config?.get<string>('app.supabase.url') ??
      this.config?.get<string>('SUPABASE_URL') ??
      process.env.SUPABASE_URL;
    const key =
      this.config?.get<string>('app.supabase.secretKey') ??
      this.config?.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  private maskEmail(username: string, email?: string | null) {
    if (email && email.includes('@')) {
      return { email, emailMasked: false };
    }
    return { email: `${username}@masked`, emailMasked: true };
  }

  private async getAuthUsers(
    userIds: string[],
  ): Promise<Map<string, { email: string | null; lastSignInAt: Date | null }>> {
    const map = new Map<string, { email: string | null; lastSignInAt: Date | null }>();
    if (!userIds.length || typeof this.prisma.db.$queryRawUnsafe !== 'function') {
      return map;
    }
    try {
      const rows = await this.prisma.db.$queryRawUnsafe<
        Array<{ id: string; email: string | null; last_sign_in_at: Date | string | null }>
      >(
        `SELECT id, email, last_sign_in_at FROM auth.users WHERE id = ANY($1::uuid[])`,
        userIds,
      );
      for (const r of rows) {
        map.set(r.id, {
          email: r.email,
          lastSignInAt: r.last_sign_in_at ? new Date(r.last_sign_in_at) : null,
        });
      }
    } catch {
      // Ignore if auth.users schema is not available in mock/testing
    }
    return map;
  }

  private encodeCursor(createdAt: Date, userId: string) {
    return Buffer.from(`${createdAt.toISOString()}|${userId}`, 'utf8').toString(
      'base64url',
    );
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return null;
    try {
      const [iso, userId] = Buffer.from(cursor, 'base64url')
        .toString('utf8')
        .split('|');
      return { createdAt: new Date(iso), userId };
    } catch {
      return null;
    }
  }

  private async writeAudit(input: {
    actorUserId: string;
    targetId: string;
    action: string;
    reasonCode?: string;
    caseId?: string;
    requestId?: string;
    result?: string;
    before?: unknown;
    after?: unknown;
  }) {
    await this.prisma.db.adminActionAudit.create({
      data: {
        actorUserId: input.actorUserId,
        targetType: 'USER',
        targetId: input.targetId,
        action: input.action,
        reasonCode: input.reasonCode ?? null,
        caseId: input.caseId ?? null,
        requestId: input.requestId ?? null,
        result: input.result ?? 'SUCCESS',
        beforeSanitized: (input.before as any) ?? undefined,
        afterSanitized: (input.after as any) ?? undefined,
      },
    });
  }

  private async findAccount(userId: string) {
    return this.prisma.db.account.findFirst({
      where: { OR: [{ userId }, { passwordHash: userId }] },
    });
  }

  async getSummary(query: {
    from?: string;
    to?: string;
    timezone?: string;
  }) {
    const timezone = query.timezone ?? 'Asia/Ho_Chi_Minh';
    const toExclusive = query.to
      ? new Date(`${query.to}T00:00:00.000Z`)
      : new Date();
    const from = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : new Date(toExclusive.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    let [totalUsers, newUsers, activeUsersToday, restrictedUsers] =
      await Promise.all([
        this.prisma.db.profile.count({
          where: { accountStatus: { not: AccountStatus.DELETED } },
        }),
        this.prisma.db.profile.count({
          where: { createdAt: { gte: from, lt: toExclusive } },
        }),
        this.prisma.db.account.count({
          where: { lastLoginAt: { gte: todayStart } },
        }),
        this.prisma.db.profile.count({
          where: {
            OR: [
              { accountStatus: { in: [AccountStatus.SUSPENDED, AccountStatus.LOCKED] } },
              {
                restrictions: {
                  some: { status: 'ACTIVE' },
                },
              },
            ],
          },
        }),
      ]);

    if (typeof this.prisma.db.$queryRawUnsafe === 'function') {
      try {
        const authActive = await this.prisma.db.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*)::bigint AS count FROM auth.users WHERE last_sign_in_at >= $1`,
          todayStart,
        );
        if (authActive?.[0]?.count) {
          activeUsersToday = Math.max(activeUsersToday, Number(authActive[0].count));
        }
      } catch {
        // ignore if not supported
      }
    }

    return {
      period: {
        from: from.toISOString().slice(0, 10),
        toExclusive: toExclusive.toISOString().slice(0, 10),
        timezone,
      },
      metrics: {
        totalUsers,
        activeUsersToday,
        newUsers,
        restrictedUsers,
      },
      comparison: null,
      definitions: {
        activeUser: 'AUTH_OR_MEANINGFUL_EVENT',
        restrictedUser: 'ACTIVE_SUSPENSION_OR_SECURITY_LOCK',
        version: 'admin-user-metrics-v1',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getHabitAnalytics() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Phân loại Admin vs App User thực tế
    const adminRows = await this.prisma.db.$queryRaw<Array<{ profile_id: string }>>`
      SELECT DISTINCT profile_id FROM profile_roles WHERE role::text IN ('SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER')
    `;
    const adminProfileIds = adminRows.map((r) => r.profile_id);

    const totalAppUsers = await this.prisma.db.profile.count({
      where: {
        accountStatus: { not: AccountStatus.DELETED },
        id: { notIn: adminProfileIds },
      },
    });

    // 2. DAU & MAU thực tế từ các hoạt động thực tế (last_login, spins, scans)
    const [dauRows, mauRows] = await Promise.all([
      this.prisma.db.$queryRaw<Array<{ count: bigint }>>`
        WITH active_users AS (
          SELECT user_id FROM random_histories WHERE created_at >= ${todayStart} AND user_id IS NOT NULL
          UNION
          SELECT user_id FROM food_scan_events WHERE created_at >= ${todayStart} AND user_id IS NOT NULL
          UNION
          SELECT a.user_id FROM accounts a WHERE a.last_login_at >= ${todayStart} AND a.user_id IS NOT NULL
        )
        SELECT COUNT(DISTINCT user_id)::bigint as count FROM active_users;
      `,
      this.prisma.db.$queryRaw<Array<{ count: bigint }>>`
        WITH active_users AS (
          SELECT user_id FROM random_histories WHERE created_at >= ${thirtyDaysAgo} AND user_id IS NOT NULL
          UNION
          SELECT user_id FROM food_scan_events WHERE created_at >= ${thirtyDaysAgo} AND user_id IS NOT NULL
          UNION
          SELECT a.user_id FROM accounts a WHERE a.last_login_at >= ${thirtyDaysAgo} AND a.user_id IS NOT NULL
        )
        SELECT COUNT(DISTINCT user_id)::bigint as count FROM active_users;
      `,
    ]);

    const dau = Number(dauRows[0]?.count ?? 0);
    const mau = Number(mauRows[0]?.count ?? 0);
    const stickinessRatio = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;

    // 3. Telemetry phiên thực tế từ database
    const [sessionDurationStats, spinAttempts, userRetentionStats] = await Promise.all([
      this.prisma.db.$queryRaw<Array<{ avg_session_min: number; bounce_rate: number; total_sessions: bigint; avg_opens_per_user: number }>>`
        WITH user_session_groups AS (
          SELECT 
            COALESCE(user_id::text, 'anon') as uid,
            session_id,
            MIN(created_at) as first_act,
            MAX(created_at) as last_act,
            COUNT(*) as actions_in_session
          FROM random_histories
          GROUP BY COALESCE(user_id::text, 'anon'), session_id
        ),
        session_durations AS (
          SELECT 
            uid,
            session_id,
            actions_in_session,
            GREATEST(EXTRACT(EPOCH FROM (last_act - first_act)) / 60.0, 0.5) as duration_min,
            CASE WHEN actions_in_session = 1 THEN 1 ELSE 0 END as is_bounce
          FROM user_session_groups
        )
        SELECT 
          ROUND(AVG(duration_min)::numeric, 1)::float as avg_session_min,
          ROUND((SUM(is_bounce) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1)::float as bounce_rate,
          COUNT(*)::bigint as total_sessions,
          ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT uid), 0)), 1)::float as avg_opens_per_user
        FROM session_durations;
      `,
      this.prisma.db.$queryRaw<Array<{ avg_spins: number }>>`
        SELECT ROUND(AVG(attempt_count)::numeric, 1)::float as avg_spins
        FROM (
          SELECT session_id, COUNT(*) as attempt_count
          FROM random_histories
          GROUP BY session_id
        ) s;
      `,
      this.prisma.db.$queryRaw<Array<{ returning_rate: number; avg_streak: number }>>`
        WITH user_days AS (
          SELECT 
            user_id,
            COUNT(DISTINCT DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')) as active_days
          FROM (
            SELECT user_id, created_at FROM random_histories WHERE user_id IS NOT NULL
            UNION ALL
            SELECT user_id, created_at FROM food_scan_events WHERE user_id IS NOT NULL
          ) all_acts
          GROUP BY user_id
        )
        SELECT 
          ROUND((COUNT(*) FILTER (WHERE active_days > 1) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1)::float as returning_rate,
          ROUND(AVG(active_days)::numeric, 1)::float as avg_streak
        FROM user_days;
      `,
    ]);

    const sessInfo = sessionDurationStats[0];
    const retInfo = userRetentionStats[0];

    const sessionTelemetry = {
      avgSessionMinutes: sessInfo?.avg_session_min ?? 0,
      bounceRatePercent: sessInfo?.bounce_rate ?? 0,
      avgDailyOpensPerUser: sessInfo?.avg_opens_per_user ?? 0,
      returningUserRate: retInfo?.returning_rate ?? 0,
      avgSpinsToChoice: spinAttempts[0]?.avg_spins ?? 1,
      habitFormationStreakAvg: retInfo?.avg_streak ?? 1,
    };

    // 4. Feature usage counts & 7-day trend thực tế từ database
    const [
      totalSpins,
      totalScans,
      scansConfirmed,
      totalDiaryLogs,
      totalSavedDishes,
      totalExploreEvents,
      totalArticleInteractions,
      trendsRows,
    ] = await Promise.all([
      this.prisma.db.randomHistory.count(),
      this.prisma.db.foodScanEvent.count(),
      this.prisma.db.foodScanEvent.count({ where: { correct: true } }),
      this.prisma.db.diaryMealLog.count().catch(() => 0),
      this.prisma.db.savedDish.count(),
      this.prisma.db.exploreEngagementEvent.count(),
      this.prisma.db.$queryRaw<Array<{ count: bigint }>>`
        SELECT 
          ((SELECT COUNT(*) FROM article_likes) + 
           (SELECT COUNT(*) FROM article_comments) + 
           (SELECT COUNT(*) FROM articles))::bigint as count
      `.then((res) => Number(res[0]?.count ?? 0)).catch(() => 0),
      this.prisma.db.$queryRaw<Array<{ feature: string; recent_count: bigint; prev_count: bigint }>>`
        SELECT 
          'random_wheel' as feature,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint as recent_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::bigint as prev_count
        FROM random_histories
        UNION ALL
        SELECT 
          'food_scan' as feature,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint as recent_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::bigint as prev_count
        FROM food_scan_events
        UNION ALL
        SELECT 
          'meal_diary' as feature,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint as recent_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::bigint as prev_count
        FROM diary_meal_logs
        UNION ALL
        SELECT 
          'explore_places' as feature,
          COUNT(*) FILTER (WHERE saved_at >= NOW() - INTERVAL '7 days')::bigint as recent_count,
          COUNT(*) FILTER (WHERE saved_at >= NOW() - INTERVAL '14 days' AND saved_at < NOW() - INTERVAL '7 days')::bigint as prev_count
        FROM saved_dishes;
      `,
    ]);

    const trendMap = new Map<string, string>();
    for (const t of trendsRows) {
      const recent = Number(t.recent_count);
      const prev = Number(t.prev_count);
      if (prev > 0) {
        const pct = Math.round(((recent - prev) / prev) * 1000) / 10;
        trendMap.set(t.feature, `${pct >= 0 ? '+' : ''}${pct}%`);
      } else if (recent > 0) {
        trendMap.set(t.feature, `+${recent} mới`);
      } else {
        trendMap.set(t.feature, '0%');
      }
    }

    const totalInteractions = totalSpins + totalScans + totalDiaryLogs + totalSavedDishes + totalArticleInteractions;
    const safeTotal = totalInteractions > 0 ? totalInteractions : 1;
    const safeAppUsers = totalAppUsers > 0 ? totalAppUsers : 1;

    const featureBreakdown = [
      {
        id: 'random_wheel',
        name: 'Vòng quay chọn món (Jackpot Reel)',
        category: 'Quyết định món ăn',
        count: totalSpins,
        percent: Math.round((totalSpins / safeTotal) * 100),
        trend: trendMap.get('random_wheel') ?? '0%',
        avgUsagePerUser: (totalSpins / safeAppUsers).toFixed(1),
        description: `Đã ghi nhận ${totalSpins} lượt quay từ người dùng, quay trung bình ${sessionTelemetry.avgSpinsToChoice} lần mỗi phiên để chọn món.`,
      },
      {
        id: 'food_scan',
        name: 'Quét món ăn bằng camera AI',
        category: 'Nhận diện & Dinh dưỡng',
        count: totalScans,
        percent: Math.round((totalScans / safeTotal) * 100),
        trend: trendMap.get('food_scan') ?? '0%',
        avgUsagePerUser: (totalScans / safeAppUsers).toFixed(1),
        description: `Đã thực hiện ${totalScans} lượt quét món, tỉ lệ ảnh AI nhận diện chính xác đạt ${totalScans > 0 ? Math.round((scansConfirmed / totalScans) * 100) : 0}%.`,
      },
      {
        id: 'meal_diary',
        name: 'Ghi nhật ký dinh dưỡng & Calo',
        category: 'Theo dõi sức khỏe',
        count: totalDiaryLogs,
        percent: Math.round((totalDiaryLogs / safeTotal) * 100),
        trend: trendMap.get('meal_diary') ?? '0%',
        avgUsagePerUser: (totalDiaryLogs / safeAppUsers).toFixed(1),
        description: totalDiaryLogs > 0 ? `Đã ghi ${totalDiaryLogs} bữa ăn theo mục tiêu calo.` : 'Chưa có nhật ký nào được ghi nhận từ người dùng thực tế.',
      },
      {
        id: 'explore_places',
        name: 'Khám phá quán ăn & Điểm ăn uống',
        category: 'Trải nghiệm ẩm thực',
        count: totalSavedDishes + totalExploreEvents,
        percent: Math.round(((totalSavedDishes + totalExploreEvents) / safeTotal) * 100),
        trend: trendMap.get('explore_places') ?? '0%',
        avgUsagePerUser: ((totalSavedDishes + totalExploreEvents) / safeAppUsers).toFixed(1),
        description: totalSavedDishes > 0 ? `Đã lưu ${totalSavedDishes} món ăn yêu thích và xem quán ăn.` : 'Chưa có lượt lưu món hoặc tìm quán ăn từ người dùng thực tế.',
      },
      {
        id: 'culinary_articles',
        name: 'Đọc bài viết văn hóa ẩm thực',
        category: 'Nội dung & Khám phá',
        count: totalArticleInteractions,
        percent: Math.round((totalArticleInteractions / safeTotal) * 100),
        trend: '0%',
        avgUsagePerUser: (totalArticleInteractions / safeAppUsers).toFixed(1),
        description: `Kho cẩm nang hiện có ${totalArticleInteractions} bài viết & tương tác bài viết văn hóa ẩm thực.`,
      },
    ];

    // 5. Circadian slots: Tính 100% từ giờ thực tế của các events trong DB
    const circadianRaw = await this.prisma.db.$queryRaw<Array<{ hour: number; count: bigint }>>`
      WITH all_events AS (
        SELECT created_at FROM random_histories
        UNION ALL
        SELECT created_at FROM food_scan_events
        UNION ALL
        SELECT created_at FROM refresh_sessions
      )
      SELECT 
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int as hour,
        COUNT(*)::bigint as count
      FROM all_events
      GROUP BY hour;
    `;

    const hourCountMap = new Map<number, number>();
    let totalCircadianEvents = 0;
    for (const r of circadianRaw) {
      const c = Number(r.count);
      hourCountMap.set(r.hour, c);
      totalCircadianEvents += c;
    }

    const slotDefs = [
      {
        slot: 'Bữa Sáng (06:00 - 09:30)',
        hours: [6, 7, 8, 9],
        action: 'Quay chọn món ăn sáng nhanh, kiểm tra calo cà phê & điểm tâm.',
      },
      {
        slot: 'Bữa Trưa (11:00 - 13:30)',
        hours: [11, 12, 13],
        action: 'Cao điểm tìm cơm trưa văn phòng, quay vòng quay chọn món cùng đồng nghiệp.',
      },
      {
        slot: 'Trà Chiều / Xế (14:00 - 16:30)',
        hours: [14, 15, 16],
        action: 'Tìm trà sữa, ăn vặt, đồ ngọt giải lao giờ làm việc.',
      },
      {
        slot: 'Bữa Tối (18:00 - 20:30)',
        hours: [18, 19, 20],
        action: 'Tìm quán ăn ngon tối, nhà hàng gia đình, lưu món nấu tại nhà.',
      },
      {
        slot: 'Ăn Khuya (21:30 - 00:30)',
        hours: [21, 22, 23, 0],
        action: 'Tìm quán ốc, cháo đêm, đồ ăn nhẹ phục vụ cú đêm.',
      },
    ];

    const circadianSlots = slotDefs.map((def) => {
      let slotEvents = 0;
      let peakH = def.hours[0];
      let maxHCount = -1;

      for (const h of def.hours) {
        const c = hourCountMap.get(h) ?? 0;
        slotEvents += c;
        if (c > maxHCount) {
          maxHCount = c;
          peakH = h;
        }
      }

      const percent = totalCircadianEvents > 0 ? Math.round((slotEvents / totalCircadianEvents) * 100) : 0;
      const peakHourFormatted = `${String(peakH).padStart(2, '0')}:30`;

      return {
        slot: def.slot,
        percent,
        peakHour: peakHourFormatted,
        action: def.action,
      };
    });

    // 6. Habit Cohorts: Phân loại 100% dựa trên danh sách user thực tế trong DB
    const userAggregates = await this.prisma.db.$queryRaw<Array<{
      user_id: string;
      spins: bigint;
      scans: bigint;
      diaries: bigint;
      saved: bigint;
      total_actions: bigint;
    }>>`
      WITH all_user_acts AS (
        SELECT user_id, 'spin' as act_type FROM random_histories WHERE user_id IS NOT NULL
        UNION ALL
        SELECT user_id, 'scan' as act_type FROM food_scan_events WHERE user_id IS NOT NULL
        UNION ALL
        SELECT user_id, 'diary' as act_type FROM diary_meal_logs WHERE user_id IS NOT NULL
        UNION ALL
        SELECT user_id, 'saved' as act_type FROM saved_dishes WHERE user_id IS NOT NULL
      )
      SELECT 
        user_id::text,
        COUNT(*) FILTER (WHERE act_type = 'spin')::bigint as spins,
        COUNT(*) FILTER (WHERE act_type = 'scan')::bigint as scans,
        COUNT(*) FILTER (WHERE act_type = 'diary')::bigint as diaries,
        COUNT(*) FILTER (WHERE act_type = 'saved')::bigint as saved,
        COUNT(*)::bigint as total_actions
      FROM all_user_acts
      GROUP BY user_id;
    `;

    let indecisiveCount = 0;
    let healthCount = 0;
    let fastCount = 0;
    let explorerCount = 0;

    for (const u of userAggregates) {
      const s = Number(u.spins);
      const sc = Number(u.scans);
      const d = Number(u.diaries);
      const tot = Number(u.total_actions);

      if (sc > 0 || d > 0) {
        healthCount++;
      } else if (s >= 5) {
        indecisiveCount++;
      } else if (tot <= 2) {
        fastCount++;
      } else {
        explorerCount++;
      }
    }

    const totalCohortUsers = userAggregates.length || 1;

    const habitCohorts = [
      {
        name: 'The Indecisive Spinners (Nhóm phân vân - Quay nhiều lần)',
        sharePercent: Math.round((indecisiveCount / totalCohortUsers) * 100),
        characteristics: `Có ${indecisiveCount} người dùng quay từ 5 lần trở lên trước khi chốt, nhạy cảm với hình ảnh món ăn và gợi ý nhanh.`,
        recommendation: 'Tăng độ mượt mà của reel và nút "Gợi ý quán gần nhất ngay" ngay sau khi trúng món.',
      },
      {
        name: 'The Health Trackers (Nhóm đếm Calo & Eat Clean)',
        sharePercent: Math.round((healthCount / totalCohortUsers) * 100),
        characteristics: `Có ${healthCount} người dùng sử dụng AI Food Scan để quét món hoặc ghi nhật ký dinh dưỡng.`,
        recommendation: 'Tăng tốc độ nhận diện ảnh AI dưới 800ms, hiển thị thanh tiến độ Calo Goal ngay màn hình chính.',
      },
      {
        name: 'The Fast Deciders (Nhóm quyết định nhanh 1-chạm)',
        sharePercent: Math.round((fastCount / totalCohortUsers) * 100),
        characteristics: `Có ${fastCount} người dùng chốt món nhanh chóng chỉ sau 1-2 lần thao tác trên app.`,
        recommendation: 'Ghi nhớ quán ăn quen thuộc và tự động điền bộ lọc khoảng cách < 2km.',
      },
      {
        name: 'The Food Explorers (Nhóm khám phá món lạ & quán ngon)',
        sharePercent: Math.round((explorerCount / totalCohortUsers) * 100),
        characteristics: `Có ${explorerCount} người dùng tương tác với các chuyên mục tìm kiếm và cẩm nang ẩm thực.`,
        recommendation: 'Đẩy bài viết gợi ý "Top 10 quán ăn tuần này" vào feed thông báo lúc 16h thứ 6.',
      },
    ];

    return {
      overview: {
        totalAppUsers,
        dau,
        mau,
        stickinessRatio,
        ...sessionTelemetry,
      },
      featureBreakdown,
      circadianSlots,
      habitCohorts,
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers(query: {
    q?: string;
    status?: string;
    type?: 'ALL' | 'ADMIN' | 'APP_USER';
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const decoded = this.decodeCursor(query.cursor);
    const status = query.status?.toUpperCase();
    const q = query.q?.trim();

    let adminProfileIds: string[] = [];
    if (query.type === 'ADMIN' || query.type === 'APP_USER') {
      const rows = await this.prisma.db.$queryRaw<Array<{ profile_id: string }>>`
        SELECT DISTINCT profile_id FROM profile_roles WHERE role::text IN ('SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER')
      `;
      adminProfileIds = rows.map((r) => r.profile_id);
    }

    const profiles = await this.prisma.db.profile.findMany({
      where: {
        ...(status ? { accountStatus: status as AccountStatus } : {}),
        ...(query.type === 'ADMIN'
          ? { id: { in: adminProfileIds } }
          : query.type === 'APP_USER'
            ? { id: { notIn: adminProfileIds } }
            : {}),
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                { createdAt: decoded.createdAt, userId: { lt: decoded.userId } },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { userId: q.length >= 32 ? q : undefined },
              ].filter(Boolean) as any,
            }
          : {}),
      },
      include: {
        userGoals: {
          where: { priority: 'PRIMARY' },
          include: { goal: { select: { code: true, name: true } } },
          take: 1,
        },
        restrictions: {
          where: { status: 'ACTIVE' },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
        profileRoles: { select: { role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: take + 1,
    });

    const hasNextPage = profiles.length > take;
    const page = hasNextPage ? profiles.slice(0, take) : profiles;

    const accounts = await this.prisma.db.account.findMany({
      where: {
        OR: [
          { userId: { in: page.map((p) => p.userId) } },
          { passwordHash: { in: page.map((p) => p.userId) } },
        ],
      },
    });
    const accountByUser = new Map<string, (typeof accounts)[number]>();
    for (const a of accounts) {
      if (a.userId) accountByUser.set(a.userId, a);
      accountByUser.set(a.passwordHash, a);
    }

    let filtered = page;
    if (q) {
      const qLower = q.toLowerCase();
      filtered = page.filter((p) => {
        const account = accountByUser.get(p.userId);
        return (
          p.displayName?.toLowerCase().includes(qLower) ||
          account?.username?.toLowerCase().includes(qLower) ||
          account?.usernameNormalized?.includes(qLower) ||
          p.userId === q
        );
      });
    }

    const userIds = page.map((p) => p.userId);
    const authUsers = await this.getAuthUsers(userIds);

    const items = filtered.map((p) => {
      const account = accountByUser.get(p.userId);
      const authUser = authUsers.get(p.userId);
      const username = account?.username ?? p.displayName ?? 'user';
      const email = authUser?.email ?? null;
      const masked = this.maskEmail(username, email);
      return {
        userId: p.userId,
        displayName: p.displayName,
        username,
        avatarUrl: p.avatarUrl,
        ...masked,
        roles: p.profileRoles.map((r) => r.role),
        isAdmin: p.profileRoles.some((r) =>
          ([SystemRole.SUPER_ADMIN, SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER] as SystemRole[]).includes(r.role),
        ),
        primaryGoal: p.userGoals[0]?.goal ?? null,
        accountStatus: p.accountStatus,
        restriction: p.restrictions[0]
          ? {
              id: p.restrictions[0].id,
              type: p.restrictions[0].type,
              reasonCode: p.restrictions[0].reasonCode,
              endsAt: p.restrictions[0].endsAt,
            }
          : null,
        emailVerified: p.accountStatus !== AccountStatus.PENDING_VERIFICATION,
        lastActiveAt: account?.lastLoginAt ?? authUser?.lastSignInAt ?? null,
        joinedAt: p.createdAt,
        version: p.profileVersion,
        availableActions: [
          'VIEW',
          'SEND_PASSWORD_RESET',
          'SUSPEND',
        ],
      };
    });

    const last = page[page.length - 1];
    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? this.encodeCursor(last.createdAt, last.userId)
            : null,
        hasNextPage,
      },
    };
  }

  async getUser(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: {
        userGoals: {
          where: { priority: 'PRIMARY' },
          include: { goal: { select: { code: true, name: true } } },
          take: 1,
        },
        profileRoles: true,
        restrictions: {
          where: { status: 'ACTIVE' },
          orderBy: { startsAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            savedDishes: true,
            communityPosts: true,
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const account = await this.findAccount(userId);
    const authUsers = await this.getAuthUsers([userId]);
    const authUser = authUsers.get(userId);
    const username = account?.username ?? profile.displayName ?? 'user';
    const email = authUser?.email ?? null;
    const masked = this.maskEmail(username, email);
    const activeSessionCount = account
      ? await this.prisma.db.refreshSession.count({
          where: { accountId: account.id, revokedAt: null },
        })
      : 0;
    const randomRunCount = await this.prisma.db.randomHistory.count({
      where: { userId },
    });
    const publishedPostCount = await this.prisma.db.communityPost.count({
      where: { authorId: userId, status: 'ACTIVE' },
    });

    return {
      userId,
      identity: {
        displayName: profile.displayName,
        username,
        avatarUrl: profile.avatarUrl,
        ...masked,
        emailVerified: profile.accountStatus !== AccountStatus.PENDING_VERIFICATION,
      },
      account: {
        status: profile.accountStatus,
        createdAt: profile.createdAt,
        lastLoginAt: account?.lastLoginAt ?? authUser?.lastSignInAt ?? null,
        lastActiveAt: account?.lastLoginAt ?? authUser?.lastSignInAt ?? null,
        mustChangePassword: account?.mustChangePassword ?? false,
        failedLoginAttempts: account?.failedLoginAttempts ?? 0,
        lockedUntil: account?.lockedUntil ?? null,
        version: profile.profileVersion,
      },
      access: {
        roles: profile.profileRoles.map((r) => r.role),
        activeSessionCount,
      },
      productSummary: {
        onboardingStatus: profile.onboardingStatus,
        primaryGoal: profile.userGoals[0]?.goal ?? null,
        savedDishCount: profile._count.savedDishes,
        randomRunCount,
        publishedPostCount,
      },
      activeRestriction: profile.restrictions[0] ?? null,
      availableActions: [
        'SEND_PASSWORD_RESET',
        'REVOKE_SESSIONS',
        'SUSPEND',
      ],
    };
  }

  async requestPasswordReset(
    actorUserId: string,
    userId: string,
    body: { reasonCode?: string; caseId?: string; revokeSessions?: boolean },
    requestId?: string,
  ) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.prisma.db.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    if (body.revokeSessions) {
      const account = await this.findAccount(userId);
      if (account) {
        await this.prisma.db.refreshSession.updateMany({
          where: { accountId: account.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    const account = await this.findAccount(userId);
    const username = account?.username ?? 'user';
    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'PASSWORD_RESET_REQUESTED',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
    });

    return {
      status: 'QUEUED',
      deliveryChannel: 'EMAIL',
      destinationMasked: this.maskEmail(username).email,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async sendVerificationReminder(
    actorUserId: string,
    userId: string,
    body: { reasonCode?: string; caseId?: string },
    requestId?: string,
  ) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const raw = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await this.prisma.db.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'EMAIL_VERIFICATION_REMINDER',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
    });

    return {
      status: 'QUEUED',
      nextAllowedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Tạo tài khoản người dùng hoặc nhân sự mới trực tiếp bởi Super Admin
   */
  async createUser(
    actorUserId: string,
    dto: CreateAdminUserDto,
    requestId?: string,
  ) {
    const existing = await this.prisma.db.account.findUnique({
      where: { username: dto.username.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException({
        code: 'USERNAME_EXISTS',
        message: 'Tên đăng nhập này đã được sử dụng.',
      });
    }

    const tempPassword =
      dto.password?.trim() ||
      `Mogu@${randomBytes(4).toString('hex').toUpperCase()}9`;

    const internalEmail =
      dto.email?.trim() || `${dto.username.toLowerCase()}@${this.INTERNAL_DOMAIN}`;

    let supabaseUserId: string;

    if (this.supabase) {
      const { data: signUpData, error: signUpError } =
        await this.supabase.auth.admin.createUser({
          email: internalEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            username: dto.username.toLowerCase(),
            display_name: dto.displayName,
          },
        });

      if (signUpError || !signUpData?.user) {
        throw new BadRequestException({
          code: 'AUTH_CREATE_FAILED',
          message: signUpError?.message || 'Không thể tạo tài khoản trên hệ thống Auth.',
        });
      }
      supabaseUserId = signUpData.user.id;
    } else {
      supabaseUserId = randomUUID();
    }

    const mustChange = dto.mustChangePassword ?? true;

    await this.prisma.db.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          userId: supabaseUserId,
          displayName: dto.displayName?.trim() || dto.username,
          accountStatus: AccountStatus.ACTIVE,
          onboardingStatus: 'COMPLETED',
        },
      });

      await tx.account.create({
        data: {
          username: dto.username.toLowerCase(),
          userId: supabaseUserId,
          passwordHash: supabaseUserId,
          mustChangePassword: mustChange,
        },
      });

      if (dto.role && dto.role !== SystemRole.USER) {
        await tx.profileRole.create({
          data: {
            profileId: profile.id,
            role: dto.role,
            assignedBy: actorUserId,
          },
        });
      }
    });

    await this.writeAudit({
      actorUserId,
      targetId: supabaseUserId,
      action: 'USER_CREATED_BY_ADMIN',
      reasonCode: 'ADMIN_PROVISIONING',
      requestId,
      after: {
        username: dto.username,
        email: internalEmail,
        role: dto.role,
        mustChangePassword: mustChange,
      },
    });

    return {
      userId: supabaseUserId,
      username: dto.username.toLowerCase(),
      email: internalEmail,
      displayName: dto.displayName || dto.username,
      role: dto.role,
      mustChangePassword: mustChange,
      temporaryPassword: tempPassword,
      message: 'Tài khoản đã được khởi tạo thành công.',
    };
  }

  /**
   * Cấp mật khẩu tạm trực tiếp và yêu cầu đổi mật khẩu ở lần đăng nhập tới
   */
  async directPasswordReset(
    actorUserId: string,
    userId: string,
    body: DirectPasswordResetDto,
    requestId?: string,
  ) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const tempPassword =
      body.temporaryPassword?.trim() ||
      `Mogu@${randomBytes(4).toString('hex').toUpperCase()}9`;

    if (this.supabase) {
      const { error } = await this.supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });
      if (error) {
        throw new BadRequestException({
          code: 'RESET_FAILED',
          message: error.message,
        });
      }
      await this.supabase.auth.admin.signOut(userId, 'global').catch(() => null);
    }

    const account = await this.findAccount(userId);
    if (account) {
      await this.prisma.db.account.update({
        where: { id: account.id },
        data: {
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }).catch(() => null);

      await this.prisma.db.refreshSession.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }).catch(() => null);
    }

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'DIRECT_PASSWORD_RESET',
      reasonCode: body.reasonCode || 'ADMIN_TEMP_PASSWORD',
      caseId: body.caseId,
      requestId,
    });

    return {
      status: 'SUCCESS',
      temporaryPassword: tempPassword,
      mustChangePassword: true,
      message: 'Mật khẩu tạm thời đã được thiết lập thành công.',
    };
  }

  async listSessions(userId: string) {
    const account = await this.findAccount(userId);
    if (!account) return { items: [] };
    const sessions = await this.prisma.db.refreshSession.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: sessions.map((s) => ({
        sessionId: s.id,
        deviceLabel: s.deviceLabel,
        platform: s.platform,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        status: s.revokedAt ? 'REVOKED' : 'ACTIVE',
      })),
    };
  }

  async revokeSessions(
    actorUserId: string,
    userId: string,
    body: {
      scope?: 'ALL' | 'SELECTED';
      sessionIds?: string[];
      reasonCode?: string;
      caseId?: string;
    },
    requestId?: string,
  ) {
    if (actorUserId === userId) {
      throw new ForbiddenException({ code: 'SELF_ACTION_NOT_ALLOWED' });
    }
    const account = await this.findAccount(userId);
    if (!account) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const where =
      body.scope === 'SELECTED' && body.sessionIds?.length
        ? { accountId: account.id, id: { in: body.sessionIds }, revokedAt: null }
        : { accountId: account.id, revokedAt: null };

    const result = await this.prisma.db.refreshSession.updateMany({
      where,
      data: { revokedAt: new Date() },
    });

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'SESSIONS_REVOKED',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
      after: { revokedCount: result.count },
    });

    return { revokedCount: result.count };
  }

  async createSuspension(
    actorUserId: string,
    userId: string,
    body: {
      reasonCode: string;
      reasonNote?: string;
      caseId?: string;
      startsAt?: string;
      endsAt?: string;
      revokeSessions?: boolean;
    },
    requestId?: string,
  ) {
    if (actorUserId === userId) {
      throw new ForbiddenException({ code: 'SELF_ACTION_NOT_ALLOWED' });
    }
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const existing = await this.prisma.db.accountRestriction.findFirst({
      where: { userId, type: 'POLICY_SUSPENSION', status: 'ACTIVE' },
    });
    if (existing) {
      throw new ConflictException({ code: 'USER_ALREADY_SUSPENDED' });
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    const restriction = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.accountRestriction.create({
        data: {
          userId,
          type: 'POLICY_SUSPENSION',
          status: 'ACTIVE',
          reasonCode: body.reasonCode,
          reasonNote: body.reasonNote ?? null,
          caseId: body.caseId ?? null,
          startsAt,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          createdBy: actorUserId,
        },
      });
      await tx.profile.update({
        where: { userId },
        data: {
          accountStatus: AccountStatus.SUSPENDED,
          profileVersion: { increment: 1 },
        },
      });
      return row;
    });

    if (body.revokeSessions !== false) {
      await this.revokeSessions(
        actorUserId,
        userId,
        { scope: 'ALL', reasonCode: body.reasonCode, caseId: body.caseId },
        requestId,
      );
    }

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'USER_SUSPENDED',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
      before: { accountStatus: profile.accountStatus },
      after: { accountStatus: AccountStatus.SUSPENDED, suspensionId: restriction.id },
    });

    return {
      suspensionId: restriction.id,
      userId,
      status: restriction.status,
      reasonCode: restriction.reasonCode,
      startsAt: restriction.startsAt,
      endsAt: restriction.endsAt,
      accountVersion: profile.profileVersion + 1,
    };
  }

  async endSuspension(
    actorUserId: string,
    userId: string,
    suspensionId: string,
    body: { reasonCode?: string; caseId?: string },
    requestId?: string,
  ) {
    const restriction = await this.prisma.db.accountRestriction.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ...(suspensionId && suspensionId !== 'current' ? { id: suspensionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.db.$transaction(async (tx) => {
      if (restriction) {
        await tx.accountRestriction.update({
          where: { id: restriction.id },
          data: {
            status: 'ENDED',
            endedAt: new Date(),
            endedBy: actorUserId,
            endReasonCode: body.reasonCode ?? 'MANUAL_END',
            version: { increment: 1 },
          },
        });
      }
      await tx.profile.update({
        where: { userId },
        data: { accountStatus: AccountStatus.ACTIVE },
      });
    });

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'USER_SUSPENSION_ENDED',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
    });

    return { suspensionId: restriction?.id ?? suspensionId, status: 'ENDED' };
  }

  async securityUnlock(
    actorUserId: string,
    userId: string,
    body: { reasonCode?: string; caseId?: string },
    requestId?: string,
  ) {
    const account = await this.findAccount(userId);
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    await this.prisma.db.$transaction(async (tx) => {
      if (account) {
        await tx.account.update({
          where: { id: account.id },
          data: { lockedUntil: null, failedLoginAttempts: 0 },
        });
      }
      await tx.accountRestriction.updateMany({
        where: { userId, type: 'SECURITY_LOCK', status: 'ACTIVE' },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
          endedBy: actorUserId,
          endReasonCode: body.reasonCode ?? 'SECURITY_UNLOCK',
        },
      });
      if (profile.accountStatus === AccountStatus.LOCKED) {
        const activeSuspension = await tx.accountRestriction.count({
          where: { userId, type: 'POLICY_SUSPENSION', status: 'ACTIVE' },
        });
        await tx.profile.update({
          where: { userId },
          data: {
            accountStatus: activeSuspension
              ? AccountStatus.SUSPENDED
              : AccountStatus.ACTIVE,
          },
        });
      }
    });

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'SECURITY_UNLOCK',
      reasonCode: body.reasonCode,
      caseId: body.caseId,
      requestId,
    });

    return { unlocked: true };
  }

  async getRoles(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: { profileRoles: true },
    });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return {
      userId,
      roles: profile.profileRoles.map((r) => ({
        role: r.role,
        assignedAt: r.assignedAt,
        assignedBy: r.assignedBy,
      })),
    };
  }

  async assignRole(
    actorUserId: string,
    userId: string,
    role: string,
    body: { reasonCode?: string; ticketId?: string },
    requestId?: string,
  ) {
    if (!Object.values(SystemRole).includes(role as SystemRole)) {
      throw new BadRequestException({ code: 'INVALID_ROLE' });
    }
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    await this.prisma.db.profileRole.upsert({
      where: { profileId_role: { profileId: profile.id, role: role as SystemRole } },
      create: {
        profileId: profile.id,
        role: role as SystemRole,
        assignedBy: actorUserId,
      },
      update: { assignedBy: actorUserId, assignedAt: new Date() },
    });

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'ROLE_ASSIGNED',
      reasonCode: body.reasonCode,
      caseId: body.ticketId,
      requestId,
      after: { role },
    });

    return this.getRoles(userId);
  }

  async revokeRole(
    actorUserId: string,
    userId: string,
    role: string,
    body: { reasonCode?: string; ticketId?: string },
    requestId?: string,
  ) {
    if (actorUserId === userId && role === SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException({ code: 'SELF_ACTION_NOT_ALLOWED' });
    }
    if (role === SystemRole.SUPER_ADMIN) {
      const count = await this.prisma.db.profileRole.count({
        where: { role: SystemRole.SUPER_ADMIN },
      });
      if (count <= 1) {
        throw new ForbiddenException({ code: 'LAST_SUPER_ADMIN_GUARD' });
      }
    }

    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    await this.prisma.db.profileRole
      .delete({
        where: {
          profileId_role: { profileId: profile.id, role: role as SystemRole },
        },
      })
      .catch(() => null);

    await this.writeAudit({
      actorUserId,
      targetId: userId,
      action: 'ROLE_REVOKED',
      reasonCode: body.reasonCode,
      caseId: body.ticketId,
      requestId,
      after: { role },
    });

    return this.getRoles(userId);
  }

  async listAuditEvents(
    userId: string,
    query: { cursor?: string; limit?: number; eventType?: string },
  ) {
    const take = Math.min(Number(query.limit) || 20, 50);
    const items = await this.prisma.db.adminActionAudit.findMany({
      where: {
        targetType: 'USER',
        targetId: userId,
        ...(query.eventType ? { action: query.eventType } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: take + 1,
    });
    const hasNextPage = items.length > take;
    const page = hasNextPage ? items.slice(0, take) : items;
    return {
      items: page.map((e) => ({
        eventId: e.id,
        eventType: e.action,
        targetUserId: e.targetId,
        actor: { id: e.actorUserId },
        reasonCode: e.reasonCode,
        caseId: e.caseId,
        result: e.result,
        occurredAt: e.occurredAt,
        requestId: e.requestId,
        changes: e.afterSanitized,
      })),
      pageInfo: {
        nextCursor: hasNextPage ? page[page.length - 1]?.id : null,
        hasNextPage,
      },
    };
  }

  async listAuthAuditLogs(userId: string, query?: { limit?: number }) {
    const take = Math.min(Number(query?.limit) || 20, 50);
    const logs = await this.prisma.db.authAuditLog.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return {
      items: logs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        result: l.result,
        platform: l.platform,
        appVersion: l.appVersion,
        metadata: l.metadataSanitized,
        occurredAt: l.occurredAt,
      })),
    };
  }

  private readonly exportCache = new Map<string, { filename: string; content: string; createdAt: number }>();

  async createUserListExport(
    actorUserId: string,
    body: {
      filters?: Record<string, unknown>;
      columns?: string[];
      format?: string;
      reasonCode?: string;
    },
    requestId?: string,
  ) {
    const allowed = new Set([
      'userId',
      'displayName',
      'username',
      'accountStatus',
      'joinedAt',
      'lastActiveAt',
    ]);
    const columns = (body.columns ?? [...allowed]).filter((c) => allowed.has(c));
    if (!columns.length) {
      throw new BadRequestException({ code: 'EXPORT_COLUMN_NOT_ALLOWED' });
    }

    // 1. Lấy dữ liệu người dùng thực tế
    const where: any = {};
    if (body.filters?.status) {
      where.accountStatus = body.filters.status as AccountStatus;
    }
    const profiles = await this.prisma.db.profile.findMany({
      where,
      take: 5000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        displayName: true,
        accountStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userIds = profiles.map((p) => p.userId);
    const accounts = await this.prisma.db.account.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { passwordHash: { in: userIds } },
        ],
      },
      select: { userId: true, username: true, passwordHash: true, lastLoginAt: true },
    });
    const accountByUser = new Map<string, { username?: string | null; lastLoginAt?: Date | null }>();
    for (const a of accounts) {
      if (a.userId) accountByUser.set(a.userId, a);
      accountByUser.set(a.passwordHash, a);
    }

    // 2. Tạo nội dung CSV chuẩn (RFC 4180)
    const escapeCsv = (val: any): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.join(',');
    const rows = profiles.map((p) => {
      const acc = accountByUser.get(p.userId);
      return columns
        .map((col) => {
          switch (col) {
            case 'userId':
              return escapeCsv(p.userId);
            case 'displayName':
              return escapeCsv(p.displayName);
            case 'username':
              return escapeCsv(acc?.username ?? p.displayName ?? 'user');
            case 'accountStatus':
              return escapeCsv(p.accountStatus);
            case 'joinedAt':
              return escapeCsv(p.createdAt.toISOString());
            case 'lastActiveAt':
              return escapeCsv(acc?.lastLoginAt?.toISOString() ?? p.updatedAt.toISOString());
            default:
              return '';
          }
        })
        .join(',');
    });
    // Thêm BOM UTF-8 để Excel mở tiếng Việt không bị lỗi font
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const checksumSha256 = createHash('sha256').update(csvContent).digest('hex');

    const storageKey = `admin-exports/${actorUserId}/${Date.now()}.csv`;
    const filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;

    let resultUrl: string | null = null;
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { error: uploadError } = await supabase.storage
          .from('admin-exports')
          .upload(storageKey, Buffer.from(csvContent, 'utf-8'), {
            contentType: 'text/csv; charset=utf-8',
            upsert: true,
          });
        if (!uploadError) {
          const { data: signData } = await supabase.storage
            .from('admin-exports')
            .createSignedUrl(storageKey, 3600);
          if (signData?.signedUrl) {
            resultUrl = signData.signedUrl;
          }
        }
      } catch {
        // Fallback to direct backend download
      }
    }

    const job = await this.prisma.db.adminExportJob.create({
      data: {
        actorUserId,
        status: 'READY',
        progress: 100,
        filtersSnapshot: (body.filters ?? {}) as object,
        columnsSnapshot: columns as unknown as object,
        format: body.format ?? 'CSV',
        storageKey,
        checksumSha256,
        resultUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    this.exportCache.set(job.id, { filename, content: csvContent, createdAt: Date.now() });

    // Dọn cache cũ hơn 1 tiếng
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, val] of this.exportCache.entries()) {
      if (val.createdAt < oneHourAgo) {
        this.exportCache.delete(key);
      }
    }

    await this.writeAudit({
      actorUserId,
      targetId: actorUserId,
      action: 'USER_LIST_EXPORT_CREATED',
      reasonCode: body.reasonCode,
      requestId,
      after: { jobId: job.id, columns, rowCount: profiles.length },
    });

    return {
      jobId: job.id,
      status: job.status,
      pollAfterMs: 500,
    };
  }

  async getUserListExport(actorUserId: string, jobId: string) {
    const job = await this.prisma.db.adminExportJob.findFirst({
      where: { id: jobId, actorUserId },
    });
    if (!job) throw new NotFoundException({ code: 'EXPORT_NOT_FOUND' });

    const downloadUrl =
      job.resultUrl || `/v1/admin/user-list-exports/${job.id}/download`;

    return {
      jobId: job.id,
      status: job.status,
      download: {
        url: downloadUrl,
        expiresAt: job.expiresAt,
      },
    };
  }

  async getExportFile(actorUserId: string, jobId: string) {
    const job = await this.prisma.db.adminExportJob.findFirst({
      where: { id: jobId, actorUserId },
    });
    if (!job) throw new NotFoundException({ code: 'EXPORT_NOT_FOUND' });

    await this.prisma.db.adminExportJob.update({
      where: { id: job.id },
      data: { downloadCount: { increment: 1 } },
    });

    const cached = this.exportCache.get(job.id);
    if (cached) {
      return cached;
    }

    const columns = (job.columnsSnapshot as string[]) || [
      'userId',
      'displayName',
      'username',
      'accountStatus',
      'joinedAt',
      'lastActiveAt',
    ];
    const profiles = await this.prisma.db.profile.findMany({
      take: 5000,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        displayName: true,
        accountStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userIds = profiles.map((p) => p.userId);
    const accounts = await this.prisma.db.account.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { passwordHash: { in: userIds } },
        ],
      },
      select: { userId: true, username: true, passwordHash: true, lastLoginAt: true },
    });
    const accountByUser = new Map<string, { username?: string | null; lastLoginAt?: Date | null }>();
    for (const a of accounts) {
      if (a.userId) accountByUser.set(a.userId, a);
      accountByUser.set(a.passwordHash, a);
    }

    const escapeCsv = (val: any): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.join(',');
    const rows = profiles.map((p) => {
      const acc = accountByUser.get(p.userId);
      return columns
        .map((col) => {
          switch (col) {
            case 'userId':
              return escapeCsv(p.userId);
            case 'displayName':
              return escapeCsv(p.displayName);
            case 'username':
              return escapeCsv(acc?.username ?? p.displayName ?? 'user');
            case 'accountStatus':
              return escapeCsv(p.accountStatus);
            case 'joinedAt':
              return escapeCsv(p.createdAt.toISOString());
            case 'lastActiveAt':
              return escapeCsv(acc?.lastLoginAt?.toISOString() ?? p.updatedAt.toISOString());
            default:
              return '';
          }
        })
        .join(',');
    });

    return {
      filename: `users-export-${new Date().toISOString().slice(0, 10)}.csv`,
      content: '\uFEFF' + [header, ...rows].join('\r\n'),
      createdAt: Date.now(),
    };
  }

  async listPrivacyCases(userId: string) {
    const jobs = await this.prisma.db.privacyJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: jobs.map((j) => ({
        caseId: j.id,
        jobType: j.jobType,
        status: j.status,
        createdAt: j.createdAt,
        expiresAt: j.expiresAt,
      })),
    };
  }

  async privacyCaseAction(
    actorUserId: string,
    caseId: string,
    body: { action: string; reasonCode?: string; note?: string },
    requestId?: string,
  ) {
    const job = await this.prisma.db.privacyJob.findUnique({ where: { id: caseId } });
    if (!job) throw new NotFoundException({ code: 'PRIVACY_CASE_NOT_FOUND' });

    const allowed = ['ACKNOWLEDGE', 'MARK_REVIEW_REQUIRED', 'CANCEL'];
    if (!allowed.includes(body.action)) {
      throw new BadRequestException({ code: 'INVALID_STATE_TRANSITION' });
    }

    let status = job.status;
    if (body.action === 'CANCEL') status = 'CANCELLED';
    if (body.action === 'MARK_REVIEW_REQUIRED') status = 'FAILED_REVIEW_REQUIRED';
    if (body.action === 'ACKNOWLEDGE') status = job.status;

    const updated = await this.prisma.db.privacyJob.update({
      where: { id: caseId },
      data: {
        status,
        metadata: {
          ...(typeof job.metadata === 'object' && job.metadata ? job.metadata : {}),
          lastAdminAction: body.action,
          note: body.note ?? null,
        },
      },
    });

    await this.writeAudit({
      actorUserId,
      targetId: job.userId,
      action: `PRIVACY_CASE_${body.action}`,
      reasonCode: body.reasonCode,
      caseId,
      requestId,
      after: { status: updated.status },
    });

    return { caseId, status: updated.status };
  }
}
