import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  RegisterPushInstallationDto,
  UnreadCountResponseDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Đếm thông báo chưa đọc' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async getUnreadCount(
    @CurrentUser('sub') userId: string,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Danh sách thông báo (cursor + page compat)' })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async getNotifications(
    @CurrentUser('sub') userId: string,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.getNotifications(userId, query);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  async markAllRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu đã đọc' })
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

  @Post('me/push-installations')
  @ApiOperation({ summary: 'Đăng ký push token' })
  registerPush(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterPushInstallationDto,
  ) {
    return this.notificationsService.registerPushInstallation(userId, dto);
  }

  @Delete('me/push-installations/:id')
  @ApiOperation({ summary: 'Hủy đăng ký push token' })
  unregisterPush(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.unregisterPushInstallation(userId, id);
  }
}
