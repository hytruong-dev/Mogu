import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  DashboardActivitiesQueryDto,
  DashboardGrowthQueryDto,
  DashboardSummaryQueryDto,
  DashboardTrendingQueryDto,
} from './dto/dashboard-query.dto';

@ApiTags('Admin — Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: '[Admin] KPI tổng quan + tasks + insight' })
  summary(@Query() query: DashboardSummaryQueryDto) {
    return this.service.getSummary(query.range ?? '7d');
  }

  @Get('growth')
  @ApiOperation({ summary: '[Admin] Time-series tăng trưởng món (ngày trống = 0)' })
  growth(@Query() query: DashboardGrowthQueryDto) {
    return this.service.getGrowth(query.days ?? 7);
  }

  @Get('trending-dishes')
  @ApiOperation({ summary: '[Admin] Top món thịnh hành theo recommendation_logs' })
  trending(@Query() query: DashboardTrendingQueryDto) {
    return this.service.getTrendingDishes(query.window ?? '7d', query.limit ?? 5);
  }

  @Get('activities')
  @ApiOperation({ summary: '[Admin] Activity feed hợp nhất (import / review / moderation / admin)' })
  activities(@Query() query: DashboardActivitiesQueryDto) {
    return this.service.getActivities({
      limit: query.limit,
      types: query.types,
      cursor: query.cursor,
    });
  }
}
