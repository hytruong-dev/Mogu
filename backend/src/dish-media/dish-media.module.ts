import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DishMediaController } from './dish-media.controller';
import { DishMediaService } from './dish-media.service';

@Module({
  imports: [ConfigModule],
  controllers: [DishMediaController],
  providers: [DishMediaService],
  exports: [DishMediaService],
})
export class DishMediaModule {}
