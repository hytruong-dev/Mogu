import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('taxonomy')
@Controller('taxonomy')
@Public()
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('regions')
  @ApiOperation({ summary: 'Lấy danh sách vùng miền' })
  getRegions() {
    return this.taxonomyService.getRegions();
  }

  @Get('provinces')
  @ApiOperation({ summary: 'Lấy danh sách tỉnh/thành (tùy chọn filter theo regionId)' })
  @ApiQuery({ name: 'regionId', required: false, type: String })
  getProvinces(@Query('regionId') regionId?: string) {
    return this.taxonomyService.getProvinces(regionId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh mục món ăn' })
  getDishCategories() {
    return this.taxonomyService.getDishCategories();
  }

  @Get('meal-types')
  @ApiOperation({ summary: 'Lấy danh sách loại bữa ăn' })
  getMealTypeTags() {
    return this.taxonomyService.getMealTypeTags();
  }

  @Get('diet-types')
  @ApiOperation({ summary: 'Lấy danh sách chế độ ăn' })
  getDietTypes() {
    return this.taxonomyService.getDietTypes();
  }

  @Get('goals')
  @ApiOperation({ summary: 'Lấy danh sách mục tiêu/nhu cầu' })
  getGoals() {
    return this.taxonomyService.getGoals();
  }

  @Get('allergens')
  @ApiOperation({ summary: 'Lấy danh sách nhóm dị ứng' })
  getAllergens() {
    return this.taxonomyService.getAllergens();
  }
}
