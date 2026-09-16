import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
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

  @Delete('measurements/:id')
  @ApiOperation({ summary: 'Xóa chỉ số cơ thể' })
  deleteMeasurement(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.deleteMeasurement(userId, id);
  }

  @Get(['health-targets', 'health-targets/current'])
  @ApiOperation({ summary: 'Lấy mục tiêu sức khỏe hiện tại' })
  getHealthTarget(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.getHealthTarget(userId);
  }

  @Put(['health-targets', 'health-targets/current'])
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

  @Post('health-targets/recalculate')
  @ApiOperation({ summary: 'Tính lại mục tiêu sức khỏe từ measurements' })
  recalculate(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.measurementsTargetsService.recalculateHealthTarget(userId);
  }
}
