import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { MealLogsController } from './meal-logs.controller';
import { WaterLogsController } from './water-logs.controller';
import { HealthService } from './health.service';
import { MealLogsService } from './meal-logs.service';
import { WaterLogsService } from './water-logs.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, MealLogsController, WaterLogsController],
  providers: [HealthService, MealLogsService, WaterLogsService],
  exports: [MealLogsService, HealthService, WaterLogsService],
})
export class HealthModule {}
