import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';

const ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverImageUrl: true,
  readMinutes: true,
  viewCount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { userId: true, displayName: true, avatarUrl: true } },
  topic: { select: { id: true, title: true, slug: true } },
  tags: { select: { tag: true } },
} as const;

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

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
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.db.article.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      select: { ...ARTICLE_SELECT, content: true },
    });
    if (!article) throw new NotFoundException('Bài viết không tồn tại');

    // Tăng view count (fire and forget)
    this.prisma.db.article
      .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return this.formatArticle(article as any);
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
        status: 'DRAFT',
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

  async publish(id: string) {
    const article = await this.getArticleOrThrow(id);
    const newStatus = article.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    return this.prisma.db.article.update({
      where: { id: article.id },
      data: { status: newStatus },
      select: ARTICLE_SELECT,
    });
  }

  async remove(id: string) {
    const article = await this.getArticleOrThrow(id);
    return this.prisma.db.article.delete({ where: { id: article.id } });
  }

  private async getArticleOrThrow(id: string) {
    const article = await this.prisma.db.article.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!article) throw new NotFoundException('Bài viết không tồn tại');
    return article;
  }

  private formatArticle(a: any) {
    return {
      ...a,
      tags: (a.tags || []).map((t: any) => t.tag),
    };
  }
}
