import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

// ── Public: xem đánh giá ─────────────────────────────────────────────────────
@ApiTags('reviews')
@Controller('dishes/:dishId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Danh sách đánh giá của món ăn' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listByDish(
    @Param('dishId') dishId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.listByDish(dishId, { cursor, limit: limit ? Number(limit) : 20 });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo/cập nhật đánh giá của bạn' })
  upsertReview(
    @Param('dishId') dishId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reviewsService.upsertReview(dishId, userId, dto);
  }

  @Delete('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa đánh giá của bạn' })
  deleteMyReview(
    @Param('dishId') dishId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reviewsService.deleteMyReview(dishId, userId);
  }
}

// ── Admin: quản lý reviews ───────────────────────────────────────────────────
@ApiTags('admin/reviews')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách tất cả reviews' })
  @ApiQuery({ name: 'dishId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'isVisible', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminList(
    @Query('dishId') dishId?: string,
    @Query('userId') userId?: string,
    @Query('isVisible') isVisible?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.adminList({
      dishId,
      userId,
      isVisible: isVisible !== undefined ? isVisible === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Patch(':id/hide')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Ẩn review' })
  hideReview(@Param('id') id: string) {
    return this.reviewsService.hideReview(id);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Xóa cứng review' })
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.adminDeleteReview(id);
  }
}
