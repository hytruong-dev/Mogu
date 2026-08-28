import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WeeklyPlansService } from './services/weekly-plans.service';
import { GenerateWeeklyPlanDto } from './dto/generate-weekly-plan.dto';
import { WeeklyPlanQueryDto } from './dto/weekly-plan-query.dto';

@ApiTags('Weekly Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weekly-plans')
export class WeeklyPlansController {
  constructor(private readonly svc: WeeklyPlansService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Tao ke hoach tuan moi (202 Accepted, async)' })
  generate(@CurrentUser('sub') userId: string, @Body() dto: GenerateWeeklyPlanDto) {
    return this.svc.generate(userId, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Lay ke hoach hien tai (ACTIVE hoac READY moi nhat)' })
  getCurrent(@CurrentUser('sub') userId: string) {
    return this.svc.getCurrent(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sach lich su ke hoach (cursor pagination)' })
  listPlans(@CurrentUser('sub') userId: string, @Query() query: WeeklyPlanQueryDto) {
    return this.svc.listPlans(userId, query);
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Chi tiet ke hoach theo ID, slots grouped by day' })
  getById(@CurrentUser('sub') userId: string, @Param('planId') planId: string) {
    return this.svc.getById(planId, userId);
  }

  @Post(':planId/start')
  @ApiOperation({ summary: 'Chuyen ke hoach READY sang ACTIVE' })
  @ApiHeader({ name: 'If-Match', description: 'Plan version for optimistic lock', required: true })
  startPlan(
    @CurrentUser('sub') userId: string,
    @Param('planId') planId: string,
    @Headers('if-match') ifMatch: string,
  ) {
    const version = parseInt(ifMatch ?? '0', 10);
    return this.svc.startPlan(planId, userId, version);
  }

  @Post(':planId/regenerate')
  @ApiOperation({ summary: 'Archive ke hoach cu, tao ke hoach moi cung config + ngay' })
  regenerate(@CurrentUser('sub') userId: string, @Param('planId') planId: string) {
    return this.svc.regeneratePlan(planId, userId);
  }

  @Post(':planId/archive')
  @ApiOperation({ summary: 'Archive ke hoach' })
  archive(@CurrentUser('sub') userId: string, @Param('planId') planId: string) {
    return this.svc.archivePlan(planId, userId);
  }
}
