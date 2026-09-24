import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WeeklyPlanConfigController } from './weekly-plan-config.controller';
import { WeeklyPlansController } from './weekly-plans.controller';
import { WeeklyPlanSlotsController } from './weekly-plan-slots.controller';
import { WeeklyPlanConfigService } from './services/weekly-plan-config.service';
import {
  WeeklyPlansService,
  WEEKLY_PLAN_QUEUE,
  WEEKLY_PLAN_QUEUE_TOKEN,
} from './services/weekly-plans.service';
import { WeeklyPlanGeneratorService } from './services/weekly-plan-generator.service';
import { WeeklyPlanSwapService } from './services/weekly-plan-swap.service';
import { WeeklyPlanCalculatorService } from './services/weekly-plan-calculator.service';
import { WeeklyPlanProcessor } from './processors/weekly-plan.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { DishesModule } from '../dishes/dishes.module';
import { HealthModule } from '../health/health.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { getRedisUrl } from '../common/redis/redis-env';

const REDIS_URL = getRedisUrl();

/**
 * Khi không có Redis, cung cấp null token để @Optional() @Inject() trong
 * WeeklyPlansService nhận được null thay vì throw UnknownDependenciesException.
 */
const nullQueueProvider = {
  provide: WEEKLY_PLAN_QUEUE_TOKEN,
  useValue: null,
};

@Module({
  imports: [
    PrismaModule,
    DishesModule,
    HealthModule,
    NotificationsModule,
    // Chỉ import BullModule khi Redis được cấu hình
    ...(REDIS_URL ? [BullModule.registerQueue({ name: WEEKLY_PLAN_QUEUE })] : []),
  ],
  controllers: [
    WeeklyPlanConfigController,
    WeeklyPlansController,
    WeeklyPlanSlotsController,
  ],
  providers: [
    WeeklyPlanConfigService,
    WeeklyPlansService,
    WeeklyPlanGeneratorService,
    WeeklyPlanSwapService,
    WeeklyPlanCalculatorService,
    // Chỉ đăng ký processor + null placeholder theo điều kiện Redis
    ...(REDIS_URL ? [WeeklyPlanProcessor] : [nullQueueProvider]),
  ],
  exports: [WeeklyPlanConfigService, WeeklyPlansService],
})
export class WeeklyPlansModule {}
