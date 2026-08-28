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

    const items = await this.prisma.db.communityPost.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      select: POST_SELECT,
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    // Lấy danh sách like của user hiện tại để đánh dấu isLiked
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
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    };
  }

  async createPost(authorId: string, dto: CreatePostDto) {
    return this.prisma.db.communityPost.create({
      data: {
        authorId,
        content: dto.content,
        imageUrls: dto.imageUrls ?? [],
      },
      select: POST_SELECT,
    });
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

    const [comment] = await this.prisma.db.$transaction([
      this.prisma.db.postComment.create({
        data: { postId, authorId, content: dto.content },
        select: {
          id: true,
          content: true,
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
}
