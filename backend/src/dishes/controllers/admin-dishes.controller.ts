import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateDishDto } from '../dto/create-dish.dto';
import { SaveDishSourcesDto, SubmitReviewDto } from '../dto/dish-source.dto';
import { DishAdminQueryDto } from '../dto/dish-query.dto';
import { UpdateDishDto } from '../dto/update-dish.dto';
import { DishCommandService } from '../services/dish-command.service';
import { DishQueryService } from '../services/dish-query.service';

@ApiTags('admin/dishes')
@Controller('admin/dishes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminDishesController {
  constructor(
    private readonly dishQueryService: DishQueryService,
    private readonly dishCommandService: DishCommandService,
  ) {}

  // ── Query ───────────────────────────────────────────────────────────────

  @Get()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách món ăn theo mọi trạng thái' })
  adminList(@Query() query: DishAdminQueryDto) {
    return this.dishQueryService.adminList(query);
  }

  @Get('unlinked-ingredients')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] DishIngredient chưa được link với Ingredient DB' })
  getUnlinkedIngredients() {
    return this.dishQueryService.getUnlinkedIngredients();
  }

  @Get(':id/validation')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Checklist trước khi gửi duyệt' })
  getValidation(@Param('id') id: string) {
    return this.dishQueryService.getValidation(id);
  }

  @Get(':id')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Xem chi tiết (mọi trạng thái)' })
  adminDetail(@Param('id') id: string) {
    return this.dishQueryService.adminDetail(id);
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  @Post()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Admin] Tạo món ăn mới',
    description: 'Tạo món ăn kèm nutrition, ingredients, và recipe_steps trong 1 request',
  })
  create(@Body() dto: CreateDishDto, @CurrentUser('sub') actorId: string) {
    return this.dishCommandService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Cập nhật món (hỗ trợ If-Match header cho optimistic locking)' })
  @ApiHeader({
    name: 'If-Match',
    description: 'Version hiện tại của dish (optimistic locking)',
    required: false,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDishDto,
    @CurrentUser('sub') actorId: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.dishCommandService.update(id, dto, actorId, ifMatch);
  }

  @Post(':id/submit-review')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Gửi kiểm duyệt' })
  submitReview(
    @Param('id') id: string,
    @Body() body: SubmitReviewDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.dishCommandService.submitForReview(id, actorId, body);
  }

  @Put(':id/sources')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Lưu nguồn tham khảo món ăn' })
  saveSources(
    @Param('id') id: string,
    @Body() body: SaveDishSourcesDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.dishCommandService.saveSources(id, body.sources ?? [], actorId);
  }

  @Post(':id/unpublish')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin/Reviewer] Gỡ xuất bản' })
  unpublish(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.dishCommandService.unpublish(id, actorId);
  }

  @Post(':id/republish')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Reviewer] Xuất bản lại từ UNPUBLISHED' })
  republish(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.dishCommandService.republish(id, actorId);
  }

  @Post(':id/archive')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Archive món ăn' })
  archive(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.dishCommandService.archive(id, actorId);
  }

  @Post(':id/restore')
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Khôi phục từ ARCHIVED về DRAFT' })
  restore(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.dishCommandService.restore(id, actorId);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Xóa mềm món ăn (soft delete)' })
  softDelete(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.dishCommandService.softDelete(id, actorId);
  }
}
