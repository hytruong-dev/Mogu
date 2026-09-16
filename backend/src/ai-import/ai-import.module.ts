import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { ImportJobsService } from './import-jobs.service';
import { ImportJobsController } from './import-jobs.controller';
import { ImportGateway } from './import.gateway';
import { ImportJobsStore } from './import-jobs.store';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import {
  AI_IMPORT_QUEUE,
  AI_IMPORT_QUEUE_TOKEN,
  ImportJobQueue,
} from './import-job.queue';
import { ImportJobProcessor } from './import-job.processor';
import { TaxonomySnapshotService } from './taxonomy-snapshot.service';
import {
  IngredientParserService,
  IngredientResolverService,
} from './ingredient.service';
import { ClassificationRulesService } from './classification-rules.service';
import {
  CrossFieldValidatorService,
  RecipeValidatorService,
} from './validators.service';
import { TargetedRepairService } from './targeted-repair.service';
import { SourceEvidenceModule } from './source-evidence.module';
import { DishesModule } from '../dishes/dishes.module';
import { AiImportDraftPersistenceService } from './ai-import-draft-persistence.service';
import { AI_IMPORT_PROVIDER } from './ai-provider';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { getRedisUrl } from '../common/redis/redis-env';

const REDIS_URL = getRedisUrl();
const nullQueueProvider = { provide: AI_IMPORT_QUEUE_TOKEN, useValue: null };

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    SourceEvidenceModule,
    DishesModule,
    IngredientsModule,
    ...(REDIS_URL ? [BullModule.registerQueue({ name: AI_IMPORT_QUEUE })] : []),
  ],
  providers: [
    AiService,
    ImportJobsService,
    ImportGateway,
    ImportJobsStore,
    ImportJobQueue,
    TaxonomySnapshotService,
    IngredientParserService,
    IngredientResolverService,
    ClassificationRulesService,
    RecipeValidatorService,
    CrossFieldValidatorService,
    TargetedRepairService,
    AiImportDraftPersistenceService,
    { provide: AI_IMPORT_PROVIDER, useExisting: AiService },
    ...(REDIS_URL ? [ImportJobProcessor] : [nullQueueProvider]),
  ],
  controllers: [ImportJobsController],
  exports: [
    AiService,
    TaxonomySnapshotService,
    IngredientParserService,
    IngredientResolverService,
    ClassificationRulesService,
    RecipeValidatorService,
    CrossFieldValidatorService,
    TargetedRepairService,
    AI_IMPORT_PROVIDER,
    SourceEvidenceModule,
  ],
})
export class AiImportModule {}
