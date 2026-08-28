import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const PRESIGN_EXPIRES_SECONDS = 600;       // 10 phút

const STORAGE_BUCKET = 'dish-images';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PresignUploadResponse {
  /** URL PUT trực tiếp lên Supabase Storage (signed) */
  uploadUrl: string;
  /** Path trong bucket — client dùng để commit sau khi upload */
  storageKey: string;
  /** Token (không cần thiết khi dùng signed URL) */
  token: string;
  expiresAt: string;
}

export interface CommitMediaDto {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  altText?: string;
  credit?: string;
  sourceUrl?: string;
  isPrimary?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DishMediaService {
  private readonly logger = new Logger(DishMediaService.name);
  private readonly supabase: SupabaseClient;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    // Dùng service role key để ký URL và thao tác storage từ phía server
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Public URL base của Supabase Storage
    this.publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}`;
  }

  // ── Presign Upload ──────────────────────────────────────────────────────────

  /**
   * Tạo signed URL để client upload trực tiếp lên Supabase Storage.
   * Client thực hiện PUT với body là file (multipart không cần, chỉ cần raw bytes).
   */
  async presignUpload(
    dishId: string,
    mimeType: string,
    actorId: string,
  ): Promise<PresignUploadResponse> {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_MIME_TYPE',
          message: `Chỉ chấp nhận: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
      });
    }

    // Validate dish tồn tại
    const dish = await this.prisma.db.dish.findUnique({ where: { id: dishId } });
    if (!dish || dish.deletedAt) {
      throw new NotFoundException({
        error: { code: 'DISH_NOT_FOUND', message: 'Không tìm thấy món ăn.' },
      });
    }

    // Sinh storage key: dishes/<dishId>/<timestamp>-<actorPrefix>.<ext>
    const ext = this.getExtension(mimeType);
    const storageKey = `dishes/${dishId}/${Date.now()}-${actorId.slice(0, 8)}.${ext}`;

    // Tạo signed upload URL (PUT)
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storageKey, { upsert: false });

    if (error || !data) {
      this.logger.error(
        `Supabase Storage createSignedUploadUrl error: ${JSON.stringify(error)}`,
        { dishId, mimeType, storageKey },
      );
      throw new BadRequestException({
        error: {
          code: 'PRESIGN_FAILED',
          message: `Không thể tạo URL upload: ${error?.message ?? 'Unknown error'}`,
          detail: error,
        },
      });
    }

    return {
      uploadUrl: data.signedUrl,
      storageKey,
      token: data.token,
      expiresAt: new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000).toISOString(),
    };
  }

  // ── Commit Media ────────────────────────────────────────────────────────────

  /**
   * Sau khi client upload xong, gọi API này để lưu metadata vào DB.
   * Server verify file tồn tại trong Storage trước khi commit.
   */
  async commitMedia(dishId: string, dto: CommitMediaDto, actorId: string) {
    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException({
        error: { code: 'INVALID_MIME_TYPE', message: 'Loại file không được hỗ trợ.' },
      });
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(dto.mimeType);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (dto.sizeBytes > maxSize) {
      throw new BadRequestException({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File vượt quá ${isVideo ? '100MB (video)' : '10MB (ảnh)'}.`,
        },
      });
    }

    // Verify file đã tồn tại trong Supabase Storage
    const { data: fileInfo, error: statError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .list(this.getDirPath(dto.storageKey), {
        search: this.getFileName(dto.storageKey),
        limit: 1,
      });

    if (statError || !fileInfo?.length) {
      throw new BadRequestException({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'File chưa được upload hoặc đã hết hạn. Hãy upload lại.',
        },
      });
    }

    // Nếu isPrimary, bỏ primary cũ
    if (dto.isPrimary) {
      await this.prisma.db.dishMedia.updateMany({
        where: { dishId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const mediaRecord = await this.prisma.db.dishMedia.create({
      data: {
        dishId,
        type: isVideo ? 'VIDEO' : 'IMAGE',
        storageKey: dto.storageKey,
        bucket: STORAGE_BUCKET,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        width: dto.width,
        height: dto.height,
        durationSec: dto.durationSec,
        altText: dto.altText,
        credit: dto.credit,
        sourceUrl: dto.sourceUrl,
        isPrimary: dto.isPrimary ?? false,
        moderationStatus: 'PENDING',
      },
    });

    return {
      ...mediaRecord,
      publicUrl: this.buildPublicUrl(dto.storageKey),
    };
  }

  // ── Approve Media ───────────────────────────────────────────────────────────

  async approveMedia(mediaId: string, actorId: string) {
    const media = await this.prisma.db.dishMedia.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException({
        error: { code: 'MEDIA_NOT_FOUND', message: 'Không tìm thấy media.' },
      });
    }

    const updated = await this.prisma.db.dishMedia.update({
      where: { id: mediaId },
      data: { moderationStatus: 'APPROVED' },
    });

    return {
      ...updated,
      publicUrl: this.buildPublicUrl(media.storageKey),
    };
  }

  // ── Delete Media ────────────────────────────────────────────────────────────

  async deleteMedia(mediaId: string, actorId: string) {
    const media = await this.prisma.db.dishMedia.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException({
        error: { code: 'MEDIA_NOT_FOUND', message: 'Không tìm thấy media.' },
      });
    }

    // Xóa file trong Supabase Storage
    const { error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([media.storageKey]);

    if (error) {
      // Log nhưng không block — xóa DB record vẫn quan trọng hơn
      this.logger.warn(`Supabase Storage remove error (non-critical): ${error.message}`);
    }

    await this.prisma.db.dishMedia.delete({ where: { id: mediaId } });
    return { deleted: true, mediaId };
  }

  // ── Get Signed Download URL ─────────────────────────────────────────────────

  /**
   * Tạo signed URL để tải file từ Supabase Storage (hữu ích cho private bucket).
   * Nếu bucket public thì dùng `buildPublicUrl()` trực tiếp.
   */
  async createSignedDownloadUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storageKey, expiresInSeconds);

    if (error || !data) {
      throw new BadRequestException({
        error: { code: 'SIGNED_URL_FAILED', message: 'Không thể tạo URL tải xuống.' },
      });
    }

    return data.signedUrl;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Sinh public URL cho file trong bucket (bucket phải public) */
  buildPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${storageKey}`;
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    return map[mimeType] || 'bin';
  }

  private getDirPath(storageKey: string): string {
    const parts = storageKey.split('/');
    parts.pop();
    return parts.join('/');
  }

  private getFileName(storageKey: string): string {
    return storageKey.split('/').pop() ?? storageKey;
  }
}
