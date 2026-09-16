import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListPostsDto } from './dto/list-posts.dto';

const POST_SELECT = {
  id: true,
  content: true,
  imageUrls: true,
  likeCount: true,
  commentCount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { userId: true, displayName: true, avatarUrl: true } },
} as const;

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Posts ───────────────────────────────────────────────────────────────
  async listPosts(dto: ListPostsDto, userId: string) {
    const limit = Math.min(Number(dto.limit) || 20, 50);
    const cursor = dto.cursor ? { id: dto.cursor } : undefined;
    const scope = (dto.scope ?? '').toUpperCase();
    const statusFilter = (dto.status ?? '').toUpperCase();

    const where: any = {};
    if (scope === 'ME') {
      where.authorId = userId;
      if (statusFilter === 'DRAFT') where.status = 'DRAFT';
      else if (statusFilter === 'ACTIVE' || statusFilter === 'PUBLISHED') where.status = 'ACTIVE';
      else if (statusFilter === 'ALL') {
        where.status = { in: ['ACTIVE', 'DRAFT', 'HIDDEN'] };
      } else {
        where.status = { in: ['ACTIVE', 'DRAFT'] };
      }
    } else {
      where.status = 'ACTIVE';
    }
    if (dto.q?.trim()) {
      where.content = { contains: dto.q.trim(), mode: 'insensitive' };
    }

    const items = await this.prisma.db.communityPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      select: POST_SELECT,
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    const likedSet = new Set<string>();
    if (data.length > 0) {
      const ids = data.map((p) => p.id);
      const likes = await this.prisma.db.postLike.findMany({
        where: { userId, postId: { in: ids } },
        select: { postId: true },
      });
      likes.forEach((l) => likedSet.add(l.postId));
    }

    return {
      data: data.map((p) => ({ ...p, isLiked: likedSet.has(p.id) })),
      items: data.map((p) => ({ ...p, isLiked: likedSet.has(p.id) })),
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
      pageInfo: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
        hasNextPage: hasMore,
      },
    };
  }

  async getPostById(id: string, userId: string) {
    const post = await this.prisma.db.communityPost.findFirst({
      where: { id, status: 'ACTIVE' },
      select: POST_SELECT,
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    const like = await this.prisma.db.postLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
      select: { postId: true },
    });

    return { ...post, isLiked: Boolean(like) };
  }

  async createPost(authorId: string, dto: CreatePostDto) {
    return this.prisma.db.communityPost.create({
      data: {
        authorId,
        content: dto.content,
        imageUrls: dto.imageUrls ?? [],
        status: dto.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
      },
      select: POST_SELECT,
    });
  }

  async updatePost(
    id: string,
    userId: string,
    dto: { content?: string; imageUrls?: string[]; status?: string },
  ) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    if (post.authorId !== userId) throw new ForbiddenException('Không có quyền sửa');

    const status =
      dto.status === 'DRAFT'
        ? 'DRAFT'
        : dto.status === 'ACTIVE' || dto.status === 'PUBLISHED'
          ? 'ACTIVE'
          : undefined;

    return this.prisma.db.communityPost.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
        ...(status ? { status: status as any } : {}),
      },
      select: POST_SELECT,
    });
  }

  async listSavedPosts(userId: string, cursor?: string, limit = 20, q?: string) {
    const take = Math.min(Number(limit) || 20, 50);
    const rows = await this.prisma.db.savedPost.findMany({
      where: {
        userId,
        ...(cursor ? { id: { lt: cursor } } : {}),
        ...(q
          ? { post: { content: { contains: q, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        post: { select: POST_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const hasNextPage = rows.length > take;
    const data = hasNextPage ? rows.slice(0, take) : rows;
    return {
      items: data.map((r) => ({
        id: r.id,
        savedAt: r.createdAt,
        post: r.post,
      })),
      pageInfo: {
        nextCursor: hasNextPage ? data[data.length - 1]?.id : null,
        hasNextPage,
      },
    };
  }

  async deletePost(id: string, userId: string) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    if (post.authorId !== userId) throw new ForbiddenException('Không có quyền xóa');
    return this.prisma.db.communityPost.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }

  // ─── Likes ────────────────────────────────────────────────────────────────
  async toggleLike(postId: string, userId: string) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    const existing = await this.prisma.db.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      // Unlike
      await this.prisma.db.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      await this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      // Like
      await this.prisma.db.postLike.create({ data: { postId, userId } });
      await this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
      return { liked: true };
    }
  }

  async likePost(postId: string, userId: string) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    const existing = await this.prisma.db.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (!existing) {
      await this.prisma.db.postLike.create({ data: { postId, userId } });
      await this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
    }

    return { liked: true };
  }

  async unlikePost(postId: string, userId: string) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    const existing = await this.prisma.db.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await this.prisma.db.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      await this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
    }

    return { liked: false };
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  async listComments(postId: string) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    return this.prisma.db.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
      },
    });
  }

  async addComment(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    if (dto.parentCommentId) {
      const parent = await this.prisma.db.postComment.findFirst({
        where: { id: dto.parentCommentId, postId },
      });
      if (!parent) throw new NotFoundException('Bình luận gốc không tồn tại');
    }

    const [comment] = await this.prisma.db.$transaction([
      this.prisma.db.postComment.create({
        data: {
          postId,
          authorId,
          content: dto.content,
          parentCommentId: dto.parentCommentId ?? null,
        },
        select: {
          id: true,
          content: true,
          parentCommentId: true,
          createdAt: true,
          author: { select: { userId: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    return comment;
  }

  async deleteComment(postId: string, commentId: string, userId: string) {
    const comment = await this.prisma.db.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Bình luận không tồn tại');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Không có quyền xóa bình luận này');
    }

    await this.prisma.db.$transaction([
      this.prisma.db.postComment.delete({ where: { id: commentId } }),
      this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    return { deleted: true };
  }

  // ─── Follow / Save ────────────────────────────────────────────────────────
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ForbiddenException('Không thể theo dõi chính mình');
    }
    const target = await this.prisma.db.profile.findUnique({
      where: { userId: followingId },
    });
    if (!target) throw new NotFoundException('Người dùng không tồn tại');

    await (this.prisma.db as any).userFollow.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      create: { followerId, followingId },
      update: {},
    });
    return { following: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    await (this.prisma.db as any).userFollow
      .delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      .catch(() => null);
    return { following: false };
  }

  async savePost(userId: string, postId: string) {
    const post = await this.prisma.db.communityPost.findFirst({
      where: { id: postId, status: 'ACTIVE' },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    await (this.prisma.db as any).savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
    return { saved: true };
  }

  async unsavePost(userId: string, postId: string) {
    await (this.prisma.db as any).savedPost
      .delete({ where: { userId_postId: { userId, postId } } })
      .catch(() => null);
    return { saved: false };
  }
}
