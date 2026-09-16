import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WeeklyPlansService } from './services/weekly-plans.service';
import { WeeklyPlanSwapService } from './services/weekly-plan-swap.service';
import { SwapWeeklyPlanSlotDto } from './dto/swap-weekly-plan-slot.dto';
import { LockWeeklyPlanSlotDto } from './dto/lock-weekly-plan-slot.dto';
import { CompleteWeeklyPlanSlotDto } from './dto/complete-weekly-plan-slot.dto';

@ApiTags('Weekly Plan Slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weekly-plans/:planId/slots')
export class WeeklyPlanSlotsController {
  constructor(
    private readonly plansSvc: WeeklyPlansService,
    private readonly swapSvc: WeeklyPlanSwapService,
  ) {}

  @Post(':slotId/swap')
  @ApiOperation({ summary: 'Doi mon an cho slot' })
  swapSlot(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
    @Param('slotId') slotId: string,
    @Body() dto: SwapWeeklyPlanSlotDto,
  ) {
    return this.swapSvc.swap(planId, slotId, userId, dto);
  }

  @Patch(':slotId/lock')
  @ApiOperation({ summary: 'Khoa/mo slot (isLocked toggle)' })
  lockSlot(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
    @Param('slotId') slotId: string,
    @Body() dto: LockWeeklyPlanSlotDto,
  ) {
    return this.plansSvc.lockSlot(planId, slotId, userId, dto);
  }

  @Post(':slotId/complete')
  @ApiOperation({ summary: 'Danh dau slot la COMPLETED' })
  completeSlot(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
    @Param('slotId') slotId: string,
    @Body() dto: CompleteWeeklyPlanSlotDto,
  ) {
    return this.plansSvc.completeSlot(planId, slotId, userId, dto);
  }

  @Post(':slotId/skip')
  @ApiOperation({ summary: 'Danh dau slot la SKIPPED' })
  @ApiHeader({ name: 'If-Match', description: 'Slot version', required: true })
  skipSlot(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
    @Param('slotId') slotId: string,
    @Headers('if-match') ifMatch: string,
  ) {
    const version = parseInt(String(ifMatch ?? '0').replace(/"/g, '').trim(), 10);
    return this.plansSvc.skipSlot(planId, slotId, userId, Number.isFinite(version) ? version : 0);
  }
}
