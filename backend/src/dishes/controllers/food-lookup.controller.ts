import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { DishQueryService } from '../services/dish-query.service';

@ApiTags('food-lookup')
@Public()
@Controller('food-lookup')
export class FoodLookupController {
  constructor(private readonly dishQueryService: DishQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Tra cứu thông tin dinh dưỡng thực phẩm / món ăn' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'barcode', required: false })
  async lookup(@Query('q') q?: string, @Query('barcode') barcode?: string) {
    const res = await this.dishQueryService.searchPublic({ q, limit: 10 });
    return {
      query: q ?? barcode,
      items: res.data.map((d: any) => ({
        id: d.id,
        name: d.name,
        calories: Number(d.nutrition?.calories ?? 0),
        proteinG: Number(d.nutrition?.protein ?? 0),
        fatG: Number(d.nutrition?.fat ?? 0),
        carbsG: Number(d.nutrition?.carbs ?? 0),
        servingSize: d.servingG ? `${d.servingG}g` : '1 phần',
      })),
    };
  }
}
