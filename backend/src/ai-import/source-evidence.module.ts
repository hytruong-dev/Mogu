import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DuplicateScoringService } from './duplicates/duplicate-scoring.service';
import { EvidenceScoringService } from './evidence/evidence-scoring.service';
import {
  DisabledNutritionSourceAdapter,
  NUTRITION_SOURCE_ADAPTERS,
  NutritionSourceRegistry,
} from './nutrition/nutrition-source-adapter';
import { JsonLdWebsiteAdapter } from './sources/json-ld-website.adapter';
import { SafeSourceFetcherService } from './sources/safe-source-fetcher.service';
import { SourceIntegrationConfigService } from './sources/source-integration-config.service';
import { SourceIntegrationService } from './sources/source-integration.service';

@Module({
  imports: [ConfigModule],
  providers: [
    SourceIntegrationConfigService,
    SafeSourceFetcherService,
    JsonLdWebsiteAdapter,
    SourceIntegrationService,
    EvidenceScoringService,
    DuplicateScoringService,
    {
      provide: NUTRITION_SOURCE_ADAPTERS,
      useFactory: () => [
        new DisabledNutritionSourceAdapter('USDA_FDC'),
        new DisabledNutritionSourceAdapter('VIETNAM_FCT'),
      ],
    },
    NutritionSourceRegistry,
  ],
  exports: [
    SourceIntegrationConfigService,
    SafeSourceFetcherService,
    JsonLdWebsiteAdapter,
    SourceIntegrationService,
    EvidenceScoringService,
    DuplicateScoringService,
    NutritionSourceRegistry,
  ],
})
export class SourceEvidenceModule {}
