import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WeeklyPlanConfigService } from './services/weekly-plan-config.service';
import { UpsertWeeklyPlanConfigDto } from './dto/upsert-weekly-plan-config.dto';

@ApiTags('Weekly Plan Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weekly-plan-config')
export class WeeklyPlanConfigController {
  constructor(private readonly svc: WeeklyPlanConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Lay cau hinh ke hoach tuan cua user' })
  getMyConfig(@CurrentUser('sub') userId: string) {
    return this.svc.getMyConfig(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Tao/cap nhat cau hinh ke hoach tuan' })
  upsertConfig(@CurrentUser('sub') userId: string, @Body() dto: UpsertWeeklyPlanConfigDto) {
    return this.svc.upsertConfig(userId, dto);
  }
}
