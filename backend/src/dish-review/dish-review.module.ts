import { Module } from '@nestjs/common';
import { DishReviewController } from './dish-review.controller';
import { DishReviewService } from './dish-review.service';
import { IngredientsModule } from '../ingredients/ingredients.module';

@Module({
  imports: [IngredientsModule],
  controllers: [DishReviewController],
  providers: [DishReviewService],
  exports: [DishReviewService],
})
export class DishReviewModule {}
