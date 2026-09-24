import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';

function uid(user: any) {
  return typeof user === 'string' ? user : (user.id ?? user.sub);
}

export class CreateReportDto {
  @ApiProperty({ enum: ['COMMUNITY_POST', 'COMMENT', 'USER'] })
  @IsIn(['COMMUNITY_POST', 'COMMENT', 'USER'])
  targetType: 'COMMUNITY_POST' | 'COMMENT' | 'USER';

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiProperty({ example: 'SPAM' })
  @IsString()
  reasonCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RecommendationFeedbackDto {
  @ApiProperty({ enum: ['COMMUNITY_POST', 'DISH', 'ARTICLE'] })
  @IsIn(['COMMUNITY_POST', 'DISH', 'ARTICLE'])
  contentType: 'COMMUNITY_POST' | 'DISH' | 'ARTICLE';

  @ApiProperty()
  @IsUUID()
  contentId: string;

  @ApiProperty({
    enum: ['NOT_INTERESTED', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS', 'HIDE_AUTHOR', 'WHY_THIS'],
  })
  @IsIn(['NOT_INTERESTED', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS', 'HIDE_AUTHOR', 'WHY_THIS'])
  action:
    | 'NOT_INTERESTED'
    | 'MORE_LIKE_THIS'
    | 'LESS_LIKE_THIS'
    | 'HIDE_AUTHOR'
    | 'WHY_THIS';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rankingToken?: string;
}

@ApiTags('Moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('report-reasons')
  @ApiOperation({ summary: 'Danh sách lý do báo cáo' })
  reportReasons(@Query('targetType') targetType?: string) {
    return this.moderationService.listReportReasons(targetType);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Tạo báo cáo nội dung' })
  createReport(@CurrentUser() user: any, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(uid(user), dto);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeHiddenController {
  constructor(private readonly moderationService: ModerationService) {}

  @Put('hidden-content/:contentType/:contentId')
  hide(
    @CurrentUser() user: any,
    @Param('contentType') contentType: string,
    @Param('contentId') contentId: string,
  ) {
    return this.moderationService.hideContent(uid(user), contentType, contentId);
  }

  @Delete('hidden-content/:contentType/:contentId')
  unhide(
    @CurrentUser() user: any,
    @Param('contentType') contentType: string,
    @Param('contentId') contentId: string,
  ) {
    return this.moderationService.unhideContent(uid(user), contentType, contentId);
  }
}

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller()
export class RecommendationFeedbackController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('recommendation-feedback')
  feedback(@CurrentUser() user: any, @Body() dto: RecommendationFeedbackDto) {
    return this.moderationService.createFeedback(uid(user), dto);
  }

  @Get('recommendations/explanations/:contentType/:contentId')
  explanation(
    @Param('contentType') contentType: string,
    @Param('contentId') contentId: string,
    @Query('rankingToken') rankingToken?: string,
  ) {
    return this.moderationService.getExplanation(contentType, contentId, rankingToken);
  }
}
