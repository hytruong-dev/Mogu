import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HomeService } from './home.service';
import { HomeDashboardResponseDto } from './dto/home-dashboard.dto';
import { HomeQueryDto } from './dto/home-query.dto';

@ApiTags('Home')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @ApiOperation({
    summary: 'Trang chủ — BFF dashboard tổng hợp',
    description:
      'Trả về tất cả widget của trang chủ (greeting, gợi ý, dinh dưỡng, thông báo) trong một request duy nhất. Mỗi widget có status riêng, lỗi một widget không ảnh hưởng các widget khác. Query tùy chọn: localDate (YYYY-MM-DD), timezone (IANA).',
  })
  @ApiOkResponse({ type: HomeDashboardResponseDto })
  async getDashboard(
    @CurrentUser('sub') userId: string,
    @Query() query: HomeQueryDto,
  ): Promise<HomeDashboardResponseDto> {
    return this.homeService.getDashboard(userId, query);
  }
}
