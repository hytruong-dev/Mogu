import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  MeasurementsTargetsService,
  CreateMeasurementDto,
  UpdateHealthTargetDto,
} from './measurements-targets.service';

@ApiTags('MeasurementsTargets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeasurementsTargetsController {
  constructor(
    private readonly measurementsTargetsService: MeasurementsTargetsService,
  ) {}

  @Post('measurements')
  @ApiOperation({ summary: 'Ghi nhận chỉ số cơ thể (cân nặng, chiều cao)' })
  createMeasurement(
    @CurrentUser() user: any,
    @Body() dto: CreateMeasurementDto,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.createMeasurement(userId, dto);
  }

  @Get('measurements')
  @ApiOperation({ summary: 'Lịch sử chỉ số cơ thể' })
  listMeasurements(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.listMeasurements(userId, type, limit);
  }

  @Get('health-targets')
  @ApiOperation({ summary: 'Lấy mục tiêu sức khỏe hiện tại' })
  getHealthTarget(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.getHealthTarget(userId);
  }

  @Put('health-targets')
  @ApiOperation({ summary: 'Cập nhật mục tiêu sức khỏe (yêu cầu If-Match)' })
  @ApiHeader({ name: 'If-Match', required: true })
  updateHealthTarget(
    @CurrentUser() user: any,
    @Body() dto: UpdateHealthTargetDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.updateHealthTarget(userId, dto, ifMatch);
  }
}
