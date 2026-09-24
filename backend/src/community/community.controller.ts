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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import {
  CreateCommunityMediaIntentDto,
  CreatePostDto,
  UpdatePostDto,
} from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListPostsDto } from './dto/list-posts.dto';

function uid(user: any) {
  return typeof user === 'string' ? user : (user.id ?? user.sub);
}

@ApiTags('Community')
@ApiBearerAuth()
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('hashtags/trending')
  @ApiOperation({ summary: 'Hashtag đang thịnh hành (7 ngày)' })
  trendingHashtags(@Query('limit') limit?: string) {
    return this.communityService.trendingHashtags(limit ? Number(limit) : 20);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Feed bài đăng cộng đồng (cursor pagination)' })
  listPosts(@Query() dto: ListPostsDto, @CurrentUser() user: any) {
    return this.communityService.listPosts(dto, uid(user));
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Chi tiết bài đăng cộng đồng' })
  getPost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.getPostById(id, uid(user));
  }

  @Post('posts')
  @ApiOperation({ summary: 'Tạo bài đăng mới' })
  createPost(@CurrentUser() user: any, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(uid(user), dto);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Cập nhật bài đăng của mình' })
  updatePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePostDto,
  ) {
    return this.communityService.updatePost(id, uid(user), dto);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Xóa bài đăng của mình' })
  deletePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.deletePost(id, uid(user));
  }

  @Post('media/upload-intents')
  @ApiOperation({ summary: 'Tạo signed upload URL cho ảnh community' })
  createMediaIntent(
    @CurrentUser() user: any,
    @Body() dto: CreateCommunityMediaIntentDto,
  ) {
    return this.communityService.createMediaUploadIntent(uid(user), dto);
  }

  @Post('media/:mediaId/finalize')
  @ApiOperation({ summary: 'Finalize media sau khi upload' })
  finalizeMedia(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.finalizeMedia(uid(user), mediaId);
  }

  @Delete('media/:mediaId')
  @ApiOperation({ summary: 'Xóa media chưa gắn / đã gắn' })
  deleteMedia(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.deleteMedia(uid(user), mediaId);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like/unlike bài đăng (idempotent toggle)' })
  toggleLike(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.toggleLike(id, uid(user));
  }

  @Put('posts/:id/likes/me')
  likePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.likePost(id, uid(user));
  }

  @Delete('posts/:id/likes/me')
  unlikePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.unlikePost(id, uid(user));
  }

  @Get('posts/:id/comments')
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.communityService.listComments(id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      sort,
      userId: uid(user),
    });
  }

  @Post('posts/:id/comments/:commentId/like')
  @ApiOperation({ summary: 'Toggle like bình luận bài đăng' })
  toggleCommentLike(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.toggleCommentLike(id, commentId, uid(user));
  }

  @Post('posts/:id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.communityService.addComment(id, uid(user), dto);
  }

  @Delete('posts/:id/comments/:commentId')
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.deleteComment(id, commentId, uid(user));
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Hồ sơ công khai người dùng' })
  getPublicProfile(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.getPublicProfile(uid(user), targetUserId);
  }

  @Get('users/:userId/posts')
  @ApiOperation({ summary: 'Bài đăng công khai của người dùng' })
  listUserPosts(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.communityService.listUserPosts(uid(user), targetUserId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Put('users/:userId/follow/me')
  followUser(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.followUser(uid(user), targetUserId);
  }

  @Delete('users/:userId/follow/me')
  unfollowUser(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.communityService.unfollowUser(uid(user), targetUserId);
  }

  @Put('posts/:id/saves/me')
  savePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.savePost(uid(user), id);
  }

  @Delete('posts/:id/saves/me')
  unsavePost(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.communityService.unsavePost(uid(user), id);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeCommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('saved-posts')
  listSavedPosts(
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
  ) {
    return this.communityService.listSavedPosts(uid(user), cursor, limit, q);
  }
}
