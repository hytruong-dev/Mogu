import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  FoodScanController,
  FoodScanRateLimiter,
} from './food-scan.controller';
import { FoodScanVisionService } from './food-scan-vision.service';
import { FoodScanMatcherService } from './food-scan-matcher.service';
import { FoodScanRetrievalService } from './food-scan-retrieval.service';
import { FoodScanEmbeddingService } from './food-scan-embedding.service';
import { FoodScanRerankService } from './food-scan-rerank.service';
import { FoodScanReportService } from './food-scan-report.service';

@Module({
  imports: [PrismaModule],
  controllers: [FoodScanController],
  providers: [
    FoodScanVisionService,
    FoodScanMatcherService,
    FoodScanRetrievalService,
    FoodScanEmbeddingService,
    FoodScanRerankService,
    FoodScanReportService,
    FoodScanRateLimiter,
  ],
  exports: [
    FoodScanVisionService,
    FoodScanMatcherService,
    FoodScanRetrievalService,
    FoodScanEmbeddingService,
    FoodScanRerankService,
    FoodScanReportService,
  ],
})
export class FoodScanModule {}
