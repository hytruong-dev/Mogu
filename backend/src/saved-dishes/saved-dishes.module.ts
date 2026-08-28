import { Module } from '@nestjs/common';
import { SavedDishesController } from './saved-dishes.controller';
import { SavedDishesService } from './saved-dishes.service';

@Module({
  controllers: [SavedDishesController],
  providers: [SavedDishesService],
  exports: [SavedDishesService],
})
export class SavedDishesModule {}
