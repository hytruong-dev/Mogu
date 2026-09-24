import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateReportDto, RecommendationFeedbackDto } from './moderation.controller';
import type { ResolveReportDto } from './admin-moderation.controller';

const REPORT_REASONS = [
  { code: 'SPAM', label: 'Spam hoặc quảng cáo' },
  { code: 'HARASSMENT', label: 'Quấy rối' },
  { code: 'HATE', label: 'Nội dung thù ghét' },
  { code: 'VIOLENCE', label: 'Bạo lực' },
  { code: 'NUDITY', label: 'Nội dung nhạy cảm' },
  { code: 'MISINFORMATION', label: 'Thông tin sai lệch' },
  { code: 'OTHER', label: 'Khác' },
];

const EXPLAIN: Record<string, string> = {
  DISH: 'Vì bạn đã xem và lưu các món tương tự',
  ARTICLE: 'Vì bạn quan tâm các chủ đề dinh dưỡng gần đây',
  COMMUNITY_POST: 'Vì bạn theo dõi hoặc tương tác với nội dung cộng đồng tương tự',
};

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.code, r.label]),
);

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  listReportReasons(_targetType?: string) {
    return { reasons: REPORT_REASONS };
  }

  private async writeAudit(input: {
    actorUserId: string;
    targetType: string;
    targetId: string;
    action: string;
    reasonCode?: string;
    result?: string;
    before?: unknown;
    after?: unknown;
  }) {
    await this.prisma.db.adminActionAudit.create({
      data: {
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        reasonCode: input.reasonCode ?? null,
        result: input.result ?? 'SUCCESS',
        beforeSanitized: (input.before as any) ?? undefined,
        afterSanitized: (input.after as any) ?? undefined,
      },
    });
  }

  private async loadTargetPreview(targetType: string, targetId: string) {
    if (targetType === 'COMMUNITY_POST') {
      const post = await this.prisma.db.communityPost.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          content: true,
          imageUrls: true,
          status: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          authorId: true,
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
        },
      });
      if (!post) return null;
      return {
        kind: 'COMMUNITY_POST' as const,
        id: post.id,
        content: post.content,
        imageUrls: post.imageUrls,
        status: post.status,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        author: post.author,
        ownerUserId: post.authorId,
      };
    }
    if (targetType === 'COMMENT') {
      const comment = await this.prisma.db.postComment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          content: true,
          createdAt: true,
          postId: true,
          authorId: true,
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
        },
      });
      if (!comment) return null;
      return {
        kind: 'COMMENT' as const,
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        postId: comment.postId,
        author: comment.author,
        ownerUserId: comment.authorId,
      };
    }
    if (targetType === 'USER') {
      const profile = await this.prisma.db.profile.findUnique({
        where: { userId: targetId },
        select: {
          userId: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          accountStatus: true,
          createdAt: true,
        },
      });
      if (!profile) return null;
      return {
        kind: 'USER' as const,
        id: profile.userId,
        content: profile.bio ?? profile.displayName ?? '',
        author: {
          userId: profile.userId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
        accountStatus: profile.accountStatus,
        createdAt: profile.createdAt,
        ownerUserId: profile.userId,
      };
    }
    return null;
  }

  async adminReportStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [open, reviewing, highPriority, resolvedToday, totalToday] =
      await Promise.all([
        this.prisma.db.moderationReport.count({ where: { status: 'OPEN' } }),
        this.prisma.db.moderationReport.count({ where: { status: 'REVIEWING' } }),
        this.prisma.db.moderationReport.count({
          where: {
            status: { in: ['OPEN', 'REVIEWING'] },
            reasonCode: { in: ['HARASSMENT', 'HATE', 'VIOLENCE', 'NUDITY'] },
          },
        }),
        this.prisma.db.moderationReport.count({
          where: {
            status: { in: ['RESOLVED', 'REJECTED'] },
            updatedAt: { gte: todayStart },
          },
        }),
        this.prisma.db.moderationReport.count({
          where: { createdAt: { gte: todayStart } },
        }),
      ]);
    const pending = open + reviewing;
    const handledRate =
      totalToday + resolvedToday > 0
        ? Math.round((resolvedToday / Math.max(1, totalToday + resolvedToday)) * 100)
        : 100;
    return {
      open,
      reviewing,
      pending,
      highPriority,
      resolvedToday,
      handledRatePercent: handledRate,
      newToday: totalToday,
    };
  }

  async adminListReports(opts: {
    status?: string;
    targetType?: string;
    reasonCode?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const where: any = {};
    if (opts.status) where.status = opts.status.toUpperCase();
    if (opts.targetType) where.targetType = opts.targetType.toUpperCase();
    if (opts.reasonCode) where.reasonCode = opts.reasonCode.toUpperCase();

    const rows = await this.prisma.db.moderationReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        reporter: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Batch load target previews by targetType to prevent N+1 queries
    const postIds = [...new Set(page.filter((r) => r.targetType === 'COMMUNITY_POST').map((r) => r.targetId))];
    const commentIds = [...new Set(page.filter((r) => r.targetType === 'COMMENT').map((r) => r.targetId))];
    const userIds = [...new Set(page.filter((r) => r.targetType === 'USER').map((r) => r.targetId))];

    const [posts, comments, profiles, reportCounts] = await Promise.all([
      postIds.length
        ? this.prisma.db.communityPost.findMany({
            where: { id: { in: postIds } },
            select: {
              id: true,
              content: true,
              imageUrls: true,
              status: true,
              likeCount: true,
              commentCount: true,
              createdAt: true,
              authorId: true,
              author: { select: { userId: true, displayName: true, avatarUrl: true } },
            },
          })
        : [],
      commentIds.length
        ? this.prisma.db.postComment.findMany({
            where: { id: { in: commentIds } },
            select: {
              id: true,
              content: true,
              createdAt: true,
              postId: true,
              authorId: true,
              author: { select: { userId: true, displayName: true, avatarUrl: true } },
            },
          })
        : [],
      userIds.length
        ? this.prisma.db.profile.findMany({
            where: { userId: { in: userIds } },
            select: {
              userId: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              accountStatus: true,
              createdAt: true,
            },
          })
        : [],
      page.length
        ? this.prisma.db.moderationReport.groupBy({
            by: ['targetType', 'targetId'],
            where: {
              status: { in: ['OPEN', 'REVIEWING'] },
              OR: page.map((r) => ({ targetType: r.targetType, targetId: r.targetId })),
            },
            _count: { _all: true },
          })
        : [],
    ]);

    const postMap = new Map(
      posts.map((p) => [
        p.id,
        {
          kind: 'COMMUNITY_POST' as const,
          id: p.id,
          content: p.content,
          imageUrls: p.imageUrls,
          status: p.status,
          likeCount: p.likeCount,
          commentCount: p.commentCount,
          createdAt: p.createdAt,
          author: p.author,
          ownerUserId: p.authorId,
        },
      ]),
    );

    const commentMap = new Map(
      comments.map((c) => [
        c.id,
        {
          kind: 'COMMENT' as const,
          id: c.id,
          content: c.content,
          createdAt: c.createdAt,
          postId: c.postId,
          author: c.author,
          ownerUserId: c.authorId,
        },
      ]),
    );

    const profileMap = new Map(
      profiles.map((pr) => [
        pr.userId,
        {
          kind: 'USER' as const,
          id: pr.userId,
          content: pr.bio ?? pr.displayName ?? '',
          author: {
            userId: pr.userId,
            displayName: pr.displayName,
            avatarUrl: pr.avatarUrl,
          },
          accountStatus: pr.accountStatus,
          createdAt: pr.createdAt,
          ownerUserId: pr.userId,
        },
      ]),
    );

    const openCountMap = new Map(
      reportCounts.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]),
    );

    const data = page.map((r) => {
      let preview: any = null;
      if (r.targetType === 'COMMUNITY_POST') preview = postMap.get(r.targetId) ?? null;
      else if (r.targetType === 'COMMENT') preview = commentMap.get(r.targetId) ?? null;
      else if (r.targetType === 'USER') preview = profileMap.get(r.targetId) ?? null;

      const sameTargetCount = openCountMap.get(`${r.targetType}:${r.targetId}`) ?? 0;
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reasonCode: r.reasonCode,
        reasonLabel: REASON_LABEL[r.reasonCode] ?? r.reasonCode,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        reporter: r.reporter,
        preview,
        openReportCount: sameTargetCount,
        priority:
          ['HARASSMENT', 'HATE', 'VIOLENCE', 'NUDITY'].includes(r.reasonCode) ||
          sameTargetCount >= 3
            ? 'HIGH'
            : 'NORMAL',
      };
    });

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async adminGetReport(id: string) {
    const report = await this.prisma.db.moderationReport.findUnique({
      where: { id },
      include: {
        reporter: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');

    const preview = await this.loadTargetPreview(report.targetType, report.targetId);
    const related = await this.prisma.db.moderationReport.findMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reporter: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });

    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonCode: report.reasonCode,
      reasonLabel: REASON_LABEL[report.reasonCode] ?? report.reasonCode,
      note: report.note,
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      reporter: report.reporter,
      preview,
      relatedReports: related.map((r) => ({
        id: r.id,
        reasonCode: r.reasonCode,
        reasonLabel: REASON_LABEL[r.reasonCode] ?? r.reasonCode,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        reporter: r.reporter,
      })),
    };
  }

  async adminResolveReport(actorUserId: string, id: string, dto: ResolveReportDto) {
    const report = await this.prisma.db.moderationReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');

    const preview = await this.loadTargetPreview(report.targetType, report.targetId);
    const ownerUserId = preview?.ownerUserId;

    if (dto.action === 'DISMISS') {
      await this.prisma.db.moderationReport.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
      await this.writeAudit({
        actorUserId,
        targetType: report.targetType,
        targetId: report.targetId,
        action: 'MODERATION_DISMISS',
        reasonCode: report.reasonCode,
        after: { note: dto.note ?? null },
      });
      return { id, status: 'REJECTED', action: dto.action };
    }

    if (dto.action === 'HIDE_CONTENT' || dto.action === 'DELETE_CONTENT') {
      if (report.targetType === 'COMMUNITY_POST') {
        const nextStatus = dto.action === 'HIDE_CONTENT' ? 'HIDDEN' : 'DELETED';
        await this.prisma.db.communityPost.update({
          where: { id: report.targetId },
          data: { status: nextStatus },
        });
      } else if (report.targetType === 'COMMENT') {
        const postC = await this.prisma.db.postComment.findUnique({ where: { id: report.targetId } });
        if (postC) {
          if (dto.action === 'HIDE_CONTENT') {
            await this.prisma.db.postComment.update({
              where: { id: report.targetId },
              data: { content: '[Bình luận đã bị ẩn bởi quản trị viên]' },
            });
          } else {
            await this.prisma.db.$transaction([
              this.prisma.db.postComment.delete({ where: { id: report.targetId } }),
              this.prisma.db.communityPost.update({
                where: { id: postC.postId },
                data: { commentCount: { decrement: 1 } },
              }),
            ]).catch(() => null);
          }
        } else {
          const artC = await this.prisma.db.articleComment.findUnique({ where: { id: report.targetId } });
          if (artC) {
            if (dto.action === 'HIDE_CONTENT') {
              await this.prisma.db.articleComment.update({
                where: { id: report.targetId },
                data: { content: '[Bình luận đã bị ẩn bởi quản trị viên]' },
              });
            } else {
              await this.prisma.db.$transaction([
                this.prisma.db.articleComment.delete({ where: { id: report.targetId } }),
                this.prisma.db.article.update({
                  where: { id: artC.articleId },
                  data: { commentCount: { decrement: 1 } },
                }),
              ]).catch(() => null);
            }
          }
        }
      }
      await this.prisma.db.moderationReport.updateMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: { in: ['OPEN', 'REVIEWING'] },
        },
        data: { status: 'RESOLVED' },
      });
      await this.writeAudit({
        actorUserId,
        targetType: report.targetType,
        targetId: report.targetId,
        action: dto.action === 'HIDE_CONTENT' ? 'CONTENT_HIDDEN' : 'CONTENT_DELETED',
        reasonCode: report.reasonCode,
        after: { note: dto.note ?? null },
      });
      return { id, status: 'RESOLVED', action: dto.action };
    }

    if (dto.action === 'WARN_USER' || dto.action === 'RESTRICT_USER') {
      if (!ownerUserId) throw new NotFoundException('Không tìm thấy chủ nội dung');

      if (dto.action === 'WARN_USER' && this.notifications) {
        await this.notifications.enqueueInAppNotification({
          userId: ownerUserId,
          type: 'SYSTEM',
          title: 'Cảnh báo vi phạm nội dung',
          body: dto.note?.trim() || 'Nội dung bạn đăng tải đã vi phạm tiêu chuẩn cộng đồng Mogu. Vui lòng tuân thủ quy tắc để tránh bị giới hạn tài khoản.',
        }).catch(() => null);
      }

      if (dto.action === 'RESTRICT_USER') {
        const existing = await this.prisma.db.accountRestriction.findFirst({
          where: { userId: ownerUserId, type: 'POLICY_SUSPENSION', status: 'ACTIVE' },
        });
        if (!existing) {
          await this.prisma.db.$transaction(async (tx) => {
            await tx.accountRestriction.create({
              data: {
                userId: ownerUserId,
                type: 'POLICY_SUSPENSION',
                status: 'ACTIVE',
                reasonCode: report.reasonCode,
                reasonNote: dto.note ?? 'Moderation restrict from report',
                startsAt: new Date(),
                createdBy: actorUserId,
              },
            });
            await tx.profile.update({
              where: { userId: ownerUserId },
              data: {
                accountStatus: AccountStatus.SUSPENDED,
                profileVersion: { increment: 1 },
              },
            });
          });
        }
      }
      await this.prisma.db.moderationReport.updateMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: { in: ['OPEN', 'REVIEWING'] },
        },
        data: { status: 'RESOLVED' },
      });
      await this.writeAudit({
        actorUserId,
        targetType: 'USER',
        targetId: ownerUserId,
        action: dto.action === 'WARN_USER' ? 'USER_WARNED' : 'USER_SUSPENDED',
        reasonCode: report.reasonCode,
        after: { note: dto.note ?? null, fromReportId: id },
      });
      return { id, status: 'RESOLVED', action: dto.action, userId: ownerUserId };
    }

    throw new BadRequestException('action không hợp lệ');
  }

  async adminListPosts(opts: {
    q?: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const where: any = {};
    if (opts.status) where.status = opts.status.toUpperCase();
    if (opts.q?.trim()) {
      where.content = { contains: opts.q.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.db.communityPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Batch load report counts by targetId
    const postIds = page.map((p) => p.id);
    const reportGroups = postIds.length
      ? await this.prisma.db.moderationReport.groupBy({
          by: ['targetId'],
          where: { targetType: 'COMMUNITY_POST', targetId: { in: postIds } },
          _count: { _all: true },
        })
      : [];
    const reportCountMap = new Map(reportGroups.map((g) => [g.targetId, g._count._all]));

    const data = page.map((p) => ({
      id: p.id,
      content: p.content,
      imageUrls: p.imageUrls,
      status: p.status,
      visibility: p.visibility,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
      author: p.author,
      reportCount: reportCountMap.get(p.id) ?? 0,
    }));
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async adminGetPost(id: string) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id },
      include: {
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    const reports = await this.prisma.db.moderationReport.findMany({
      where: { targetType: 'COMMUNITY_POST', targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reporter: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
    return {
      id: post.id,
      content: post.content,
      imageUrls: post.imageUrls,
      status: post.status,
      visibility: post.visibility,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      author: post.author,
      reports: reports.map((r) => ({
        id: r.id,
        reasonCode: r.reasonCode,
        reasonLabel: REASON_LABEL[r.reasonCode] ?? r.reasonCode,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt,
        reporter: r.reporter,
      })),
    };
  }

  async adminSetPostStatus(
    actorUserId: string,
    id: string,
    status: 'ACTIVE' | 'HIDDEN' | 'DELETED',
  ) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    const updated = await this.prisma.db.communityPost.update({
      where: { id },
      data: { status },
    });
    await this.writeAudit({
      actorUserId,
      targetType: 'COMMUNITY_POST',
      targetId: id,
      action:
        status === 'ACTIVE'
          ? 'CONTENT_RESTORED'
          : status === 'HIDDEN'
            ? 'CONTENT_HIDDEN'
            : 'CONTENT_DELETED',
      before: { status: post.status },
      after: { status },
    });
    return { id: updated.id, status: updated.status };
  }

  async adminExploreAnalytics(opts: { from?: string; to?: string }) {
    const to = opts.to ? new Date(opts.to) : new Date();
    const from = opts.from
      ? new Date(opts.from)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [postsTotal, articlesTotal, openReports, topArticles, engagementCount, postsInRange] =
      await Promise.all([
        this.prisma.db.communityPost.count({
          where: { createdAt: { gte: from, lte: to }, status: 'ACTIVE' },
        }),
        this.prisma.db.article.count({
          where: { createdAt: { gte: from, lte: to }, status: 'PUBLISHED' },
        }),
        this.prisma.db.moderationReport.count({
          where: { status: { in: ['OPEN', 'REVIEWING'] } },
        }),
        this.prisma.db.article.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: { likeCount: 'desc' },
          take: 5,
          select: { id: true, title: true, likeCount: true, commentCount: true, viewCount: true },
        }),
        Promise.resolve(0).then(async () => {
          try {
            return await (this.prisma.db as any).exploreEngagementEvent.count({
              where: { createdAt: { gte: from, lte: to } },
            });
          } catch {
            return 0;
          }
        }),
        this.prisma.db.communityPost.findMany({
          where: { createdAt: { gte: from, lte: to } },
          select: { createdAt: true },
        }),
      ]);

    const byDay = new Map<string, number>();
    for (const p of postsInRange) {
      const key = p.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const postsPerDay = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const totalContent = postsTotal + articlesTotal;
    const reportRate = totalContent > 0 ? openReports / totalContent : 0;

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      postsTotal,
      articlesTotal,
      openReports,
      engagementEvents: engagementCount,
      engagementApprox: engagementCount,
      topArticles,
      postsPerDay,
      totalPosts: postsTotal,
      totalArticles: articlesTotal,
      totalReports: openReports,
      impressions: engagementCount,
      reportRate,
      openDetails: articlesTotal,
      dau: Math.max(1, postsTotal),
      engagementDau: Math.max(1, postsTotal),
    };
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (!REPORT_REASONS.some((r) => r.code === dto.reasonCode)) {
      throw new BadRequestException('reasonCode không hợp lệ');
    }

    if (dto.targetType === 'COMMUNITY_POST') {
      const post = await this.prisma.db.communityPost.findUnique({
        where: { id: dto.targetId },
      });
      if (!post) throw new NotFoundException('Bài đăng không tồn tại');
      if (post.authorId === reporterId) {
        throw new ForbiddenException('Không thể báo cáo bài của chính mình');
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await this.prisma.db.moderationReport.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType as any,
        targetId: dto.targetId,
        reasonCode: dto.reasonCode,
        createdAt: { gte: since },
      },
    });
    if (dup) {
      return { reportId: dup.id, status: dup.status };
    }

    const created = await this.prisma.db.moderationReport.create({
      data: {
        reporterId,
        targetType: dto.targetType as any,
        targetId: dto.targetId,
        reasonCode: dto.reasonCode,
        note: dto.note ?? null,
      },
    });
    return { reportId: created.id, status: created.status };
  }

  private parseContentType(raw: string) {
    const t = raw.toUpperCase().replace(/-/g, '_');
    if (!['COMMUNITY_POST', 'DISH', 'ARTICLE'].includes(t)) {
      throw new BadRequestException('contentType không hợp lệ');
    }
    return t as 'COMMUNITY_POST' | 'DISH' | 'ARTICLE';
  }

  async hideContent(userId: string, contentType: string, contentId: string) {
    const type = this.parseContentType(contentType);
    await this.prisma.db.hiddenContent.upsert({
      where: {
        userId_contentType_contentId: {
          userId,
          contentType: type,
          contentId,
        },
      },
      create: { userId, contentType: type, contentId },
      update: {},
    });
    return { hidden: true };
  }

  async unhideContent(userId: string, contentType: string, contentId: string) {
    const type = this.parseContentType(contentType);
    await this.prisma.db.hiddenContent
      .delete({
        where: {
          userId_contentType_contentId: {
            userId,
            contentType: type,
            contentId,
          },
        },
      })
      .catch(() => null);
    return { hidden: false };
  }

  async createFeedback(userId: string, dto: RecommendationFeedbackDto) {
    if (dto.action === 'NOT_INTERESTED' || dto.action === 'HIDE_AUTHOR') {
      await this.hideContent(userId, dto.contentType, dto.contentId);
    }
    const row = await this.prisma.db.recommendationFeedback.create({
      data: {
        userId,
        contentType: dto.contentType as any,
        contentId: dto.contentId,
        action: dto.action as any,
        rankingToken: dto.rankingToken ?? null,
      },
    });
    return { id: row.id, ok: true };
  }

  getExplanation(contentType: string, contentId: string, rankingToken?: string) {
    const type = this.parseContentType(contentType);
    return {
      contentType: type,
      contentId,
      rankingToken: rankingToken ?? null,
      reasonCode: type === 'DISH' ? 'SIMILAR_SAVED' : 'RELATED_ENGAGEMENT',
      message: EXPLAIN[type] ?? 'Vì nội dung này phù hợp với sở thích của bạn trên Mogu',
    };
  }

  // ─── Admin Comment Moderation ──────────────────────────────────────────────
  async adminListComments(query: {
    type?: 'all' | 'article' | 'post';
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const type = query.type ?? 'all';
    const search = query.search?.trim();

    const whereContent = search ? { contains: search, mode: 'insensitive' as const } : undefined;

    let articleComments: any[] = [];
    let postComments: any[] = [];

    if (type === 'all' || type === 'article') {
      articleComments = await this.prisma.db.articleComment.findMany({
        where: whereContent ? { content: whereContent } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit + offset,
        include: {
          author: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
          article: { select: { id: true, title: true } },
          _count: { select: { likes: true, replies: true } },
        },
      });
    }

    if (type === 'all' || type === 'post') {
      postComments = await this.prisma.db.postComment.findMany({
        where: whereContent ? { content: whereContent } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit + offset,
        include: {
          author: { select: { id: true, userId: true, displayName: true, avatarUrl: true } },
          post: { select: { id: true, content: true } },
          _count: { select: { likes: true, replies: true } },
        },
      });
    }

    const items = [
      ...articleComments.map((c) => ({
        id: c.id,
        type: 'article' as const,
        content: c.content,
        targetId: c.articleId,
        targetTitle: c.article?.title ?? 'Bài viết',
        author: {
          userId: c.authorId,
          displayName: c.author?.displayName ?? 'Người dùng',
          avatarUrl: c.author?.avatarUrl,
        },
        likesCount: c._count?.likes ?? 0,
        repliesCount: c._count?.replies ?? 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        isHidden: c.content === '[Bình luận đã bị ẩn bởi quản trị viên]',
      })),
      ...postComments.map((c) => ({
        id: c.id,
        type: 'post' as const,
        content: c.content,
        targetId: c.postId,
        targetTitle: (c.post?.content || 'Bài đăng cộng đồng').slice(0, 50),
        author: {
          userId: c.authorId,
          displayName: c.author?.displayName ?? 'Người dùng',
          avatarUrl: c.author?.avatarUrl,
        },
        likesCount: c._count?.likes ?? 0,
        repliesCount: c._count?.replies ?? 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        isHidden: c.content === '[Bình luận đã bị ẩn bởi quản trị viên]',
      })),
    ];

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = items.slice(offset, offset + limit);
    return {
      items: page,
      total: items.length,
      hasMore: items.length > offset + limit,
    };
  }

  async adminHideComment(id: string) {
    const postC = await this.prisma.db.postComment.findUnique({ where: { id } });
    if (postC) {
      const isHidden = postC.content === '[Bình luận đã bị ẩn bởi quản trị viên]';
      const updated = await this.prisma.db.postComment.update({
        where: { id },
        data: {
          content: isHidden ? 'Bình luận đã được khôi phục' : '[Bình luận đã bị ẩn bởi quản trị viên]',
        },
      });
      return { id, isHidden: !isHidden, content: updated.content };
    }

    const artC = await this.prisma.db.articleComment.findUnique({ where: { id } });
    if (artC) {
      const isHidden = artC.content === '[Bình luận đã bị ẩn bởi quản trị viên]';
      const updated = await this.prisma.db.articleComment.update({
        where: { id },
        data: {
          content: isHidden ? 'Bình luận đã được khôi phục' : '[Bình luận đã bị ẩn bởi quản trị viên]',
        },
      });
      return { id, isHidden: !isHidden, content: updated.content };
    }

    throw new NotFoundException('Không tìm thấy bình luận');
  }

  async adminDeleteComment(id: string) {
    const postC = await this.prisma.db.postComment.findUnique({ where: { id } });
    if (postC) {
      await this.prisma.db.$transaction([
        this.prisma.db.postComment.delete({ where: { id } }),
        this.prisma.db.communityPost.update({
          where: { id: postC.postId },
          data: { commentCount: { decrement: 1 } },
        }),
      ]);
      return { id, deleted: true };
    }

    const artC = await this.prisma.db.articleComment.findUnique({ where: { id } });
    if (artC) {
      await this.prisma.db.$transaction([
        this.prisma.db.articleComment.delete({ where: { id } }),
        this.prisma.db.article.update({
          where: { id: artC.articleId },
          data: { commentCount: { decrement: 1 } },
        }),
      ]);
      return { id, deleted: true };
    }

    throw new NotFoundException('Không tìm thấy bình luận');
  }
}
