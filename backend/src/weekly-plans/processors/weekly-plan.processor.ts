import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WeeklyPlanGeneratorService } from '../services/weekly-plan-generator.service';
import { WEEKLY_PLAN_QUEUE } from '../services/weekly-plans.service';

@Processor(WEEKLY_PLAN_QUEUE)
export class WeeklyPlanProcessor extends WorkerHost {
  private readonly logger = new Logger(WeeklyPlanProcessor.name);

  constructor(private readonly generator: WeeklyPlanGeneratorService) {
    super();
  }

  async process(job: Job<{ planId: string }>): Promise<void> {
    const { planId } = job.data;
    this.logger.log(`Processing generation job for plan: ${planId}`);

    try {
      await this.generator.run(planId);
      this.logger.log(`Generation complete for plan: ${planId}`);
    } catch (err: any) {
      this.logger.error(`Generation failed for plan ${planId}: ${err.message}`, err.stack);
      throw err; // BullMQ will retry
    }
  }
}
