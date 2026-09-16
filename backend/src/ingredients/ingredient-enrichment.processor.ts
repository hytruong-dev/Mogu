import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  INGREDIENT_IMAGE_ENRICHMENT_QUEUE,
  IngredientEnrichmentJobData,
} from './ingredient-enrichment.queue';
import { IngredientImageEnrichmentService } from './ingredient-image/ingredient-image-enrichment.service';

@Processor(INGREDIENT_IMAGE_ENRICHMENT_QUEUE, { concurrency: 2 })
export class IngredientEnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(IngredientEnrichmentProcessor.name);

  constructor(
    private readonly enrichment: IngredientImageEnrichmentService,
  ) {
    super();
  }

  async process(job: Job<IngredientEnrichmentJobData>): Promise<void> {
    this.logger.log(`Enriching ingredient image ${job.data.ingredientId}`);
    await this.enrichment.enrichIngredient(job.data.ingredientId);
  }
}
