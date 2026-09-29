import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFoodScanService } from './admin-food-scan.service';
import {
  ListMissingDishesQueryDto,
  UpdateMissingDishDto,
} from './dto/admin-food-scan.dto';

@ApiTags('Admin — Food Scan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.SUPER_ADMIN, SystemRole.CONTENT_ADMIN)
@Controller('admin/food-scan/missing-dishes')
export class AdminFoodScanController {
  constructor(private readonly service: AdminFoodScanService) {}

  private actorId(user: unknown): string {
    if (typeof user === 'string') return user;
    const u = user as { sub?: string; id?: string };
    return (u.sub ?? u.id) as string;
  }

  @Get('summary')
  @ApiOperation({ summary: '[Admin] Đếm món chưa có theo trạng thái' })
  summary() {
    return this.service.summary();
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách món quét chưa có trong DB' })
  list(@Query() query: ListMissingDishesQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '[Admin] Cập nhật trạng thái / liên kết món / thêm tên gọi khác',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMissingDishDto,
    @CurrentUser() user: unknown,
  ) {
    return this.service.update(id, dto, this.actorId(user));
  }
}
