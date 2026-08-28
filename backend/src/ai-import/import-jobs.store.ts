import { Injectable, Logger } from '@nestjs/common';
import { ImportJobDto, ImportJobLogDto, ImportJobStatus } from './dto/import-job.dto';
import { PrismaService } from '../prisma/prisma.service';

/** In-memory store — giữ tối đa 100 jobs gần nhất */
@Injectable()
export class ImportJobsStore {
  private readonly logger = new Logger(ImportJobsStore.name);
  private jobs = new Map<string, ImportJobDto>();
  private readonly MAX_JOBS = 100;

  constructor(private readonly prisma: PrismaService) { }

  async create(partial: Partial<ImportJobDto> & { id: string; query: string }): Promise<ImportJobDto> {
    const job: ImportJobDto = {
      id: partial.id,
      query: partial.query,
      status: 'PENDING',
      currentStep: 0,
      totalSteps: 6,
      progress: 0,
      sourceTypes: partial.sourceTypes ?? [],
      relatedKeywords: partial.relatedKeywords ?? [],
      regionHint: partial.regionHint,
      actorId: partial.actorId,
      cancelRequested: false,
      createdAt: new Date().toISOString(),
      logs: [],
    };
    this.jobs.set(job.id, job);
    this.evict();
    await this.persistCreate(job);
    return job;
  }

  async get(id: string): Promise<ImportJobDto | undefined> {
    const cached = this.jobs.get(id);
    if (cached) return cached;
    const row = await this.withImportJobModel((model) =>
      model.findUnique({ where: { id } }),
    );
    const job = row ? this.fromPersistence(row) : undefined;
    if (job) this.jobs.set(job.id, job);
    return job;
  }

  async list(limit = 20, cursor?: string): Promise<{ data: ImportJobDto[]; nextCursor?: string; total: number }> {
    const persistent = await this.withImportJobModel(async (model) => {
      const [rows, total] = await Promise.all([
        model.findMany({
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        model.count(),
      ]);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit).map((row: unknown) => this.fromPersistence(row as Record<string, unknown>));
      return { data: page, nextCursor: hasMore ? page[page.length - 1]?.id : undefined, total };
    });
    if (persistent) return persistent;
    const all = Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const startIdx = cursor ? all.findIndex((j) => j.id === cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < all.length ? slice[slice.length - 1]?.id : undefined;
    return { data: slice, nextCursor, total: all.length };
  }

  async update(id: string, patch: Partial<ImportJobDto>): Promise<ImportJobDto | undefined> {
    const job = await this.get(id);
    if (!job) return undefined;
    Object.assign(job, patch);
    await this.persistUpdate(id, patch);
    return job;
  }

  async addLog(id: string, log: ImportJobLogDto): Promise<void> {
    const job = await this.get(id);
    if (job) {
      job.logs = [...(job.logs ?? []), log];
    }
  }

  async cancel(id: string): Promise<ImportJobDto | undefined> {
    const job = await this.get(id);
    if (!job) return undefined;
    if (['DONE', 'FAILED', 'CANCELLED'].includes(job.status)) return job;
    job.status = 'CANCELLED';
    job.cancelRequested = true;
    job.completedAt = new Date().toISOString();
    await this.persistUpdate(id, {
      status: 'CANCELLED',
      cancelRequested: true,
      completedAt: job.completedAt,
    });
    return job;
  }

  async isCancellationRequested(id: string): Promise<boolean> {
    const persistent = await this.withImportJobModel<{
      status: ImportJobStatus;
      cancelRequested: boolean;
    }>((model) =>
      model.findUnique({
        where: { id },
        select: { status: true, cancelRequested: true },
      }),
    );
    if (persistent) {
      return persistent.cancelRequested || persistent.status === 'CANCELLED';
    }
    const job = this.jobs.get(id);
    return Boolean(job?.cancelRequested || job?.status === 'CANCELLED');
  }

  private get model(): any {
    return (this.prisma.db as any).importJob;
  }

  private async withImportJobModel<T>(operation: (model: any) => Promise<T>): Promise<T | undefined> {
    if (!this.model) return undefined;
    try {
      return await operation(this.model);
    } catch (error) {
      this.logger.warn(`ImportJob persistence unavailable; using memory fallback: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async persistCreate(job: ImportJobDto): Promise<void> {
    await this.withImportJobModel((model) =>
      model.create({ data: this.toPersistence(job) }),
    );
  }

  private async persistUpdate(id: string, patch: Partial<ImportJobDto>): Promise<void> {
    await this.withImportJobModel((model) =>
      model.update({ where: { id }, data: this.toPersistence(patch) }),
    );
  }

  private toPersistence(job: Partial<ImportJobDto>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const mappings: Array<[keyof ImportJobDto, string]> = [
      ['id', 'id'],
      ['query', 'query'],
      ['status', 'status'],
      ['currentStep', 'currentStep'],
      ['totalSteps', 'totalSteps'],
      ['progress', 'progress'],
      ['currentStepName', 'currentStepName'],
      ['currentStepMessage', 'currentStepMessage'],
      ['relatedKeywords', 'relatedKeywords'],
      ['regionHint', 'regionHint'],
      ['sourceTypes', 'sourceTypes'],
      ['resultDishId', 'resultDishId'],
      ['suggestedImageUrl', 'suggestedImageUrl'],
      ['errorMessage', 'errorMessage'],
      ['cancelRequested', 'cancelRequested'],
    ];
    for (const [dtoKey, prismaKey] of mappings) {
      if (job[dtoKey] !== undefined) data[prismaKey] = job[dtoKey];
    }
    if (job.actorId !== undefined) data.requestedBy = job.actorId;
    if (job.createdAt) data.createdAt = new Date(job.createdAt);
    if (job.completedAt) data.completedAt = new Date(job.completedAt);
    return data;
  }

  private fromPersistence(row: Record<string, any>): ImportJobDto {
    return {
      ...row,
      createdAt: new Date(row.createdAt).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : undefined,
      actorId: row.requestedBy ?? undefined,
      sourceTypes: row.sourceTypes ?? [],
      relatedKeywords: row.relatedKeywords ?? [],
      cancelRequested: row.cancelRequested ?? false,
      logs: [],
    } as unknown as ImportJobDto;
  }

  private evict(): void {
    if (this.jobs.size > this.MAX_JOBS) {
      const oldest = Array.from(this.jobs.keys())[0];
      this.jobs.delete(oldest);
    }
  }
}
