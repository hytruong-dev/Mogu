import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ImportJobsService } from './import-jobs.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

class ImportJobListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}

@ApiTags('Admin — Import Jobs (AI)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
@Controller('admin/import-jobs')
export class ImportJobsController {
  constructor(private readonly service: ImportJobsService) {}

  /**
   * POST /admin/import-jobs
   * Tạo job import mới, pipeline AI chạy ngay lập tức bất đồng bộ.
   * Dùng WebSocket /import để theo dõi tiến trình real-time.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo job nhập món tự động bằng AI' })
  create(@Body() dto: CreateImportJobDto, @CurrentUser('sub') actorId: string) {
    return this.service.create(dto, actorId);
  }

  /**
   * GET /admin/import-jobs
   * Danh sách jobs (mới nhất trước)
   */
  @Get()
  @ApiOperation({ summary: 'Danh sách import jobs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Query() query: ImportJobListQueryDto,
  ) {
    return this.service.findAll(query.limit, query.cursor);
  }

  /**
   * GET /admin/import-jobs/:id
   * Chi tiết job bao gồm logs từng bước
   */
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết import job (kèm logs)' })
  @ApiParam({ name: 'id', description: 'UUID của job' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /**
   * POST /admin/import-jobs/:id/cancel
   * Hủy job đang chạy
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy import job' })
  @ApiParam({ name: 'id', description: 'UUID của job' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }
}
