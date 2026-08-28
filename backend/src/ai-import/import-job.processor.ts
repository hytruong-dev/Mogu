import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ImportJobsService } from './import-jobs.service';
import { AI_IMPORT_QUEUE, ImportJobQueueData } from './import-job.queue';

@Processor(AI_IMPORT_QUEUE, { concurrency: 2 })
export class ImportJobProcessor extends WorkerHost {
  constructor(private readonly jobs: ImportJobsService) {
    super();
  }

  process(job: Job<ImportJobQueueData>): Promise<void> {
    return this.jobs.process(job.data.jobId, job.data.request, job.data.actorId);
  }
}
