import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AccountStatus, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listUsers(query: {
    q?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
    const decoded = this.decodeCursor(query.cursor);
    const status = query.status?.toUpperCase();
    const q = query.q?.trim();

    const profiles = await this.prisma.db.profile.findMany({
      where: {
        ...(status ? { accountStatus: status as AccountStatus } : {}),
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
