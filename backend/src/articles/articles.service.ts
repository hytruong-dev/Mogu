import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import {
  assertContentNotSpam,
  assertLikeRateLimit,
} from '../common/utils/content-spam';

const APP_BASE =
  process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://mogu.app';

const ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverImageUrl: true,
  readMinutes: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
  status: true,
  publishAt: true,
  isPinned: true,
  featuredAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { userId: true, displayName: true, avatarUrl: true } },
  topic: { select: { id: true, title: true, slug: true } },
  tags: { select: { tag: true } },
} as const;

@Injectable()
export class ArticlesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArticlesService.name);
  private publishInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Tự động kiểm tra và xuất bản các bài viết SCHEDULED khi đến publishAt (mỗi 2 phút)
    this.publishInterval = setInterval(() => {
      this.publishDueScheduledArticles().catch((err) => {
        this.logger.warn(`Failed to auto-publish scheduled articles: ${err}`);
      });
    }, 2 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
    }
  }

  async publishDueScheduledArticles() {
    const now = new Date();
    const result = await this.prisma.db.article.updateMany({
      where: {
        status: 'SCHEDULED' as any,
        publishAt: { lte: now },
      },
      data: {
        status: 'PUBLISHED',
      },
    });
    if (result.count > 0) {
      this.logger.log(`Auto-published ${result.count} scheduled article(s) at ${now.toISOString()}`);
    }
    return result.count;
  }

  private async notifySocial(
    actorId: string,
    recipientId: string,
    type: 'SOCIAL_LIKE' | 'SOCIAL_COMMENT' | 'SOCIAL_REPLY',
    bodySuffix: string,
    deepLink: string,
  ) {
    if (!recipientId || actorId === recipientId) return;
    const actor = await this.prisma.db.profile.findUnique({
      where: { userId: actorId },
      select: { displayName: true },
    });
    const name = actor?.displayName?.trim() || 'Ai đó';
    await this.notifications
      .enqueueInAppNotification({
        userId: recipientId,
        type,
        title: name,
        body: `${name} ${bodySuffix}`,
        deepLink,
      })
      .catch(() => null);
  }
  async list(dto: ListArticlesDto, onlyPublished = true) {
    const limit = Math.min(Number(dto.limit) || 20, 50);
    const where: any = {};

    if (onlyPublished) where.status = 'PUBLISHED';
    if (dto.topicId) where.topicId = dto.topicId;
    if (dto.tag) {
      where.tags = { some: { tag: dto.tag } };
    }
    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { summary: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    const cursor = dto.cursor
      ? { id: dto.cursor }
      : undefined;

    const items = await this.prisma.db.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      select: ARTICLE_SELECT,
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    return {
      data: data.map(this.formatArticle),
      items: data.map(this.formatArticle),
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
      pageInfo: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const isId = isUUID(id);
    const article = await this.prisma.db.article.findFirst({
      where: isId ? { OR: [{ id }, { slug: id }] } : { slug: id },
      select: { ...ARTICLE_SELECT, content: true },
    });
    if (!article) throw new NotFoundException('Bài viết không tồn tại');

    this.prisma.db.article
      .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    let isLiked = false;
    let isSaved = false;
    if (userId) {
      const [like, saved] = await Promise.all([
        this.prisma.db.articleLike.findUnique({
          where: { articleId_userId: { articleId: article.id, userId } },
        }),
        (this.prisma.db as any).savedArticle.findUnique({
          where: { userId_articleId: { userId, articleId: article.id } },
        }),
      ]);
      isLiked = Boolean(like);
      isSaved = Boolean(saved);
    }

    return {
      ...this.formatArticle(article as any),
      isLiked,
      isSaved,
      shareUrl: `${APP_BASE}/explore/articles/${article.slug || article.id}`,
    };
  }

  async create(authorId: string, dto: CreateArticleDto) {
    const existing = await this.prisma.db.article.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);

    return this.prisma.db.article.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        readMinutes: dto.readMinutes ?? 3,
        status: dto.publishAt && new Date(dto.publishAt).getTime() > Date.now()
          ? ('SCHEDULED' as any)
          : 'DRAFT',
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        authorId,
        topicId: dto.topicId,
        tags: {
          create: (dto.tags ?? []).map((tag) => ({ tag })),
        },
      },
      select: ARTICLE_SELECT,
    });
  }

  async update(id: string, userId: string, dto: UpdateArticleDto, isAdmin = false) {
    const article = await this.getArticleOrThrow(id);
    if (!isAdmin && article.authorId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
    }

    const { tags, ...rest } = dto;

    return this.prisma.db.article.update({
      where: { id: article.id },
      data: {
        ...rest,
        ...(tags !== undefined && {
          tags: {
            deleteMany: {},
            create: tags.map((tag) => ({ tag })),
          },
        }),
      },
      select: ARTICLE_SELECT,
    });
  }

  async publish(id: string, opts?: { publishAt?: string | Date | null; schedule?: boolean }) {
    const article = await this.getArticleOrThrow(id);

    // Explicit schedule
    if (opts?.schedule || opts?.publishAt) {
      const when = opts.publishAt ? new Date(opts.publishAt) : article.publishAt;
      if (!when || Number.isNaN(when.getTime())) {
        throw new BadRequestException('publishAt không hợp lệ để lên lịch');
      }
      if (when.getTime() > Date.now()) {
        return this.prisma.db.article.update({
          where: { id: article.id },
          data: { status: 'SCHEDULED' as any, publishAt: when },
          select: ARTICLE_SELECT,
        });
      }
      // Due now → publish immediately
      return this.prisma.db.article.update({
        where: { id: article.id },
        data: { status: 'PUBLISHED', publishAt: when },
        select: ARTICLE_SELECT,
      });
    }

    // Toggle publish/archive; also allow SCHEDULED → PUBLISHED when due
    if (article.status === 'SCHEDULED') {
      const due =
        !article.publishAt || new Date(article.publishAt).getTime() <= Date.now();
      if (!due) {
        throw new BadRequestException('Bài viết chưa đến giờ đăng');
      }
      return this.prisma.db.article.update({
        where: { id: article.id },
        data: { status: 'PUBLISHED' },
        select: ARTICLE_SELECT,
      });
    }

    const newStatus = article.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    return this.prisma.db.article.update({
      where: { id: article.id },
      data: {
        status: newStatus,
        ...(newStatus === 'PUBLISHED' && !article.publishAt
          ? { publishAt: new Date() }
          : {}),
      },
      select: ARTICLE_SELECT,
    });
  }

  async togglePin(id: string, explicitPinned?: boolean) {
    const article = await this.getArticleOrThrow(id);
    const isPinned = typeof explicitPinned === 'boolean' ? explicitPinned : !article.isPinned;
    return this.prisma.db.article.update({
      where: { id: article.id },
      data: {
        isPinned,
        featuredAt: isPinned ? new Date() : null,
      },
      select: ARTICLE_SELECT,
    });
  }

  async remove(id: string) {
    const article = await this.getArticleOrThrow(id);
    return this.prisma.db.article.delete({ where: { id: article.id } });
  }

  async saveArticle(userId: string, articleId: string) {
    const article = await this.getArticleOrThrow(articleId);
    await (this.prisma.db as any).savedArticle.upsert({
      where: { userId_articleId: { userId, articleId: article.id } },
      create: { userId, articleId: article.id },
      update: {},
    });
    return { saved: true };
  }

  async unsaveArticle(userId: string, articleId: string) {
    const article = await this.getArticleOrThrow(articleId);
    await (this.prisma.db as any).savedArticle
      .delete({ where: { userId_articleId: { userId, articleId: article.id } } })
      .catch(() => null);
    return { saved: false };
  }

  async toggleLike(articleId: string, userId: string) {
    assertLikeRateLimit(userId);
    const article = await this.getArticleOrThrow(articleId);
    const existing = await this.prisma.db.articleLike.findUnique({
      where: { articleId_userId: { articleId: article.id, userId } },
    });
    if (existing) {
      await this.prisma.db.articleLike.delete({
        where: { articleId_userId: { articleId: article.id, userId } },
      });
      const updated = await this.prisma.db.article.update({
        where: { id: article.id },
        data: { likeCount: { decrement: 1 } },
      });
      return { liked: false, likeCount: Math.max(0, updated.likeCount) };
    }
    await this.prisma.db.articleLike.create({
      data: { articleId: article.id, userId },
    });
    const updated = await this.prisma.db.article.update({
      where: { id: article.id },
      data: { likeCount: { increment: 1 } },
    });
    void this.notifySocial(
      userId,
      article.authorId,
      'SOCIAL_LIKE',
      'đã thích bài viết của bạn',
      `mogu://explore/articles/${article.id}`,
    );
    return { liked: true, likeCount: updated.likeCount };
  }

  async listComments(
    articleId: string,
    opts?: { cursor?: string; limit?: number; sort?: string; userId?: string },
  ) {
    const article = await this.getArticleOrThrow(articleId);
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);
    const sortAsc = (opts?.sort ?? 'oldest').toLowerCase() !== 'newest';
    const rows = await this.prisma.db.articleComment.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: sortAsc ? 'asc' : 'desc' },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
        _count: { select: { likes: true } },
      },
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    let likedIds = new Set<string>();
    if (opts?.userId && data.length) {
      const likes = await (this.prisma.db as any).articleCommentLike.findMany({
        where: {
          userId: opts.userId,
          commentId: { in: data.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      likedIds = new Set(likes.map((l: any) => l.commentId));
    }
    return {
      data: data.map((c) => ({
        id: c.id,
        content: c.content,
        parentCommentId: c.parentCommentId,
        createdAt: c.createdAt,
        author: c.author,
        likeCount: c._count.likes,
        isLiked: likedIds.has(c.id),
      })),
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async toggleCommentLike(articleId: string, commentId: string, userId: string) {
    assertLikeRateLimit(userId);
    const article = await this.getArticleOrThrow(articleId);
    const comment = await this.prisma.db.articleComment.findFirst({
      where: { id: commentId, articleId: article.id },
    });
    if (!comment) throw new NotFoundException('Bình luận không tồn tại');
    const existing = await (this.prisma.db as any).articleCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing) {
      await (this.prisma.db as any).articleCommentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      });
    } else {
      await (this.prisma.db as any).articleCommentLike.create({
        data: { commentId, userId },
      });
      if (comment.authorId !== userId) {
        void this.notifySocial(
          userId,
          comment.authorId,
          'SOCIAL_LIKE',
          'đã thích bình luận của bạn',
          `mogu://explore/articles/${article.id}`,
        );
      }
    }
    const likeCount = await (this.prisma.db as any).articleCommentLike.count({
      where: { commentId },
    });
    return { isLiked: !existing, likeCount };
  }

  async deleteComment(articleId: string, commentId: string, userId: string) {
    const article = await this.getArticleOrThrow(articleId);
    const comment = await this.prisma.db.articleComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.articleId !== article.id) {
      throw new NotFoundException('Bình luận không tồn tại');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Không có quyền xóa bình luận này');
    }
    await this.prisma.db.$transaction([
      this.prisma.db.articleComment.delete({ where: { id: commentId } }),
      this.prisma.db.article.update({
        where: { id: article.id },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
    return { deleted: true };
  }

  async addComment(
    articleId: string,
    authorId: string,
    content: string,
    parentCommentId?: string,
  ) {
    const article = await this.getArticleOrThrow(articleId);
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('Nội dung bình luận trống');
    assertContentNotSpam(trimmed, 'Bình luận');

    if (parentCommentId) {
      const parent = await this.prisma.db.articleComment.findFirst({
        where: { id: parentCommentId, articleId: article.id },
      });
      if (!parent) throw new NotFoundException('Bình luận gốc không tồn tại');
    }

    const created = await this.prisma.db.$transaction(async (tx) => {
      const comment = await tx.articleComment.create({
        data: {
          articleId: article.id,
          authorId,
          content: trimmed,
          parentCommentId: parentCommentId ?? null,
        },
        select: {
          id: true,
          content: true,
          parentCommentId: true,
          createdAt: true,
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
        },
      });
      await tx.article.update({
        where: { id: article.id },
        data: { commentCount: { increment: 1 } },
      });
      return comment;
    });
    const deepLink = `mogu://explore/articles/${article.id}`;
    if (parentCommentId) {
      const parent = await this.prisma.db.articleComment.findUnique({
        where: { id: parentCommentId },
        select: { authorId: true },
      });
      if (parent) {
        void this.notifySocial(
          authorId,
          parent.authorId,
          'SOCIAL_REPLY',
          'đã trả lời bình luận của bạn',
          deepLink,
        );
      }
    } else {
      void this.notifySocial(
        authorId,
        article.authorId,
        'SOCIAL_COMMENT',
        'đã bình luận bài viết của bạn',
        deepLink,
      );
    }
    return { ...created, likeCount: 0, isLiked: false };
  }

  private async getArticleOrThrow(id: string) {
    const isId = isUUID(id);
    const article = await this.prisma.db.article.findFirst({
      where: isId ? { OR: [{ id }, { slug: id }] } : { slug: id },
    });
    if (!article) throw new NotFoundException('Bài viết không tồn tại');
    return article;
  }

  private formatArticle(a: any) {
    return {
      ...a,
      tags: (a.tags || []).map((t: any) => t.tag),
      likeCount: a.likeCount ?? 0,
      commentCount: a.commentCount ?? 0,
      shareUrl: `${APP_BASE}/explore/articles/${a.slug || a.id}`,
    };
  }

  async listSavedArticles(userId: string, cursor?: string, limit = 20, q?: string) {
    const take = Math.min(Number(limit) || 20, 50);
    const rows = await this.prisma.db.savedArticle.findMany({
      where: {
        userId,
        ...(cursor ? { id: { lt: cursor } } : {}),
        ...(q
          ? {
              article: {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { summary: { contains: q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        article: { select: ARTICLE_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const hasNextPage = rows.length > take;
    const data = hasNextPage ? rows.slice(0, take) : rows;
    const articles = data.map((r) =>
      this.formatArticle({ ...r.article, isSaved: true }),
    );
    return {
      items: data.map((r, i) => ({
        id: r.id,
        savedAt: r.createdAt,
        article: articles[i],
      })),
      data: articles,
      pageInfo: {
        nextCursor: hasNextPage ? data[data.length - 1]?.id : null,
        hasNextPage,
      },
      nextCursor: hasNextPage ? data[data.length - 1]?.id : null,
      hasMore: hasNextPage,
    };
  }
}
