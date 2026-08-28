import { Module } from '@nestjs/common';
import { AdminDishesController } from './controllers/admin-dishes.controller';
import { DishesController } from './controllers/dishes.controller';
import { DishCommandService } from './services/dish-command.service';
import { DishQueryService } from './services/dish-query.service';
// Legacy — save/unsave (BA-003 compat)
import { DishesService } from './dishes.service';

@Module({
  controllers: [DishesController, AdminDishesController],
  providers: [DishQueryService, DishCommandService, DishesService],
  exports: [DishQueryService, DishCommandService, DishesService],
})
export class DishesModule {}
