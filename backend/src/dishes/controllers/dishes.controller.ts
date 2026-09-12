import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { DishPublicQueryDto } from '../dto/dish-query.dto';
import { DishQueryService } from '../services/dish-query.service';

@ApiTags('dishes')
@Public()
@Controller('dishes')
export class DishesController {
  constructor(private readonly dishQueryService: DishQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm/lọc món ăn (chỉ PUBLISHED)' })
  search(@Query() query: DishPublicQueryDto) {
    return this.dishQueryService.searchPublic(query);
  }

  @Get(':idOrSlug/similar')
  @ApiOperation({ summary: 'Lấy các món tương tự' })
  getSimilar(
    @Param('idOrSlug') idOrSlug: string,
    @Query('limit') limit?: number,
  ) {
    return this.dishQueryService.getSimilarDishes(
      idOrSlug,
      limit ? Number(limit) : 5,
    );
  }

  @Get(':idOrSlug/variants')
  @ApiOperation({ summary: 'Danh sách biến thể của món ăn (chỉ PUBLISHED)' })
  getVariants(@Param('idOrSlug') idOrSlug: string) {
    return this.dishQueryService.getVariants(idOrSlug);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Xem chi tiết món ăn (chỉ PUBLISHED)' })
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.dishQueryService.findPublicDetail(idOrSlug);
  }
}
