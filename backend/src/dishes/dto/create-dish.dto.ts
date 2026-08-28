import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DishDifficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Nguyên liệu ────────────────────────────────────────────────────────────
export class CreateDishIngredientDto {
  @ApiPropertyOptional({ description: 'UUID nguyên liệu từ từ điển (nếu đã map)' })
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @ApiProperty({ description: 'Tên nguyên liệu thô (raw text)' })
  @IsString()
  @MaxLength(200)
  rawText: string;

  @ApiPropertyOptional({ description: 'Số lượng' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Đơn vị' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: 'Cách chế biến' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preparation?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isOptional?: boolean;

  @ApiPropertyOptional({ description: 'Nhãn nhóm' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupLabel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// ── Dinh dưỡng (1-1) ────────────────────────────────────────────────────────
export class CreateNutritionDto {
  @ApiPropertyOptional({ description: 'Tên khẩu phần, VD: "1 tô (500g)"' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  servingName?: string;

  @ApiPropertyOptional({ description: 'Trọng lượng khẩu phần (gram)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  servingG?: number;

  @ApiPropertyOptional({ description: 'Năng lượng (kcal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional({ description: 'Đạm (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @ApiPropertyOptional({ description: 'Tinh bột (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @ApiPropertyOptional({ description: 'Chất béo (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fatG?: number;

  @ApiPropertyOptional({ description: 'Chất xơ (g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fiberG?: number;

  @ApiPropertyOptional({ description: 'Natri (mg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sodiumMg?: number;
}

// ── Bước nấu ─────────────────────────────────────────────────────────────────
export class CreateRecipeStepDto {
  @ApiProperty({ description: 'Số thứ tự bước (1-based)', minimum: 1 })
  @IsInt()
  @Min(1)
  stepOrder: number;

  @ApiProperty({ description: 'Nội dung hướng dẫn' })
  @IsString()
  instruction: string;

  @ApiPropertyOptional({ description: 'Thời gian bước (phút)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'URL ảnh minh họa bước' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

// ── DTO tạo món ăn ────────────────────────────────────────────────────────────
export class CreateDishDto {
  @ApiPropertyOptional({ description: 'Tên món ăn (tiếng Việt). Để trống khi tạo bản nháp.', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Slug tùy chỉnh (hệ thống tự sinh nếu không cung cấp)' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional({ description: 'Tên địa phương hoặc tên tiếng Anh', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternateNames?: string[];

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullDescription?: string;

  @ApiPropertyOptional({ description: 'UUID vùng miền' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ description: 'UUID tỉnh/thành' })
  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originText?: string;

  @ApiPropertyOptional({ enum: DishDifficulty })
  @IsOptional()
  @IsEnum(DishDifficulty)
  difficulty?: DishDifficulty;

  @ApiPropertyOptional({ description: 'Thời gian chuẩn bị (phút)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prepMinutes?: number;

  @ApiPropertyOptional({ description: 'Thời gian nấu (phút)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cookMinutes?: number;

  @ApiPropertyOptional({ description: 'Số khẩu phần', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  servings?: number;

  @ApiPropertyOptional({ description: 'Giá tối thiểu (VND)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({ description: 'Giá tối đa (VND)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ description: 'Buổi ăn chính (BREAKFAST/LUNCH/DINNER/SNACK)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryMealSlot?: string;

  @ApiPropertyOptional({ description: 'UUID danh mục món', isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'UUID loại bữa ăn', isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mealTypeIds?: string[];

  @ApiPropertyOptional({ description: 'UUID chế độ ăn', isArray: true })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  dietTypeIds?: string[];

  @ApiPropertyOptional({ description: 'Mục tiêu với score', isArray: true })
  @IsOptional()
  @IsArray()
  goalIds?: Array<{ goalId: string; score?: number }>;

  @ApiPropertyOptional({ description: 'Nguyên liệu', isArray: true, type: [CreateDishIngredientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDishIngredientDto)
  ingredients?: CreateDishIngredientDto[];

  @ApiPropertyOptional({ description: 'Dinh dưỡng (1-1)', type: CreateNutritionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNutritionDto)
  nutrition?: CreateNutritionDto;

  @ApiPropertyOptional({ description: 'Các bước nấu', isArray: true, type: [CreateRecipeStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  recipeSteps?: CreateRecipeStepDto[];

  @ApiPropertyOptional({ description: 'UUID món cha (biến thể)' })
  @IsOptional()
  @IsUUID()
  parentDishId?: string;
}
