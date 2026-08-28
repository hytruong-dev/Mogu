import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecommendationsService } from './recommendations.service';
import {
  RecommendationListResponseDto,
  RecommendationQueryDto,
} from './dto/recommendation-query.dto';

@ApiTags('Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('home')
  @ApiOperation({
    summary: 'Gợi ý món dành cho trang chủ',
    description:
      'Trả về danh sách món ăn được gợi ý cá nhân hóa. Tự động hard-exclude các món vi phạm dị ứng của user (HOME-BR-008). Hỗ trợ phân trang và filter theo goalCode cho phiên Random.',
  })
  @ApiOkResponse({ description: 'Danh sách gợi ý phân trang' })
  async getHomeRecommendations(
    @CurrentUser('sub') userId: string,
    @Query() query: RecommendationQueryDto,
  ): Promise<RecommendationListResponseDto> {
    return this.recommendationsService.getHomeRecommendations(userId, query);
  }
}
