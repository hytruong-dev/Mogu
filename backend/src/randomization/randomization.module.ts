import { Module } from '@nestjs/common';
import { RandomizationController } from './randomization.controller';
import { RandomizationService } from './randomization.service';
import { AiImportModule } from '../ai-import/ai-import.module';
import { DishesModule } from '../dishes/dishes.module';
import { HealthModule } from '../health/health.module';
import { PlacesModule } from '../places/places.module';

@Module({
  imports: [AiImportModule, DishesModule, HealthModule, PlacesModule],
  controllers: [RandomizationController],
  providers: [RandomizationService],
  exports: [RandomizationService],
})
export class RandomizationModule {}
