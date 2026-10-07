import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async requestExport(userId: string, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.prisma.db.privacyJob.findFirst({
        where: { userId, jobType: 'DATA_EXPORT', idempotencyKey },
      });
      if (existing) {
        return this.formatExportJob(existing);
      }
    }

    const payload = await this.buildExportPayload(userId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const job = await this.prisma.db.privacyJob.create({
      data: {
        userId,
        jobType: 'DATA_EXPORT',
        status: 'READY',
        idempotencyKey: idempotencyKey ?? null,
        progress: 100,
        startedAt: new Date(),
        finishedAt: new Date(),
        expiresAt,
        metadata: {
          format: 'json',
          generatedAt: new Date().toISOString(),
          payload,
        } as any,
      },
    });
    const withUrl = await this.prisma.db.privacyJob.update({
      where: { id: job.id },
      data: { resultUrl: `/v1/me/data-exports/${job.id}/content` },
    });

    return this.formatExportJob(withUrl);
  }

  private async buildExportPayload(userId: string) {
    const db = this.prisma.db;
    const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [
      profile,
      settings,
      goals,
      dietaryPrefs,
      allergens,
      avoidances,
      savedDishes,
      mealLogs,
      waterLogs,
      randomHistory,
      posts,
      measurements,
    ] = await Promise.all([
      safe(db.profile.findUnique({ where: { userId } }), null),
      safe(db.userSetting.findUnique({ where: { userId } }), null),
      safe(db.userGoal.findMany({ where: { userId }, include: { goal: { select: { code: true, name: true } } } }), []),
      safe(db.userDietaryPreference.findMany({ where: { userId }, include: { preference: { select: { code: true, name: true, type: true } } } }), []),
      safe(db.userAllergen.findMany({ where: { userId }, include: { allergen: { select: { code: true, name: true } } } }), []),
      safe(db.userAvoidedIngredient.findMany({ where: { userId }, select: { ingredientName: true, mode: true, reasonCode: true } }), []),
      safe(db.savedDish.findMany({ where: { userId }, include: { dish: { select: { id: true, name: true } } }, orderBy: { savedAt: 'desc' }, take: 1000 }), []),
      safe(db.diaryMealLog.findMany({ where: { userId, deletedAt: null }, include: { items: true }, orderBy: { occurredAt: 'desc' }, take: 2000 }), []),
      safe(db.waterLog.findMany({ where: { userId }, orderBy: { occurredAt: 'desc' }, take: 2000 }), []),
      safe(db.randomHistory.findMany({ where: { userId }, select: { id: true, dishId: true, mealSlot: true, status: true, createdAt: true, selectedAt: true }, orderBy: { createdAt: 'desc' }, take: 1000 }), []),
      safe(db.communityPost.findMany({ where: { authorId: userId, status: { not: 'DELETED' } }, select: { id: true, content: true, imageUrls: true, status: true, visibility: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1000 }), []),
      safe(db.profileMeasurement.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' }, take: 1000 }), []),
    ]);

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      userId,
      profile,
      settings,
      goals,
      dietaryPreferences: dietaryPrefs,
      allergens,
      avoidedIngredients: avoidances,
      measurements,
      savedDishes,
      mealLogs,
      waterLogs,
      randomHistory,
      posts,
    };
  }

  async getExportContent(userId: string, jobId: string) {
    const job = await this.prisma.db.privacyJob.findFirst({
      where: { id: jobId, userId, jobType: 'DATA_EXPORT' },
    });
    if (!job) {
      throw new NotFoundException({
        error: { code: 'EXPORT_NOT_FOUND', message: 'Không tìm thấy yêu cầu xuất dữ liệu.' },
      });
    }
    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new ForbiddenException({
        error: { code: 'EXPORT_EXPIRED', message: 'Link xuất dữ liệu đã hết hạn.' },
      });
    }
    const payload = (job.metadata as any)?.payload;
    if (!payload) {
      throw new NotFoundException({
        error: { code: 'EXPORT_EMPTY', message: 'Dữ liệu xuất không còn khả dụng.' },
      });
    }
    return payload;
  }
  private formatExportJob(job: any) {
    return {
      jobId: job.id,
      status: job.status,
      expiresAt: job.expiresAt?.toISOString?.() ?? job.expiresAt ?? null,
      download: job.resultUrl
        ? {
            url: job.resultUrl,
            resultUrl: job.resultUrl,
            expiresAt: job.expiresAt?.toISOString?.() ?? job.expiresAt ?? null,
          }
        : null,
      resultUrl: job.resultUrl,
      downloadPath: `/v1/me/data-exports/${job.id}/content`,
      pollAfterMs: 3000,
    };
  }

  async getExport(userId: string, jobId: string) {
    const job = await this.prisma.db.privacyJob.findFirst({
      where: { id: jobId, userId, jobType: 'DATA_EXPORT' },
    });
    if (!job) {
      throw new NotFoundException({
        error: { code: 'EXPORT_NOT_FOUND', message: 'Không tìm thấy yêu cầu xuất dữ liệu.' },
      });
    }
    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new ForbiddenException({
        error: { code: 'EXPORT_EXPIRED', message: 'Link xuất dữ liệu đã hết hạn.' },
      });
    }

    return this.formatExportJob(job);
  }

  async requestAccountDeletion(userId: string) {
    const active = await this.prisma.db.privacyJob.findFirst({
      where: {
        userId,
        jobType: 'ACCOUNT_DELETION',
        status: { in: ['PENDING_GRACE', 'PROCESSING', 'QUEUED'] },
      },
    });
    if (active) {
      return {
        jobId: active.id,
        status: active.status,
        graceEndsAt: active.expiresAt?.toISOString() ?? null,
        message: 'Đã có yêu cầu xóa tài khoản đang hoạt động.',
      };
    }

    const graceDays = 14;
    const job = await this.prisma.db.privacyJob.create({
      data: {
        userId,
        jobType: 'ACCOUNT_DELETION',
        status: 'PENDING_GRACE',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000),
        metadata: { graceDays },
      },
    });

    return {
      jobId: job.id,
      status: job.status,
      graceEndsAt: job.expiresAt?.toISOString() ?? null,
      message: `Tài khoản sẽ bị xóa sau ${graceDays} ngày nếu không hủy yêu cầu.`,
    };
  }

  async getAccountDeletionRequest(userId: string) {
    const job = await this.prisma.db.privacyJob.findFirst({
      where: { userId, jobType: 'ACCOUNT_DELETION' },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) {
      return { status: 'NONE', jobId: null, graceEndsAt: null };
    }
    return {
      jobId: job.id,
      status: job.status,
      graceEndsAt: job.expiresAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async cancelAccountDeletionRequest(userId: string) {
    const job = await this.prisma.db.privacyJob.findFirst({
      where: {
        userId,
        jobType: 'ACCOUNT_DELETION',
        status: { in: ['PENDING_GRACE', 'QUEUED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'DELETION_REQUEST_NOT_FOUND',
        message: 'Không có yêu cầu xóa tài khoản đang hoạt động.',
      });
    }
    if (job.status !== 'PENDING_GRACE' && job.status !== 'QUEUED') {
      throw new ConflictException({
        code: 'DELETION_NOT_CANCELLABLE',
        message: 'Không thể hủy yêu cầu ở trạng thái hiện tại.',
      });
    }

    const updated = await this.prisma.db.privacyJob.update({
      where: { id: job.id },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });

    return {
      jobId: updated.id,
      status: updated.status,
      cancelledAt: updated.finishedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async clearHistory(userId: string, scope: 'random' | 'all' = 'random') {
    if (scope === 'random' || scope === 'all') {
      await this.prisma.db.randomHistory
        .deleteMany({ where: { userId } })
        .catch(() => null);
    }

    const job = await this.prisma.db.privacyJob.create({
      data: {
        userId,
        jobType: 'CLEAR_HISTORY',
        status: 'COMPLETED',
        progress: 100,
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: { scope },
      },
    });

    return { jobId: job.id, cleared: true, scope };
  }

  async clearHealth(userId: string) {
    await this.prisma.db.$transaction(async (tx) => {
      await tx.diaryMealLog.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.waterLog.deleteMany({ where: { userId } });
      await tx.profileMeasurement.deleteMany({ where: { userId } }).catch(() => null);
      await tx.activityBucket.deleteMany({ where: { userId } }).catch(() => null);
      await tx.healthTarget.deleteMany({ where: { userId } }).catch(() => null);
      await tx.profile.update({
        where: { userId },
        data: {
          heightCm: null,
          weightKg: null,
          goalKcal: null,
          targetWeightKg: null,
          activityLevel: null,
        },
      });
    }).catch(() => null);

    const job = await this.prisma.db.privacyJob.create({
      data: {
        userId,
        jobType: 'CLEAR_HEALTH',
        status: 'COMPLETED',
        progress: 100,
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: { scope: 'full' },
      },
    });

    return { jobId: job.id, cleared: true };
  }
}
