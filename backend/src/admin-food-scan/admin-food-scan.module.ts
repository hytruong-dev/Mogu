import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FoodScanModule } from '../food-scan/food-scan.module';
import { AdminFoodScanController } from './admin-food-scan.controller';
import { AdminFoodScanService } from './admin-food-scan.service';

@Module({
  imports: [PrismaModule, FoodScanModule],
  controllers: [AdminFoodScanController],
  providers: [AdminFoodScanService],
})
export class AdminFoodScanModule {}
