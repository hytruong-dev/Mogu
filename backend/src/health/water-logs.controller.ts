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
import { WaterLogsService } from './water-logs.service';
import { CreateWaterLogDto } from './dto/health.dto';

@ApiTags('WaterLogs')
@ApiBearerAuth()
@Controller('water-logs')
export class WaterLogsController {
  constructor(private readonly waterLogs: WaterLogsService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi nước uống' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWaterLogDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.waterLogs.create(user.id, {
      ...dto,
      idempotencyKey: dto.idempotencyKey ?? idempotencyKey,
    });
  }

  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query('localDate') localDate: string,
  ) {
    return this.waterLogs.list(user.id, localDate);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.waterLogs.remove(user.id, id);
  }
}
