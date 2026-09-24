import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateCommunityMediaIntentDto,
  CreatePostDto,
  UpdatePostDto,
} from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import {
  assertContentNotSpam,
  assertLikeRateLimit,
  parseHashtags,
} from '../common/utils/content-spam';

const APP_BASE =
  process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://mogu.app';

const POST_INCLUDE = {
  author: { select: { userId: true, displayName: true, avatarUrl: true } },
  dish: {
    select: {
      id: true,
      name: true,
      slug: true,
      prepMinutes: true,
      cookMinutes: true,
      priceMin: true,
      priceMax: true,
      status: true,
      media: {
        where: { isPrimary: true },
        take: 1,
        select: { storageKey: true, bucket: true },
      },
    },
  },
  place: {
    select: {
      id: true,
      provider: true,
      providerPlaceId: true,
      name: true,
      addressShort: true,
      lat: true,
      lng: true,
      thumbnailUrl: true,
    },
  },
  mediaLinks: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      media: {
        select: {
          id: true,
          publicUrl: true,
          mimeType: true,
          width: true,
          height: true,
          altText: true,
          status: true,
          bucket: true,
          objectKey: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.mediaBucket =
      this.config.get<string>('SUPABASE_COMMUNITY_BUCKET') ??
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') ??
      'dish-images';
    this.supabase =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  private publicUrl(bucket: string, objectKey: string) {
    const base =
      this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '') ??
      'https://placeholder.supabase.co';
    return `${base}/storage/v1/object/public/${bucket}/${objectKey}`;
  }

  private dishThumb(dish: any): string | null {
    if (!dish) return null;
    const m = dish.media?.[0];
    if (!m?.storageKey) return null;
    return this.publicUrl(m.bucket || 'dish-images', m.storageKey);
  }

  private mapMedia(post: any) {
    const links = post.mediaLinks ?? [];
    if (links.length > 0) {
      return links.map((l: any, i: number) => ({
        id: l.media.id,
        url: l.media.publicUrl ?? this.publicUrl(l.media.bucket, l.media.objectKey),
        mimeType: l.media.mimeType,
        width: l.media.width,
        height: l.media.height,
        altText: l.altText ?? l.media.altText,
        sortOrder: l.sortOrder ?? i,
      }));
    }
    return (post.imageUrls ?? []).map((url: string, i: number) => ({
      id: `legacy-${i}`,
      url,
      mimeType: 'image/jpeg',
      width: null,
      height: null,
      altText: null,
      sortOrder: i,
    }));
  }

  private viewerCapabilities(post: any, userId: string) {
    const isOwner = post.authorId === userId || post.author?.userId === userId;
    return {
      canEdit: isOwner,
      canDelete: isOwner,
      canReport: !isOwner,
      canComment: post.commentsEnabled !== false && post.status === 'ACTIVE',
      canChangeVisibility: isOwner,
    };
  }

  toCanonicalPost(
    post: any,
    opts: {
      userId: string;
      isLiked?: boolean;
      isSaved?: boolean;
      isFollowingAuthor?: boolean;
    },
  ) {
    const media = this.mapMedia(post);
    const imageUrls =
      media.length > 0 ? media.map((m: any) => m.url) : (post.imageUrls ?? []);
    return {
      id: post.id,
      content: post.content,
      imageUrls,
      media,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      status: post.status,
      visibility: post.visibility ?? 'PUBLIC',
      commentsEnabled: post.commentsEnabled ?? true,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      dish: post.dish
        ? {
            id: post.dish.id,
            name: post.dish.name,
            slug: post.dish.slug,
            thumbnailUrl: this.dishThumb(post.dish),
            prepMinutes: post.dish.prepMinutes,
            priceMin: post.dish.priceMin,
            priceMax: post.dish.priceMax,
            status: post.dish.status,
          }
        : null,
      place: post.place
        ? {
            id: post.place.id,
            provider: post.place.provider,
            providerPlaceId: post.place.providerPlaceId,
            name: post.place.name,
            addressShort: post.place.addressShort,
            lat: post.place.lat != null ? Number(post.place.lat) : null,
            lng: post.place.lng != null ? Number(post.place.lng) : null,
            thumbnailUrl: post.place.thumbnailUrl,
          }
        : null,
      isLiked: Boolean(opts.isLiked),
      isSaved: Boolean(opts.isSaved),
      isFollowingAuthor: Boolean(opts.isFollowingAuthor),
      viewerCapabilities: this.viewerCapabilities(post, opts.userId),
      shareUrl: `${APP_BASE}/community/posts/${post.id}`,
    };
  }

  private async visibilityWhere(userId: string, scope?: string) {
    const following = await this.prisma.db.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    if ((scope ?? '').toUpperCase() === 'FOLLOWING') {
      return {
        status: 'ACTIVE' as const,
        authorId: { in: followingIds.length ? followingIds : ['00000000-0000-0000-0000-000000000000'] },
        OR: [
          { visibility: 'PUBLIC' as const },
          { visibility: 'FOLLOWERS' as const },
          { authorId: userId, visibility: { in: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as any } },
        ],
      };
    }

    return {
      status: 'ACTIVE' as const,
      OR: [
        { visibility: 'PUBLIC' as const },
        { visibility: 'FOLLOWERS' as const, authorId: { in: [...followingIds, userId] } },
        { visibility: 'PRIVATE' as const, authorId: userId },
      ],
    };
  }

  private async enrichFlags(posts: any[], userId: string) {
    if (!posts.length) return [];
    const ids = posts.map((p) => p.id);
    const authorIds = [...new Set(posts.map((p) => p.author?.userId ?? p.authorId))];
    const [likes, saves, follows, hidden] = await Promise.all([
      this.prisma.db.postLike.findMany({
        where: { userId, postId: { in: ids } },
        select: { postId: true },
      }),
      this.prisma.db.savedPost.findMany({
        where: { userId, postId: { in: ids } },
        select: { postId: true },
      }),
      this.prisma.db.userFollow.findMany({
        where: { followerId: userId, followingId: { in: authorIds } },
        select: { followingId: true },
      }),
      this.prisma.db.hiddenContent.findMany({
        where: {
          userId,
          contentType: 'COMMUNITY_POST',
          contentId: { in: ids },
        },
        select: { contentId: true },
      }),
    ]);
    const liked = new Set(likes.map((l) => l.postId));
    const saved = new Set(saves.map((s) => s.postId));
    const following = new Set(follows.map((f) => f.followingId));
    const hiddenIds = new Set(hidden.map((h) => h.contentId));

    return posts
      .filter((p) => !hiddenIds.has(p.id))
      .map((p) =>
        this.toCanonicalPost(p, {
          userId,
          isLiked: liked.has(p.id),
          isSaved: saved.has(p.id),
          isFollowingAuthor: following.has(p.author?.userId ?? p.authorId),
        }),
      );
  }

  async listPosts(dto: ListPostsDto, userId: string) {
    const limit = Math.min(Number(dto.limit) || 20, 50);
    const cursor = dto.cursor ? { id: dto.cursor } : undefined;
    const scope = (dto.scope ?? '').toUpperCase();
    const statusFilter = (dto.status ?? '').toUpperCase();

    let where: any;
    if (scope === 'ME') {
      where = { authorId: userId };
      if (statusFilter === 'DRAFT') where.status = 'DRAFT';
      else if (statusFilter === 'ACTIVE' || statusFilter === 'PUBLISHED') where.status = 'ACTIVE';
      else if (statusFilter === 'ALL') where.status = { in: ['ACTIVE', 'DRAFT', 'HIDDEN'] };
      else where.status = { in: ['ACTIVE', 'DRAFT'] };
    } else {
      where = await this.visibilityWhere(userId, scope);
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
      include: POST_INCLUDE,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const data = await this.enrichFlags(page, userId);

    return {
      data,
      items: data,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
      pageInfo: {
        nextCursor: hasMore ? page[page.length - 1].id : null,
        hasMore,
        hasNextPage: hasMore,
      },
    };
  }

  async getPostById(id: string, userId: string) {
    const post = await this.prisma.db.communityPost.findFirst({
      where: { id, status: { in: ['ACTIVE', 'DRAFT'] } },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');

    const vis = post.visibility ?? 'PUBLIC';
    const isOwner = post.authorId === userId;
    if (!isOwner) {
      if (vis === 'PRIVATE') throw new NotFoundException('Bài đăng không tồn tại');
      if (vis === 'FOLLOWERS') {
        const follow = await this.prisma.db.userFollow.findUnique({
          where: {
            followerId_followingId: { followerId: userId, followingId: post.authorId },
          },
        });
        if (!follow) throw new NotFoundException('Bài đăng không tồn tại');
      }
      if (post.status !== 'ACTIVE') throw new NotFoundException('Bài đăng không tồn tại');
    }

    const [like, save, follow] = await Promise.all([
      this.prisma.db.postLike.findUnique({
        where: { postId_userId: { postId: id, userId } },
      }),
      this.prisma.db.savedPost.findUnique({
        where: { userId_postId: { userId, postId: id } },
      }),
      this.prisma.db.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: post.authorId,
          },
        },
      }),
    ]);

    return this.toCanonicalPost(post, {
      userId,
      isLiked: Boolean(like),
      isSaved: Boolean(save),
      isFollowingAuthor: Boolean(follow),
    });
  }

  private async assertReadyMedia(ownerId: string, mediaIds: string[]) {
    if (!mediaIds.length) return [];
    if (mediaIds.length > 5) {
      throw new BadRequestException('Tối đa 5 ảnh mỗi bài đăng');
    }
    const rows = await this.prisma.db.communityMedia.findMany({
      where: { id: { in: mediaIds }, ownerId },
    });
    if (rows.length !== mediaIds.length) {
      throw new BadRequestException('Một số media không tồn tại hoặc không thuộc về bạn');
    }
    for (const m of rows) {
      if (m.status !== 'READY') {
        throw new BadRequestException(`Media ${m.id} chưa sẵn sàng (status=${m.status})`);
      }
    }
    return mediaIds;
  }

  async createPost(authorId: string, dto: CreatePostDto) {
    if (dto.clientRequestId) {
      const existing = await this.prisma.db.communityPost.findUnique({
        where: { clientRequestId: dto.clientRequestId },
        include: POST_INCLUDE,
      });
      if (existing) {
        return this.toCanonicalPost(existing, { userId: authorId });
      }
    }

    assertContentNotSpam(dto.content, 'Bài đăng');

    const mediaIds = await this.assertReadyMedia(authorId, dto.mediaIds ?? []);
    const legacyUrls =
      mediaIds.length === 0
        ? dto.imageUrls ?? []
        : (
            await this.prisma.db.communityMedia.findMany({
              where: { id: { in: mediaIds } },
            })
          ).map((m) => m.publicUrl ?? this.publicUrl(m.bucket, m.objectKey));

    if (dto.dishId) {
      const dish = await this.prisma.db.dish.findFirst({
        where: { id: dto.dishId, status: 'PUBLISHED', deletedAt: null },
      });
      if (!dish) throw new BadRequestException('Món ăn không hợp lệ');
    }
    if (dto.placeId) {
      const place = await this.prisma.db.place.findUnique({ where: { id: dto.placeId } });
      if (!place) throw new BadRequestException('Địa điểm không hợp lệ');
    }

    const hashtags = parseHashtags(dto.content);

    const post = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.communityPost.create({
        data: {
          authorId,
          content: dto.content.trim(),
          imageUrls: legacyUrls,
          status: dto.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
          visibility: dto.visibility ?? 'PUBLIC',
          commentsEnabled: dto.commentsEnabled ?? true,
          dishId: dto.dishId ?? null,
          placeId: dto.placeId ?? null,
          clientRequestId: dto.clientRequestId ?? null,
        },
      });
      if (mediaIds.length) {
        await tx.communityPostMedia.createMany({
          data: mediaIds.map((mediaId, sortOrder) => ({
            postId: created.id,
            mediaId,
            sortOrder,
          })),
        });
      }
      if (hashtags.length) {
        await (tx as any).postTag.createMany({
          data: hashtags.map((tag) => ({ postId: created.id, tag })),
          skipDuplicates: true,
        });
      }
      return tx.communityPost.findUniqueOrThrow({
        where: { id: created.id },
        include: POST_INCLUDE,
      });
    });

    return this.toCanonicalPost(post, { userId: authorId });
  }

  async updatePost(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    if (post.authorId !== userId) throw new ForbiddenException('Không có quyền sửa');

    const status =
      dto.status === 'DRAFT'
        ? 'DRAFT'
        : dto.status === 'ACTIVE'
          ? 'ACTIVE'
          : undefined;

    let legacyUrls: string[] | undefined;
    if (dto.mediaIds) {
      const mediaIds = await this.assertReadyMedia(userId, dto.mediaIds);
      const medias = await this.prisma.db.communityMedia.findMany({
        where: { id: { in: mediaIds } },
      });
      legacyUrls = medias.map((m) => m.publicUrl ?? this.publicUrl(m.bucket, m.objectKey));
      await this.prisma.db.communityPostMedia.deleteMany({ where: { postId: id } });
      if (mediaIds.length) {
        await this.prisma.db.communityPostMedia.createMany({
          data: mediaIds.map((mediaId, sortOrder) => ({
            postId: id,
            mediaId,
            sortOrder,
          })),
        });
      }
    }

    const updated = await this.prisma.db.communityPost.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
        ...(legacyUrls !== undefined ? { imageUrls: legacyUrls } : {}),
        ...(status ? { status: status as any } : {}),
        ...(dto.visibility ? { visibility: dto.visibility as any } : {}),
        ...(dto.commentsEnabled !== undefined
          ? { commentsEnabled: dto.commentsEnabled }
          : {}),
        ...(dto.dishId !== undefined ? { dishId: dto.dishId } : {}),
        ...(dto.placeId !== undefined ? { placeId: dto.placeId } : {}),
      },
      include: POST_INCLUDE,
    });

    return this.toCanonicalPost(updated, { userId });
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
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const hasNextPage = rows.length > take;
    const data = hasNextPage ? rows.slice(0, take) : rows;
    return {
      items: data.map((r) => ({
        id: r.id,
        savedAt: r.createdAt,
        post: this.toCanonicalPost(r.post, { userId, isSaved: true }),
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

  // ─── Media upload ─────────────────────────────────────────────────────────
  async createMediaUploadIntent(userId: string, dto: CreateCommunityMediaIntentDto) {
    const mimeType =
      dto.mimeType === 'image/jpg' ? 'image/jpeg' : dto.mimeType?.toLowerCase?.() ?? dto.mimeType;
    const imageAllowed = ['image/jpeg', 'image/png', 'image/webp'];
    const videoAllowed = ['video/mp4', 'video/quicktime'];
    const isVideo = videoAllowed.includes(mimeType);
    if (![...imageAllowed, ...videoAllowed].includes(mimeType)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG/PNG/WebP hoặc video/mp4, video/quicktime');
    }
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!Number.isFinite(dto.sizeBytes) || dto.sizeBytes < 1 || dto.sizeBytes > maxBytes) {
      throw new BadRequestException(isVideo ? 'Video tối đa 50MiB' : 'Ảnh tối đa 5MiB');
    }

    const mediaId = randomUUID();
    const ext =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'video/mp4'
            ? 'mp4'
            : mimeType === 'video/quicktime'
              ? 'mov'
              : 'jpg';
    const objectKey = `community/${userId}/${mediaId}.${ext}`;
    const supabaseUrl =
      this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '') ??
      'https://placeholder.supabase.co';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${this.mediaBucket}/${objectKey}?token=stub`;
    if (this.supabase) {
      const { data, error } = await this.supabase.storage
        .from(this.mediaBucket)
        .createSignedUploadUrl(objectKey, { upsert: true });
      if (error || !data?.signedUrl) {
        this.logger.error(`Community media presign failed: ${JSON.stringify(error)}`);
        throw new BadRequestException('Không tạo được URL upload media');
      }
      uploadUrl = data.signedUrl;
    }

    const media = await this.prisma.db.communityMedia.create({
      data: {
        id: mediaId,
        ownerId: userId,
        bucket: this.mediaBucket,
        objectKey,
        mimeType,
        sizeBytes: dto.sizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        checksum: dto.checksum ?? null,
        status: 'UPLOAD_PENDING',
        expiresAt,
      },
    });

    return {
      mediaId: media.id,
      uploadUrl,
      bucket: this.mediaBucket,
      objectKey,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async finalizeMedia(userId: string, mediaId: string) {
    const media = await this.prisma.db.communityMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.ownerId !== userId) {
      throw new NotFoundException('Media không tồn tại');
    }
    const publicUrl = this.publicUrl(media.bucket, media.objectKey);
    const updated = await this.prisma.db.communityMedia.update({
      where: { id: mediaId },
      data: { status: 'READY', publicUrl },
    });
    return {
      id: updated.id,
      status: updated.status,
      publicUrl: updated.publicUrl,
      width: updated.width,
      height: updated.height,
      mimeType: updated.mimeType,
    };
  }

  async deleteMedia(userId: string, mediaId: string) {
    const media = await this.prisma.db.communityMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.ownerId !== userId) {
      throw new NotFoundException('Media không tồn tại');
    }
    await this.prisma.db.communityMedia.update({
      where: { id: mediaId },
      data: { status: 'DELETED' },
    });
    return { deleted: true };
  }

  // ─── Likes ────────────────────────────────────────────────────────────────
  async toggleLike(postId: string, userId: string) {
    assertLikeRateLimit(userId);
    const post = await this.prisma.db.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    const existing = await this.prisma.db.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      await this.prisma.db.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      const updated = await this.prisma.db.communityPost.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return { liked: false, likeCount: updated.likeCount };
    }
    await this.prisma.db.postLike.create({ data: { postId, userId } });
    const updated = await this.prisma.db.communityPost.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });
    if (post.authorId !== userId) {
      void this.notifyActor(userId, post.authorId, 'SOCIAL_LIKE', 'ai đó đã thích bài đăng của bạn', `mogu://community/posts/${postId}`);
    }
    return { liked: true, likeCount: updated.likeCount };
  }

  async likePost(postId: string, userId: string) {
    assertLikeRateLimit(userId);
    const post = await this.prisma.db.communityPost.findUnique({ where: { id: postId } });
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
      if (post.authorId !== userId) {
        void this.notifyActor(userId, post.authorId, 'SOCIAL_LIKE', 'ai đó đã thích bài đăng của bạn', `mogu://community/posts/${postId}`);
      }
    }
    const count = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: count?.likeCount ?? 0 };
  }

  async unlikePost(postId: string, userId: string) {
    assertLikeRateLimit(userId);
    const post = await this.prisma.db.communityPost.findUnique({ where: { id: postId } });
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
    const count = await this.prisma.db.communityPost.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    });
    return { liked: false, likeCount: count?.likeCount ?? 0 };
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  async listComments(
    postId: string,
    opts?: { cursor?: string; limit?: number; sort?: string; userId?: string },
  ) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);
    const sortAsc = (opts?.sort ?? 'oldest').toLowerCase() !== 'newest';
    const rows = await this.prisma.db.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: sortAsc ? 'asc' : 'desc' },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { userId: true, displayName: true, avatarUrl: true } },
        _count: { select: { likes: true } },
      },
    });
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    let likedIds = new Set<string>();
    if (opts?.userId && data.length) {
      const likes = await (this.prisma.db as any).postCommentLike.findMany({
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
        updatedAt: c.updatedAt,
        author: c.author,
        likeCount: c._count.likes,
        isLiked: likedIds.has(c.id),
      })),
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async toggleCommentLike(postId: string, commentId: string, userId: string) {
    assertLikeRateLimit(userId);
    const comment = await this.prisma.db.postComment.findFirst({
      where: { id: commentId, postId },
    });
    if (!comment) throw new NotFoundException('Bình luận không tồn tại');
    const existing = await (this.prisma.db as any).postCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing) {
      await (this.prisma.db as any).postCommentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      });
    } else {
      await (this.prisma.db as any).postCommentLike.create({
        data: { commentId, userId },
      });
      if (comment.authorId !== userId) {
        void this.notifyActor(
          userId,
          comment.authorId,
          'SOCIAL_LIKE',
          'ai đó đã thích bình luận của bạn',
          `mogu://community/posts/${postId}`,
        );
      }
    }
    const likeCount = await (this.prisma.db as any).postCommentLike.count({
      where: { commentId },
    });
    return { isLiked: !existing, likeCount };
  }

  async addComment(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.prisma.db.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    if (post.commentsEnabled === false) {
      throw new ForbiddenException('Bài đăng đã tắt bình luận');
    }
    assertContentNotSpam(dto.content, 'Bình luận');
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
    const deepLink = `mogu://community/posts/${postId}`;
    if (dto.parentCommentId) {
      const parent = await this.prisma.db.postComment.findUnique({
        where: { id: dto.parentCommentId },
        select: { authorId: true },
      });
      if (parent && parent.authorId !== authorId) {
        void this.notifyActor(
          authorId,
          parent.authorId,
          'SOCIAL_REPLY',
          'ai đó đã trả lời bình luận của bạn',
          deepLink,
        );
      }
    } else if (post.authorId !== authorId) {
      void this.notifyActor(
        authorId,
        post.authorId,
        'SOCIAL_COMMENT',
        'ai đó đã bình luận bài đăng của bạn',
        deepLink,
      );
    }
    return { ...comment, likeCount: 0, isLiked: false };
  }

  async trendingHashtags(limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const rows = await (this.prisma.db as any).postTag.groupBy({
        by: ['tag'],
        where: { createdAt: { gte: since } },
        _count: { tag: true },
        orderBy: { _count: { tag: 'desc' } },
        take,
      });
      return {
        items: rows.map((r: any) => ({ tag: r.tag, count: r._count.tag })),
      };
    } catch {
      return { items: [] };
    }
  }

  private async notifyActor(
    actorId: string,
    recipientId: string,
    type: 'SOCIAL_LIKE' | 'SOCIAL_COMMENT' | 'SOCIAL_FOLLOW' | 'SOCIAL_REPLY',
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

  async deleteComment(postId: string, commentId: string, userId: string) {
    const comment = await this.prisma.db.postComment.findUnique({ where: { id: commentId } });
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
    await this.prisma.db.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
    void this.notifyActor(
      followerId,
      followingId,
      'SOCIAL_FOLLOW',
      'đã bắt đầu theo dõi bạn',
      `mogu://users/${followerId}`,
    );
    return { following: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.db.userFollow
      .delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
      .catch(() => null);
    return { following: false };
  }

  async getPublicProfile(viewerId: string, userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: {
        userId: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!profile) throw new NotFoundException('Người dùng không tồn tại');
    const [followerCount, followingCount, postCount, isFollowing] = await Promise.all([
      this.prisma.db.userFollow.count({ where: { followingId: userId } }),
      this.prisma.db.userFollow.count({ where: { followerId: userId } }),
      this.prisma.db.communityPost.count({
        where: { authorId: userId, status: 'ACTIVE', visibility: 'PUBLIC' },
      }),
      viewerId === userId
        ? Promise.resolve(false)
        : this.prisma.db.userFollow
            .findUnique({
              where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
            })
            .then((r) => Boolean(r)),
    ]);
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      createdAt: profile.createdAt,
      followerCount,
      followingCount,
      postCount,
      isFollowing,
      isSelf: viewerId === userId,
    };
  }

  async listUserPosts(
    viewerId: string,
    userId: string,
    opts?: { cursor?: string; limit?: number },
  ) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Người dùng không tồn tại');
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 40);
    const where: any = {
      authorId: userId,
      status: 'ACTIVE',
    };
    if (viewerId !== userId) {
      where.visibility = 'PUBLIC';
    }
    const rows = await this.prisma.db.communityPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const data = await this.enrichFlags(page, viewerId);
    return {
      data,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async listTrendingHashtags(limit = 20) {
    return this.trendingHashtags(limit);
  }

  async savePost(userId: string, postId: string) {
    const post = await this.prisma.db.communityPost.findFirst({
      where: { id: postId, status: 'ACTIVE' },
    });
    if (!post) throw new NotFoundException('Bài đăng không tồn tại');
    await this.prisma.db.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
    return { saved: true };
  }

  async unsavePost(userId: string, postId: string) {
    await this.prisma.db.savedPost
      .delete({ where: { userId_postId: { userId, postId } } })
      .catch(() => null);
    return { saved: false };
  }
}
