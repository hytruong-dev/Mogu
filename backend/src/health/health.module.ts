import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { MealLogsController } from './meal-logs.controller';
import { WaterLogsController } from './water-logs.controller';
import { CustomFoodsController } from './custom-foods.controller';
import { HealthService } from './health.service';
import { MealLogsService } from './meal-logs.service';
import { WaterLogsService } from './water-logs.service';

import { CustomFoodsService } from './custom-foods.service';
import { MeasurementsTargetsController } from './measurements-targets.controller';
import { MeasurementsTargetsService } from './measurements-targets.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthController,
    MealLogsController,
    WaterLogsController,
    CustomFoodsController,
    MeasurementsTargetsController,
  ],
  providers: [
    HealthService,
    MealLogsService,
    WaterLogsService,
    CustomFoodsService,
    MeasurementsTargetsService,
  ],
  exports: [
    MealLogsService,
    HealthService,
    WaterLogsService,
    CustomFoodsService,
    MeasurementsTargetsService,
  ],
})
export class HealthModule {}
