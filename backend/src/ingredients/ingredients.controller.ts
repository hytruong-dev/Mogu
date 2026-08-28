import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';
import { IngredientsService } from './ingredients.service';

// ── Public: tìm kiếm từ điển ─────────────────────────────────────────────────
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

// ── Admin: CRUD + presign ─────────────────────────────────────────────────────
@ApiTags('admin/ingredients')
@Controller('admin/ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminIngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Danh sách nguyên liệu (phân trang)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'allergenCode', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminList(
    @Query('q') q?: string,
    @Query('allergenCode') allergenCode?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ingredientsService.adminList({
      q,
      allergenCode,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
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

  @Delete(':id')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Deactivate nguyên liệu (soft delete)' })
  softDelete(@Param('id') id: string) {
    return this.ingredientsService.softDelete(id);
  }

  @Post(':id/presign-upload')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Lấy signed URL để upload ảnh nguyên liệu' })
  presignUpload(@Param('id') id: string) {
    return this.ingredientsService.presignIngredientImage(id);
  }
}
