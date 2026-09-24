import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModerationService } from './moderation.service';

function uid(user: any) {
  return typeof user === 'string' ? user : (user.id ?? user.sub);
}

export class ResolveReportDto {
  @ApiProperty({
    enum: ['DISMISS', 'HIDE_CONTENT', 'DELETE_CONTENT', 'WARN_USER', 'RESTRICT_USER'],
  })
  @IsIn(['DISMISS', 'HIDE_CONTENT', 'DELETE_CONTENT', 'WARN_USER', 'RESTRICT_USER'])
  action:
    | 'DISMISS'
    | 'HIDE_CONTENT'
    | 'DELETE_CONTENT'
    | 'WARN_USER'
    | 'RESTRICT_USER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('Admin Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('explore/analytics')
  @ApiOperation({ summary: '[Admin] Analytics Explore' })
  analytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.moderationService.adminExploreAnalytics({ from, to });
  }

  @Get('moderation/reports')
  @ApiOperation({ summary: '[Admin] Danh sách báo cáo kiểm duyệt' })
  listReports(
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
    @Query('reasonCode') reasonCode?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.moderationService.adminListReports({
      status,
      targetType,
      reasonCode,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('moderation/reports/stats')
  @ApiOperation({ summary: '[Admin] Thống kê queue báo cáo' })
  reportStats() {
    return this.moderationService.adminReportStats();
  }

  @Get('moderation/reports/:id')
  @ApiOperation({ summary: '[Admin] Chi tiết báo cáo + cùng target' })
  getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.adminGetReport(id);
  }

  @Patch('moderation/reports/:id')
  @ApiOperation({ summary: '[Admin] Xử lý báo cáo' })
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderationService.adminResolveReport(uid(user), id, dto);
  }

  @Get('community/posts')
  @ApiOperation({ summary: '[Admin] Danh sách bài đăng cộng đồng' })
  listPosts(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.moderationService.adminListPosts({
      q,
      status,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('community/posts/:id')
  @ApiOperation({ summary: '[Admin] Chi tiết bài đăng' })
  getPost(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.adminGetPost(id);
  }

  @Patch('community/posts/:id/hide')
  @ApiOperation({ summary: '[Admin] Ẩn bài đăng' })
  hidePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.moderationService.adminSetPostStatus(uid(user), id, 'HIDDEN');
  }

  @Patch('community/posts/:id/restore')
  @ApiOperation({ summary: '[Admin] Khôi phục bài đăng' })
  restorePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.moderationService.adminSetPostStatus(uid(user), id, 'ACTIVE');
  }

  @Delete('community/posts/:id')
  @ApiOperation({ summary: '[Admin] Xóa bài đăng (soft DELETED)' })
  deletePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.moderationService.adminSetPostStatus(uid(user), id, 'DELETED');
  }

  // ─── Comment Moderation ───────────────────────────────────────────────────
  @Get('comments')
  @ApiOperation({ summary: '[Admin] Danh sách bình luận bài viết & bài đăng' })
  listComments(
    @Query('type') type?: 'all' | 'article' | 'post',
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.moderationService.adminListComments({ type, search, limit, offset });
  }

  @Patch('comments/:id/hide')
  @ApiOperation({ summary: '[Admin] Ẩn hoặc khôi phục bình luận' })
  hideComment(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.adminHideComment(id);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: '[Admin] Xóa vĩnh viễn bình luận' })
  deleteComment(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.adminDeleteComment(id);
  }
}
