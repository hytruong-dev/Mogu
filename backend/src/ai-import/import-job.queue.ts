import { Inject, Injectable, Optional } from '@nestjs/common';
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
    await this.queue.add('process-import', data, {
      jobId: data.jobId,
      ...AI_IMPORT_QUEUE_OPTIONS,
    });
    return true;
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.queue?.getJob(jobId);
    if (job && !['active', 'completed', 'failed'].includes(await job.getState())) {
      await job.remove();
    }
  }
}
