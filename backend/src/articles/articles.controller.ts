import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { CreateArticleCommentDto } from './dto/create-article-comment.dto';

@ApiTags('Articles')
@UseGuards(RolesGuard)
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
  findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    const userId =
      user == null
        ? undefined
        : typeof user === 'string'
          ? user
          : (user.id ?? user.sub);
    return this.articlesService.findOne(id, userId);
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

  @ApiBearerAuth()
  @Post('articles/:id/like')
  @ApiOperation({ summary: 'Toggle like bài viết' })
  toggleLike(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.toggleLike(id, userId);
  }

  @Public()
  @Get('articles/:id/comments')
  @ApiOperation({ summary: 'Danh sách bình luận bài viết' })
  listComments(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    const userId =
      user == null
        ? undefined
        : typeof user === 'string'
          ? user
          : (user.id ?? user.sub);
    return this.articlesService.listComments(id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      sort,
      userId,
    });
  }

  @ApiBearerAuth()
  @Post('articles/:id/comments/:commentId/like')
  @ApiOperation({ summary: 'Toggle like bình luận bài viết' })
  toggleCommentLike(
    @Param('id') id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.toggleCommentLike(id, commentId, userId);
  }

  @ApiBearerAuth()
  @Post('articles/:id/comments')
  @ApiOperation({ summary: 'Thêm bình luận bài viết' })
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateArticleCommentDto,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.addComment(id, userId, dto.content, dto.parentCommentId);
  }

  @ApiBearerAuth()
  @Delete('articles/:id/comments/:commentId')
  @ApiOperation({ summary: 'Xóa bình luận bài viết của mình' })
  deleteComment(
    @Param('id') id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.deleteComment(id, commentId, userId);
  }

  @ApiBearerAuth()
  @Put('articles/:id/saves/me')
  @ApiOperation({ summary: 'Lưu / bookmark bài viết' })
  saveArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.saveArticle(userId, id);
  }

  @ApiBearerAuth()
  @Delete('articles/:id/saves/me')
  @ApiOperation({ summary: 'Bỏ lưu bài viết' })
  unsaveArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.unsaveArticle(userId, id);
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
  @ApiOperation({ summary: '[Admin] Toggle publish/archive hoặc lên lịch (SCHEDULED)' })
  publish(
    @Param('id') id: string,
    @Body() body?: { publishAt?: string; schedule?: boolean },
  ) {
    return this.articlesService.publish(id, body);
  }

  @ApiBearerAuth()
  @Roles('CONTENT_ADMIN', 'SUPER_ADMIN')
  @Patch('admin/articles/:id/pin')
  @ApiOperation({ summary: '[Admin] Ghim/Bỏ ghim bài viết làm bài nổi bật (feature)' })
  togglePin(
    @Param('id') id: string,
    @Body() body?: { isPinned?: boolean },
  ) {
    return this.articlesService.togglePin(id, body?.isPinned);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN')
  @Delete('admin/articles/:id')
  @ApiOperation({ summary: '[Admin] Xóa bài viết' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.remove(id);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get('saved-articles')
  @ApiOperation({ summary: 'Danh sách bài viết đã lưu' })
  listSaved(
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.id ?? user.sub);
    return this.articlesService.listSavedArticles(userId, cursor, limit, q);
  }
}
