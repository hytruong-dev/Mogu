import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@ApiBearerAuth()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('calendar')
  @ApiOperation({ summary: 'Xem lịch nhật ký sức khỏe theo tháng' })
  getCalendar(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('timezone') timezone?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.health.getCalendar(userId, month, timezone);
  }

  @Get('days/:localDate')
  @ApiOperation({ summary: 'Health day BFF' })
  getDay(
    @CurrentUser() user: any,
    @Param('localDate') localDate: string,
    @Query('timezone') timezone?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.health.getDay(userId, localDate, timezone || 'Asia/Ho_Chi_Minh');
  }
}
