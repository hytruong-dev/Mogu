import { Module } from '@nestjs/common';
import { AdminDishesController } from './controllers/admin-dishes.controller';
import { DishesController } from './controllers/dishes.controller';
import { DishCommandService } from './services/dish-command.service';
import { DishQueryService } from './services/dish-query.service';
import { DishesService } from './dishes.service';
import { DishEligibilityService } from './eligibility/dish-eligibility.service';
import { DishNutritionMapperService } from './eligibility/dish-nutrition-mapper.service';

@Module({
  controllers: [DishesController, AdminDishesController],
  providers: [
    DishQueryService,
    DishCommandService,
    DishesService,
    DishEligibilityService,
    DishNutritionMapperService,
  ],
  exports: [
    DishQueryService,
    DishCommandService,
    DishesService,
    DishEligibilityService,
    DishNutritionMapperService,
  ],
})
export class DishesModule {}
