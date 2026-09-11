import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DishesModule } from '../dishes/dishes.module';

@Module({
  imports: [PrismaModule, DishesModule],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
