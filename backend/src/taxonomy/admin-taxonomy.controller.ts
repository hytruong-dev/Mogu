import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';
import { TaxonomyService } from './taxonomy.service';
import {
  CreateAllergenDto,
  CreateCategoryDto,
  UpdateAllergenDto,
  UpdateCategoryDto,
} from './dto/taxonomy-admin.dto';

@ApiTags('admin-taxonomy')
@Controller('admin/taxonomy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.SUPER_ADMIN, SystemRole.CONTENT_ADMIN)
export class AdminTaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  // ─── DishCategory ────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: '[Admin] Lấy tất cả danh mục (bao gồm inactive)' })
  listCategories() {
    return this.taxonomyService.adminListCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: '[Admin] Tạo danh mục mới' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.taxonomyService.adminCreateCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật danh mục' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.adminUpdateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '[Admin] Ẩn/xóa danh mục (soft delete)' })
  deleteCategory(@Param('id') id: string) {
    return this.taxonomyService.adminDeleteCategory(id);
  }

  // ─── DietType ────────────────────────────────────────────────────────────

  @Get('diet-types')
  @ApiOperation({ summary: '[Admin] Lấy tất cả chế độ ăn (bao gồm inactive)' })
  listDietTypes() {
    return this.taxonomyService.adminListDietTypes();
  }

  @Post('diet-types')
  @ApiOperation({ summary: '[Admin] Tạo chế độ ăn mới' })
  createDietType(@Body() dto: CreateCategoryDto) {
    return this.taxonomyService.adminCreateDietType(dto);
  }

  @Patch('diet-types/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật chế độ ăn' })
  updateDietType(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.adminUpdateDietType(id, dto);
  }

  @Delete('diet-types/:id')
  @ApiOperation({ summary: '[Admin] Ẩn chế độ ăn (soft delete)' })
  deleteDietType(@Param('id') id: string) {
    return this.taxonomyService.adminDeleteDietType(id);
  }

  // ─── MealTypeTag ─────────────────────────────────────────────────────────

  @Get('meal-types')
  @ApiOperation({ summary: '[Admin] Lấy tất cả loại bữa ăn' })
  listMealTypes() {
    return this.taxonomyService.adminListMealTypes();
  }

  @Post('meal-types')
  @ApiOperation({ summary: '[Admin] Tạo loại bữa ăn mới' })
  createMealType(@Body() dto: CreateCategoryDto) {
    return this.taxonomyService.adminCreateMealType(dto);
  }

  @Patch('meal-types/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật loại bữa ăn' })
  updateMealType(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.taxonomyService.adminUpdateMealType(id, dto);
  }

  @Delete('meal-types/:id')
  @ApiOperation({ summary: '[Admin] Ẩn loại bữa ăn' })
  deleteMealType(@Param('id') id: string) {
    return this.taxonomyService.adminDeleteMealType(id);
  }

  // ─── Allergen ─────────────────────────────────────────────────────────────

  @Get('allergens')
  @ApiOperation({ summary: '[Admin] Lấy tất cả dị ứng (kể cả inactive)' })
  listAllergens() {
    return this.taxonomyService.adminListAllergens();
  }

  @Post('allergens')
  @ApiOperation({ summary: '[Admin] Tạo mã dị ứng mới' })
  createAllergen(@Body() dto: CreateAllergenDto) {
    return this.taxonomyService.adminCreateAllergen(dto);
  }

  @Patch('allergens/:id')
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin dị ứng' })
  updateAllergen(@Param('id') id: string, @Body() dto: UpdateAllergenDto) {
    return this.taxonomyService.adminUpdateAllergen(id, dto);
  }

  @Patch('allergens/:id/toggle')
  @ApiOperation({ summary: '[Admin] Bật/Tắt hiển thị dị ứng' })
  toggleAllergen(@Param('id') id: string) {
    return this.taxonomyService.adminToggleAllergen(id);
  }
}
