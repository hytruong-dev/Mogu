import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CreateImportJobDto } from './dto/create-import-job.dto';

export const AI_IMPORT_QUEUE = 'ai-import';
export const AI_IMPORT_QUEUE_TOKEN = `BullQueue_${AI_IMPORT_QUEUE}`;

export interface ImportJobQueueData {
  jobId: string;
  actorId: string;
  request: CreateImportJobDto;
}

export const AI_IMPORT_QUEUE_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

@Injectable()
export class ImportJobQueue {
  private readonly logger = new Logger(ImportJobQueue.name);

  constructor(
    @Optional()
    @Inject(AI_IMPORT_QUEUE_TOKEN)
    private readonly queue: Queue<ImportJobQueueData> | null,
  ) {}

  get enabled(): boolean {
    return Boolean(this.queue);
  }

  async enqueue(data: ImportJobQueueData): Promise<boolean> {
    if (!this.queue) return false;
    try {
      await this.queue.add('process-import', data, {
        jobId: data.jobId,
        ...AI_IMPORT_QUEUE_OPTIONS,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `AI import queue unavailable, falling back to in-process: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async cancel(jobId: string): Promise<void> {
    try {
      const job = await this.queue?.getJob(jobId);
      if (job && !['active', 'completed', 'failed'].includes(await job.getState())) {
        await job.remove();
      }
    } catch (err) {
      this.logger.warn(`Cancel import job ${jobId} skipped: ${(err as Error).message}`);
    }
  }
}
