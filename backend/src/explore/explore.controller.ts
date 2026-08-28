import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExploreService } from './explore.service';

@ApiTags('Explore')
@ApiBearerAuth()
@Controller('explore')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Feed trang Khám phá — topics, bài viết nổi bật, posts cộng đồng',
  })
  getFeed(@CurrentUser() user: { id: string }) {
    return this.exploreService.getFeed(user.id);
  }
}
