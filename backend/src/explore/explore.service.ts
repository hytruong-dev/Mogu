import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExploreService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(userId: string) {
    // Chạy 3 query song song
    const [topics, featuredArticle, recentPosts] = await Promise.all([
      // 3 topics nổi bật đang active
      this.prisma.db.topic.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          _count: { select: { articles: { where: { status: 'PUBLISHED' } } } },
        },
      }),

      // Bài viết published mới nhất, nổi bật
      this.prisma.db.article.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { viewCount: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          coverImageUrl: true,
          readMinutes: true,
          viewCount: true,
          createdAt: true,
          author: {
            select: { displayName: true, avatarUrl: true },
          },
          topic: { select: { id: true, title: true, slug: true } },
          tags: { select: { tag: true } },
        },
      }),

      // 5 posts cộng đồng mới nhất
      this.prisma.db.communityPost.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          imageUrls: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          author: {
            select: { userId: true, displayName: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return {
      topics: topics.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        coverImageUrl: t.coverImageUrl,
        articleCount: t._count.articles,
      })),
      featuredArticle: featuredArticle
        ? {
            ...featuredArticle,
            tags: featuredArticle.tags.map((t) => t.tag),
          }
        : null,
      recentPosts: recentPosts.map((p) => ({
        id: p.id,
        content: p.content,
        imageUrls: p.imageUrls,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        author: p.author,
      })),
    };
  }
}
