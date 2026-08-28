import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportJobStatus, Prisma } from '@prisma/client';
import {
  DishCommandService,
  DishDraftAggregate,
} from '../dishes/services/dish-command.service';
import { PrismaService } from '../prisma/prisma.service';
import { FieldWarning } from './ai-import.types';

export interface PersistAiImportDraftCommand {
  jobId: string;
  actorId?: string;
  aggregate: DishDraftAggregate;
  warnings?: FieldWarning[];
  unresolvedFields?: string[];
  taxonomySnapshotVersion?: string;
  fieldMetadata?: Prisma.InputJsonValue;
  auditMetadata?: Prisma.InputJsonValue;
}

export interface PersistAiImportDraftResult {
  dishId: string;
  created: boolean;
}

@Injectable()
export class AiImportDraftPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dishCommand: DishCommandService,
  ) {}

  async persist(command: PersistAiImportDraftCommand): Promise<PersistAiImportDraftResult> {
    return this.prisma.db.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({
        where: { id: command.jobId },
        select: {
          id: true,
          resultDishId: true,
          requestedBy: true,
          status: true,
          pipelineVersion: true,
          schemaVersion: true,
        },
      });
      if (!job) {
        throw new NotFoundException({
          error: { code: 'AI_IMPORT_JOB_NOT_FOUND', message: 'Không tìm thấy AI import job.' },
        });
      }
      if (job.resultDishId) {
        return { dishId: job.resultDishId, created: false };
      }

      const actorId = command.actorId ?? job.requestedBy;
      if (!actorId) {
        throw new ConflictException({
          error: {
            code: 'AI_IMPORT_ACTOR_REQUIRED',
            message: 'AI import job phải có người yêu cầu để ghi nhận attribution/audit.',
          },
        });
      }

      const claimed = await tx.importJob.updateMany({
        where: { id: job.id, resultDishId: null },
        data: { idempotencyKey: `ai-import-draft:${job.id}` },
      });
      if (claimed.count !== 1) {
        const concurrent = await tx.importJob.findUnique({
          where: { id: job.id },
          select: { resultDishId: true },
        });
        if (concurrent?.resultDishId) {
          return { dishId: concurrent.resultDishId, created: false };
        }
        throw new ConflictException({
          error: {
            code: 'AI_IMPORT_DRAFT_CONCURRENT_WRITE',
            message: 'Job đang được worker khác tạo DRAFT.',
          },
        });
      }

      const warnings = command.warnings ?? [];
      const dish = await this.dishCommand.createDraftAggregate(
        tx,
        command.aggregate,
        actorId,
        {
          action: 'AI_IMPORT_DRAFT_CREATED',
          payload: {
            jobId: job.id,
            pipelineVersion: job.pipelineVersion,
            schemaVersion: job.schemaVersion,
            taxonomySnapshotVersion: command.taxonomySnapshotVersion,
            warningCodes: warnings.map((warning) => warning.code),
            unresolvedFields: command.unresolvedFields ?? [],
            fieldMetadata: command.fieldMetadata,
            auditMetadata: command.auditMetadata,
          },
        },
      );

      if (dish.status !== 'DRAFT') {
        throw new ConflictException({
          error: {
            code: 'AI_IMPORT_DRAFT_STATUS_INVALID',
            message: 'AI import chỉ được phép tạo món ở trạng thái DRAFT.',
          },
        });
      }

      const linked = await tx.importJob.updateMany({
        where: { id: job.id, resultDishId: null },
        data: {
          resultDishId: dish.id,
          status: ImportJobStatus.DONE,
          progress: 100,
          completionPercent: 100,
          warnings: warnings as unknown as Prisma.InputJsonValue,
          unresolvedFields: command.unresolvedFields ?? [],
          taxonomySnapshotVersion: command.taxonomySnapshotVersion,
          fieldMetadata: command.fieldMetadata,
          auditMetadata: command.auditMetadata,
          completedAt: new Date(),
        },
      });
      if (linked.count !== 1) {
        throw new ConflictException({
          error: {
            code: 'AI_IMPORT_DRAFT_CONCURRENT_WRITE',
            message: 'Không thể liên kết DRAFT với job một cách nguyên tử.',
          },
        });
      }
      return { dishId: dish.id, created: true };
    });
  }
}
