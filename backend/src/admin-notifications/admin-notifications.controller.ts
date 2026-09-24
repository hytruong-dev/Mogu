import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminNotificationsService } from './admin-notifications.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@ApiTags('admin/notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Post('broadcast')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Phát thông báo In-app + Expo Push' })
  broadcast(
    @CurrentUser() user: { id: string },
    @Body() dto: BroadcastNotificationDto,
  ) {
    return this.service.broadcast(user.id, dto);
  }

  @Get('history')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Lịch sử broadcast thông báo' })
  getHistory(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.getHistory(
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
  }
}
