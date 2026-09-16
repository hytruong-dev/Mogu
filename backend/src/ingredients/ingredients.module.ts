import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  AdminIngredientsController,
  IngredientsController,
} from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { IngredientNormalizerService } from './ingredient-normalizer.service';
import { CatalogIngredientResolverService } from './ingredient-resolver.service';
import { IngredientCatalogService } from './ingredient-catalog.service';
import {
  INGREDIENT_ENRICHMENT_QUEUE_TOKEN,
  INGREDIENT_IMAGE_ENRICHMENT_QUEUE,
  IngredientEnrichmentQueue,
} from './ingredient-enrichment.queue';
import { IngredientEnrichmentProcessor } from './ingredient-enrichment.processor';
import { WikimediaCommonsProvider } from './ingredient-image/wikimedia-commons.provider';
import { OpenverseProvider } from './ingredient-image/openverse.provider';
import { ImageLicensePolicyService } from './ingredient-image/image-license-policy.service';
import { ImageRankerService } from './ingredient-image/image-ranker.service';
import { SafeImageDownloaderService } from './ingredient-image/safe-image-downloader.service';
import { IngredientImageEnrichmentService } from './ingredient-image/ingredient-image-enrichment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { getRedisUrl } from '../common/redis/redis-env';

const REDIS_URL = getRedisUrl();
const nullQueueProvider = {
  provide: INGREDIENT_ENRICHMENT_QUEUE_TOKEN,
  useValue: null,
};

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ...(REDIS_URL
      ? [BullModule.registerQueue({ name: INGREDIENT_IMAGE_ENRICHMENT_QUEUE })]
      : []),
  ],
  controllers: [IngredientsController, AdminIngredientsController],
  providers: [
    IngredientsService,
    IngredientNormalizerService,
    CatalogIngredientResolverService,
    IngredientCatalogService,
    IngredientEnrichmentQueue,
    WikimediaCommonsProvider,
    OpenverseProvider,
    ImageLicensePolicyService,
    ImageRankerService,
    SafeImageDownloaderService,
    IngredientImageEnrichmentService,
    ...(REDIS_URL ? [IngredientEnrichmentProcessor] : [nullQueueProvider]),
  ],
  exports: [
    IngredientsService,
    IngredientNormalizerService,
    CatalogIngredientResolverService,
    IngredientCatalogService,
    IngredientEnrichmentQueue,
    IngredientImageEnrichmentService,
  ],
})
export class IngredientsModule {}
