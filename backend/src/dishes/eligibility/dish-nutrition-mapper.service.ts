import { Injectable } from '@nestjs/common';
import {
  mapNutritionToPlanServing,
  planPriceVnd,
  type PlanServingNutrition,
  type RawDishNutrition,
} from './dish-nutrition.mapper';

@Injectable()
export class DishNutritionMapperService {
  toPlanServing(nutrition: RawDishNutrition | null | undefined): PlanServingNutrition {
    return mapNutritionToPlanServing(nutrition);
  }

  priceMin(priceMin: number | null | undefined): number | null {
    return planPriceVnd(priceMin);
  }
}
