import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  NotificationDto,
  NotificationListResponseDto,
  NotificationQueryDto,
  UnreadCountResponseDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  @ApiOperation({
    summary: 'Đếm thông báo chưa đọc',
    description:
      'Trả về raw count. Client tự hiển thị "99+" nếu count > 99 (HOME-BR-013). Dùng cho badge trên tab bar.',
  })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async getUnreadCount(
    @CurrentUser('sub') userId: string,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách thông báo',
    description: 'Phân trang, sắp xếp mới nhất trước.',
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async getNotifications(
    @CurrentUser('sub') userId: string,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.getNotifications(userId, query);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đánh dấu đã đọc',
    description: 'Idempotent — thông báo đã đọc vẫn trả 200. Validate ownership bằng userId.',
  })
  @ApiParam({ name: 'id', description: 'UUID của thông báo' })
  @ApiOkResponse({ type: NotificationDto })
  @ApiNotFoundResponse({ description: 'Thông báo không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền thao tác' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') notificationId: string,
  ): Promise<NotificationDto> {
    return this.notificationsService.markAsRead(userId, notificationId);
  }
}
