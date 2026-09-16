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

    const storageKey = `exports/${userId}/${Date.now()}.json`;
    const supabaseUrl =
      process.env.SUPABASE_URL?.replace(/\/$/, '') ??
      'https://placeholder.supabase.co';
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const resultUrl = `${supabaseUrl}/storage/v1/object/sign/${storageKey}?token=export-stub`;

    const job = await this.prisma.db.privacyJob.create({
      data: {
        userId,
        jobType: 'DATA_EXPORT',
        status: 'READY',
        resultUrl,
        resultStorageKey: storageKey,
        idempotencyKey: idempotencyKey ?? null,
        progress: 100,
        startedAt: new Date(),
        finishedAt: new Date(),
        expiresAt,
        metadata: {
          note: 'Signed URL style export result.',
          generatedAt: new Date().toISOString(),
        },
      },
    });

    return this.formatExportJob(job);
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
      downloadPath: `/v1/me/data-exports/${job.id}`,
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
