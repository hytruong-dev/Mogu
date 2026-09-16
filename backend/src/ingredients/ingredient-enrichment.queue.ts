import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';

export const INGREDIENT_IMAGE_ENRICHMENT_QUEUE = 'ingredient-image-enrichment';
export const INGREDIENT_ENRICHMENT_QUEUE_TOKEN = `BullQueue_${INGREDIENT_IMAGE_ENRICHMENT_QUEUE}`;

export interface IngredientEnrichmentJobData {
  ingredientId: string;
}

export const INGREDIENT_ENRICHMENT_QUEUE_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 3_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

@Injectable()
export class IngredientEnrichmentQueue {
  private readonly logger = new Logger(IngredientEnrichmentQueue.name);

  constructor(
    @Optional()
    @Inject(INGREDIENT_ENRICHMENT_QUEUE_TOKEN)
    private readonly queue: Queue<IngredientEnrichmentJobData> | null,
    private readonly moduleRef: ModuleRef,
  ) {}

  get enabled(): boolean {
    return Boolean(this.queue);
  }

  /**
   * Enqueue async image search. If Bull/Redis is unavailable, fall back to
   * in-process background enrichment so Admin still gets candidates.
   */
  async enqueueNewIngredients(ingredientIds: string[]): Promise<number> {
    if (!ingredientIds.length) return 0;

    if (this.queue) {
      let enqueued = 0;
      for (const ingredientId of ingredientIds) {
        try {
          await this.queue.add(
            'enrich-ingredient-image',
            { ingredientId },
            {
              jobId: `ing-img-${ingredientId}`,
              ...INGREDIENT_ENRICHMENT_QUEUE_OPTIONS,
            },
          );
          enqueued += 1;
        } catch (err) {
          this.logger.warn(
            `Bull enqueue failed for ${ingredientId}, falling back inline: ${(err as Error).message}`,
          );
          setImmediate(() => {
            void this.runInline(ingredientId);
          });
          enqueued += 1;
        }
      }
      return enqueued;
    }

    this.logger.warn(
      `Redis queue unavailable — running inline enrichment for ${ingredientIds.length} ingredient(s)`,
    );
    for (const ingredientId of ingredientIds) {
      setImmediate(() => {
        void this.runInline(ingredientId);
      });
    }
    return ingredientIds.length;
  }

  private async runInline(ingredientId: string): Promise<void> {
    try {
      const { IngredientImageEnrichmentService } = await import(
        './ingredient-image/ingredient-image-enrichment.service'
      );
      const enrichment = this.moduleRef.get(IngredientImageEnrichmentService, {
        strict: false,
      });
      await enrichment.enrichIngredient(ingredientId);
    } catch (err) {
      this.logger.warn(
        `Inline enrichment failed for ${ingredientId}: ${(err as Error).message}`,
      );
    }
  }
}
