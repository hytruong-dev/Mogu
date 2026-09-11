import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Get(':id')
  getOne(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealLogs.getById(user.id, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealLogs.remove(user.id, id);
  }
}
