import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublic() {
    return this.prisma.db.topic.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImageUrl: true,
        displayOrder: true,
      },
    });
  }

  async findAllAdmin() {
    return this.prisma.db.topic.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { articles: true } },
      },
    });
  }

  async create(dto: CreateTopicDto) {
    const existing = await this.prisma.db.topic.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }
    return this.prisma.db.topic.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTopicDto) {
    await this.findOne(id);
    if (dto.slug) {
      const conflict = await this.prisma.db.topic.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }
    return this.prisma.db.topic.update({
      where: { id },
      data: {
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.db.topic.delete({ where: { id } });
  }

  async findOne(id: string) {
    const isId = isUUID(id);
    const topic = isId
      ? await this.prisma.db.topic.findUnique({ where: { id } })
      : await this.prisma.db.topic.findUnique({ where: { slug: id } });
    if (!topic) throw new NotFoundException(`Topic ${id} không tồn tại`);
    return topic;
  }

  async getFeedBySlug(slug: string, opts?: { cursor?: string; limit?: number }) {
    const isId = isUUID(slug);
    const topic = await this.prisma.db.topic.findFirst({
      where: {
        ...(isId ? { OR: [{ slug }, { id: slug }] } : { slug }),
        isActive: true,
      },
    });
    if (!topic) throw new NotFoundException('Chủ đề không tồn tại');
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 40);
    const rows = await this.prisma.db.article.findMany({
      where: { topicId: topic.id, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverImageUrl: true,
        readMinutes: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
        topic: { select: { id: true, title: true, slug: true } },
        tags: { select: { tag: true } },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      topic: {
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        coverImageUrl: topic.coverImageUrl,
      },
      data: page.map((a) => ({
        ...a,
        tags: a.tags.map((t) => t.tag),
        shareUrl: `${(process.env.PUBLIC_APP_URL ?? 'https://mogu.app').replace(/\/$/, '')}/explore/articles/${a.slug || a.id}`,
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }
}
