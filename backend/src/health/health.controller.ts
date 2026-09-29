import { Body, Controller, DefaultValuePipe, Get, Param, ParseBoolPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HealthService } from './health.service';
import { MeasurementsTargetsService } from './measurements-targets.service';

@ApiTags('Health')
@ApiBearerAuth()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly measurementsTargets: MeasurementsTargetsService,
  ) {}

  @Get('health/calendar')
  @ApiOperation({ summary: 'Xem lịch nhật ký sức khỏe theo tháng' })
  @ApiQuery({ name: 'includeWater', required: false, type: Boolean, description: 'Mặc định true; false bỏ truy vấn và dữ liệu nước.' })
  getCalendar(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('timezone') timezone?: string,
    @Query('includeWater', new DefaultValuePipe(true), ParseBoolPipe) includeWater = true,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.health.getCalendar(userId, month, timezone, includeWater);
  }

  @Get('health/days/:localDate')
  @ApiOperation({ summary: 'Health day BFF' })
  @ApiQuery({ name: 'includeWater', required: false, type: Boolean, description: 'Mặc định true; false bỏ truy vấn và dữ liệu nước.' })
  getDay(
    @CurrentUser() user: any,
    @Param('localDate') localDate: string,
    @Query('timezone') timezone?: string,
    @Query('includeWater', new DefaultValuePipe(true), ParseBoolPipe) includeWater = true,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.health.getDay(userId, localDate, timezone || 'Asia/Ho_Chi_Minh', includeWater);
  }

  @Post('activity-sync')
  @ApiOperation({ summary: 'Đồng bộ activity buckets (dedupe)' })
  syncActivity(
    @CurrentUser() user: any,
    @Body()
    dto: {
      provider: string;
      buckets: Array<{
        type: string;
        startAt: string;
        endAt: string;
        value: number;
        dedupeKey?: string;
      }>;
    },
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargets.syncActivity(userId, dto);
  }
}
