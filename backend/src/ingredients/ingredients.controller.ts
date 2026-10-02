import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IngredientCreatedVia, SystemRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';
import { ResolveBatchDto } from './dto/resolve-batch.dto';
import { IngredientsService } from './ingredients.service';
import { IngredientCatalogService } from './ingredient-catalog.service';
import { IngredientEnrichmentQueue } from './ingredient-enrichment.queue';

@ApiTags('ingredients')
@Public()
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm từ điển nguyên liệu (public)' })
  search(@Query() query: IngredientQueryDto) {
    return this.ingredientsService.search(query);
  }
}

@ApiTags('admin/ingredients')
@Controller('admin/ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminIngredientsController {
  constructor(
    private readonly ingredientsService: IngredientsService,
    private readonly catalog: IngredientCatalogService,
    private readonly enrichmentQueue: IngredientEnrichmentQueue,
  ) {}

  @Get()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách nguyên liệu (phân trang)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'allergenCode', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'activationStatus', required: false, enum: ['all', 'unactivated', 'activated'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminList(
    @Query('q') q?: string,
    @Query('allergenCode') allergenCode?: string,
    @Query('isActive') isActive?: string,
    @Query('status') status?: string,
    @Query('activationStatus') activationStatus?: 'all' | 'unactivated' | 'activated',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ingredientsService.adminList({
      q,
      allergenCode,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      status,
      activationStatus,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('resolve-batch')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Resolve/provision batch nguyên liệu' })
  async resolveBatch(@Body() dto: ResolveBatchDto) {
    const result = await this.catalog.resolveOrProvisionBatch(dto.items, {
      createMissing: dto.createMissing ?? true,
      enqueueImageEnrichment: true,
      createdVia: IngredientCreatedVia.ADMIN_PICKER,
    });
    return { items: result.items, createdIds: result.createdIds };
  }

  @Get('pending-summary')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách nguyên liệu chưa ACTIVE của món' })
  @ApiQuery({ name: 'dishId', required: true })
  pendingSummary(@Query('dishId') dishId: string) {
    return this.catalog.findUnapprovedForDish(dishId);
  }

  @Post()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Tạo nguyên liệu mới' })
  create(@Body() dto: CreateIngredientDto) {
    return this.ingredientsService.create(dto);
  }

  @Patch(':id')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Cập nhật nguyên liệu' })
  update(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, dto);
  }

  @Post(':id/approve')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Duyệt nguyên liệu → ACTIVE' })
  approve(
    @Param('id') id: string,
    @Body()
    body?: {
      name?: string;
      nameEn?: string;
      description?: string;
      groupLabel?: string;
      unit?: string;
      allergenCode?: string | null;
      synonyms?: string[];
      imageCandidateId?: string;
    },
  ) {
    return this.catalog.approveIngredient(id, body);
  }

  @Post(':id/merge')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Gộp nguyên liệu vào nguyên liệu đích' })
  merge(@Param('id') id: string, @Body() body: { targetId: string }) {
    return this.catalog.mergeIngredient(id, body.targetId);
  }

  @Post(':id/reject')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Từ chối nguyên liệu' })
  reject(@Param('id') id: string) {
    return this.catalog.rejectIngredient(id);
  }

  @Delete(':id')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Xóa nguyên liệu' })
  delete(@Param('id') id: string) {
    return this.ingredientsService.delete(id);
  }

  @Post(':id/presign-upload')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Lấy signed URL để upload ảnh nguyên liệu' })
  presignUpload(@Param('id') id: string) {
    return this.ingredientsService.presignIngredientImage(id);
  }

  @Post(':id/image-searches')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Enqueue tìm ảnh nguyên liệu' })
  async enqueueImageSearch(@Param('id') id: string) {
    await this.enrichmentQueue.enqueueNewIngredients([id]);
    return { ingredientId: id, queued: true };
  }

  @Get(':id/image-candidates')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách image candidates' })
  listImageCandidates(@Param('id') id: string) {
    return this.ingredientsService.listImageCandidates(id);
  }

  @Put(':id/image')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Chọn/approve ảnh nguyên liệu' })
  setImage(
    @Param('id') id: string,
    @Body()
    body: { candidateId?: string; imageUrl?: string; imageKey?: string },
  ) {
    return this.ingredientsService.approveImage(id, body);
  }

  @Delete(':id/image')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Gỡ ảnh nguyên liệu' })
  clearImage(@Param('id') id: string) {
    return this.ingredientsService.clearImage(id);
  }
}
