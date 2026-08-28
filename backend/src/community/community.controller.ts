import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListPostsDto } from './dto/list-posts.dto';

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ─── Posts ───────────────────────────────────────────────────────────────
  @Get('posts')
  @ApiOperation({ summary: 'Feed bài đăng cộng đồng (cursor pagination)' })
  listPosts(
    @Query() dto: ListPostsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.communityService.listPosts(dto, user.id);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Tạo bài đăng mới' })
  createPost(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePostDto,
  ) {
    return this.communityService.createPost(user.id, dto);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Xóa bài đăng của mình' })
  deletePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communityService.deletePost(id, user.id);
  }

  // ─── Likes ────────────────────────────────────────────────────────────────
  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like/unlike bài đăng (idempotent toggle)' })
  toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communityService.toggleLike(id, user.id);
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Danh sách comments của bài đăng' })
  listComments(@Param('id', ParseUUIDPipe) id: string) {
    return this.communityService.listComments(id);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Thêm comment' })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.addComment(id, user.id, dto);
  }

  @Delete('posts/:id/comments/:commentId')
  @ApiOperation({ summary: 'Xóa comment của mình' })
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.communityService.deleteComment(id, commentId, user.id);
  }
}
