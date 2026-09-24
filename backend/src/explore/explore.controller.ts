import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExploreService } from './explore.service';

class ExploreEventDto {
  @ApiProperty({ enum: ['COMMUNITY_POST', 'ARTICLE', 'DISH'] })
  @IsIn(['COMMUNITY_POST', 'ARTICLE', 'DISH'])
  contentType: 'COMMUNITY_POST' | 'ARTICLE' | 'DISH';

  @ApiProperty()
  @IsUUID()
  contentId: string;

  @ApiProperty({ enum: ['IMPRESSION', 'OPEN_DETAIL', 'DWELL'] })
  @IsIn(['IMPRESSION', 'OPEN_DETAIL', 'DWELL'])
  eventType: 'IMPRESSION' | 'OPEN_DETAIL' | 'DWELL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600000)
  dwellMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rankingToken?: string;
}

class ExploreEventsBodyDto {
  @ApiProperty({ type: [ExploreEventDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExploreEventDto)
  events: ExploreEventDto[];
}

@ApiTags('Explore')
@ApiBearerAuth()
@Controller('explore')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Feed Khám phá — topics + ranked items (article|post)',
  })
  getFeed(
    @CurrentUser() user: any,
    @Query('scope') scope?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('feedSessionId') feedSessionId?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.exploreService.getFeed(userId, {
      scope,
      cursor,
      limit: limit ? Number(limit) : undefined,
      feedSessionId,
    });
  }

  @Post('events')
  @ApiOperation({ summary: 'Batch impression/engagement events cho ranking' })
  recordEvents(@CurrentUser() user: any, @Body() body: ExploreEventsBodyDto) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.exploreService.recordEvents(userId, body.events ?? []);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Nội dung thịnh hành 7 ngày: hashtags, bài viết, bài đăng, món ăn' })
  getTrending(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user?.id ?? user?.sub);
    return this.exploreService.getTrending(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm hợp nhất dish|article|post|user (hỗ trợ tiếng Việt không dấu & mờ)' })
  search(
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.exploreService.search(userId, {
      q,
      type,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
