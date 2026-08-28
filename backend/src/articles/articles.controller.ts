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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';

@ApiTags('Articles')
@Controller()
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // ─── Public ──────────────────────────────────────────────────────────────
  @Public()
  @Get('articles')
  @ApiOperation({ summary: 'Danh sách bài viết đã publish' })
  list(@Query() dto: ListArticlesDto) {
    return this.articlesService.list(dto, true);
  }

  @Public()
  @Get('articles/:id')
  @ApiOperation({ summary: 'Chi tiết bài viết (id hoặc slug)' })
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  // ─── User ────────────────────────────────────────────────────────────────
  @ApiBearerAuth()
  @Post('articles')
  @ApiOperation({ summary: 'Tạo bài viết mới (user, status=DRAFT)' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateArticleDto,
  ) {
    return this.articlesService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Patch('articles/:id')
  @ApiOperation({ summary: 'Cập nhật bài viết của mình' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, user.id, dto, false);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────
  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Get('admin/articles')
  @ApiOperation({ summary: '[Admin] Danh sách tất cả bài viết' })
  listAdmin(@Query() dto: ListArticlesDto) {
    return this.articlesService.list(dto, false);
  }

  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Patch('admin/articles/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật bài viết bất kỳ' })
  updateAdmin(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, user.id, dto, true);
  }

  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Patch('admin/articles/:id/publish')
  @ApiOperation({ summary: '[Admin] Toggle publish/archive bài viết' })
  publish(@Param('id') id: string) {
    return this.articlesService.publish(id);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN')
  @Delete('admin/articles/:id')
  @ApiOperation({ summary: '[Admin] Xóa bài viết' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.remove(id);
  }
}
