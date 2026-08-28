import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestChangesDto, ReviewActionDto } from './dto/review-action.dto';
import { DishReviewService } from './dish-review.service';

@ApiTags('admin/review')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DishReviewController {
  constructor(private readonly reviewService: DishReviewService) {}

  @Get('review-queue')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Reviewer] Hàng đợi kiểm duyệt' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_REVIEW', 'CHANGES_REQUESTED'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getQueue(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getReviewQueue({ status, cursor, limit });
  }

  @Post('dishes/:id/approve')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Reviewer] Duyệt & publish món ăn' })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.reviewService.approve(id, actorId, dto);
  }

  @Post('dishes/:id/request-changes')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Reviewer] Yêu cầu chỉnh sửa' })
  requestChanges(
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.reviewService.requestChanges(id, actorId, dto);
  }

  @Post('dishes/:id/reject')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Reviewer] Từ chối xuất bản' })
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.reviewService.reject(id, actorId, dto);
  }
}
