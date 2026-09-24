import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MealLogsService } from './meal-logs.service';
import { CreateMealLogDto } from './dto/health.dto';

@ApiTags('MealLogs')
@ApiBearerAuth()
@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly mealLogs: MealLogsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo nhật ký bữa ăn' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMealLogDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.mealLogs.create(user.id, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách meal logs theo ngày' })
  list(
    @CurrentUser() user: { id: string },
    @Query('localDate') localDate?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.mealLogs.list(user.id, localDate, timezone);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê nhật ký bữa ăn theo ngày/tuần/tháng/năm' })
  getStats(
    @CurrentUser() user: { id: string },
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('date') date?: string,
    @Query('anchor') anchor?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.mealLogs.getStats(user.id, period || 'day', anchor || date, timezone);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealLogs.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật meal log (If-Match version)' })
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateMealLogDto>,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.mealLogs.update(user.id, id, dto, ifMatch);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    const version = ifMatch
      ? parseInt(ifMatch.replace(/"/g, '').trim(), 10)
      : undefined;
    return this.mealLogs.remove(user.id, id, version);
  }
}
