import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NutritionService } from './nutrition.service';
import { NutritionTodayQueryDto, NutritionTodayResponseDto } from './dto/nutrition.dto';

@ApiTags('Nutrition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('today')
  @ApiOperation({
    summary: 'Tóm tắt dinh dưỡng hôm nay',
    description:
      'Tính tổng kcal và protein từ meal logs trong ngày local. ' +
      'Trả "no_data" nếu chưa có bữa ăn nào (HOME-BR-012 — không hiển thị số 0 gây hiểu sai). ' +
      'Truyền localDate nếu client muốn chỉ định ngày cụ thể (YYYY-MM-DD).',
  })
  @ApiOkResponse({ type: NutritionTodayResponseDto })
  async getTodaySummary(
    @CurrentUser('sub') userId: string,
    @Query() query: NutritionTodayQueryDto,
  ): Promise<NutritionTodayResponseDto> {
    return this.nutritionService.getTodaySummary(userId, query);
  }
}
