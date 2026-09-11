import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@ApiBearerAuth()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('days/:localDate')
  @ApiOperation({ summary: 'Health day BFF' })
  getDay(
    @CurrentUser() user: { id: string },
    @Param('localDate') localDate: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.health.getDay(user.id, localDate, timezone || 'Asia/Ho_Chi_Minh');
  }
}
