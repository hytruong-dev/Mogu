import { BadRequestException, Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WeeklyMealSlot } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WeeklyPlanConfigService } from './services/weekly-plan-config.service';
import { WeeklyPlanBudgetEstimatorService } from './services/weekly-plan-budget-estimator.service';
import { UpsertWeeklyPlanConfigDto } from './dto/upsert-weekly-plan-config.dto';

const VALID_SLOTS = Object.values(WeeklyMealSlot) as string[];

@ApiTags('Weekly Plan Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weekly-plan-config')
export class WeeklyPlanConfigController {
  constructor(
    private readonly svc: WeeklyPlanConfigService,
    private readonly estimator: WeeklyPlanBudgetEstimatorService,
  ) {}

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

  @Get('budget-estimate')
  @ApiOperation({
    summary: 'Uoc tinh ngan sach toi thieu / thoai mai theo kho mon va hinh thuc an',
  })
  @ApiQuery({ name: 'slots', required: false, description: 'MORNING,LUNCH,DINNER,SNACK' })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  async budgetEstimate(
    @CurrentUser('sub') userId: string,
    @Query('slots') slotsRaw?: string,
    @Query('days') daysRaw?: string,
  ) {
    const slots = (slotsRaw ? slotsRaw.split(',') : ['MORNING', 'LUNCH', 'DINNER'])
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (slots.length === 0 || slots.some((s) => !VALID_SLOTS.includes(s))) {
      throw new BadRequestException('slots khong hop le');
    }
    const days = Math.min(Math.max(parseInt(daysRaw ?? '7', 10) || 7, 1), 14);
    return this.estimator.estimateForUser(userId, slots as WeeklyMealSlot[], days);
  }
}
