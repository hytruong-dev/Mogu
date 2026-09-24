import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@ApiTags('Topics')
@UseGuards(RolesGuard)
@Controller()
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  // ─── Public ──────────────────────────────────────────────────────────────
  @Public()
  @Get('topics')
  @ApiOperation({ summary: 'Lấy danh sách topics active (public)' })
  listPublic() {
    return this.topicsService.findAllPublic();
  }

  @Public()
  @Get('topics/:slug/feed')
  @ApiOperation({ summary: 'Feed bài viết theo chủ đề' })
  topicFeed(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.topicsService.getFeedBySlug(slug, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────
  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Get('admin/topics')
  @ApiOperation({ summary: '[Admin] Danh sách tất cả topics' })
  listAdmin() {
    return this.topicsService.findAllAdmin();
  }

  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Post('admin/topics')
  @ApiOperation({ summary: '[Admin] Tạo topic mới' })
  create(@Body() dto: CreateTopicDto) {
    return this.topicsService.create(dto);
  }

  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Patch('admin/topics/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật topic' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.topicsService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN')
  @Delete('admin/topics/:id')
  @ApiOperation({ summary: '[Admin] Xóa topic' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.topicsService.remove(id);
  }
}
