import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DuplicateScoringService } from './duplicates/duplicate-scoring.service';
import { EvidenceScoringService } from './evidence/evidence-scoring.service';
import {
  NUTRITION_SOURCE_ADAPTERS,
  NutritionSourceRegistry,
} from './nutrition/nutrition-source-adapter';
import { NutritionCalculatorService } from './nutrition/nutrition-calculator.service';
import { UsdaFdcAdapter } from './nutrition/usda-fdc.adapter';
import { VietnamFctAdapter } from './nutrition/vietnam-fct.adapter';
import { JsonLdWebsiteAdapter } from './sources/json-ld-website.adapter';
import { RecipeSourceDiscoveryService } from './sources/recipe-source-discovery.service';
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
    RecipeSourceDiscoveryService,
    EvidenceScoringService,
    DuplicateScoringService,
    VietnamFctAdapter,
    UsdaFdcAdapter,
    {
      provide: NUTRITION_SOURCE_ADAPTERS,
      inject: [VietnamFctAdapter, UsdaFdcAdapter],
      useFactory: (vfct: VietnamFctAdapter, usda: UsdaFdcAdapter) => [vfct, usda],
    },
    NutritionSourceRegistry,
    NutritionCalculatorService,
  ],
  exports: [
    SourceIntegrationConfigService,
    SafeSourceFetcherService,
    JsonLdWebsiteAdapter,
    SourceIntegrationService,
    RecipeSourceDiscoveryService,
    EvidenceScoringService,
    DuplicateScoringService,
    NutritionSourceRegistry,
    NutritionCalculatorService,
  ],
})
export class SourceEvidenceModule {}
