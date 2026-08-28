import { Module } from '@nestjs/common';
import { DishReviewController } from './dish-review.controller';
import { DishReviewService } from './dish-review.service';

@Module({
  controllers: [DishReviewController],
  providers: [DishReviewService],
  exports: [DishReviewService],
})
export class DishReviewModule {}
