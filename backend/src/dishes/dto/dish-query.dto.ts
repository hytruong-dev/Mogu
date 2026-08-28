import { ApiPropertyOptional } from '@nestjs/swagger';
import { DishStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DishPublicQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm tên/nguyên liệu (hỗ trợ không dấu)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  // Cho phép client truyền status để tương thích — public API luôn chỉ trả PUBLISHED
  @ApiPropertyOptional({ description: 'Bỏ qua (public luôn trả PUBLISHED)', enum: DishStatus })
  @IsOptional()
  @IsEnum(DishStatus)
  status?: DishStatus;

  @ApiPropertyOptional({ description: 'UUID vùng miền' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  // Alias: mobile gửi regionCode (code string) thay vì UUID
  @ApiPropertyOptional({ description: 'Code vùng miền (alias)' })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional({ description: 'UUID tỉnh/thành' })
  @IsOptional()
  @IsUUID()
  provinceId?: string;

  @ApiPropertyOptional({ description: 'Codes danh mục', isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryCodes?: string[];

  @ApiPropertyOptional({ description: 'Codes loại bữa ăn', isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealTypeCodes?: string[];

  @ApiPropertyOptional({ description: 'Codes chế độ ăn', isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietTypeCodes?: string[];

  @ApiPropertyOptional({ description: 'Codes mục tiêu', isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalCodes?: string[];

  @ApiPropertyOptional({ description: 'Giá tối đa (VND)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Cursor pagination token' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Sắp xếp',
    enum: ['relevance', 'popular', 'newest'],
    default: 'relevance',
  })
  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'popular' | 'newest' = 'relevance';
}

export class DishAdminQueryDto extends DishPublicQueryDto {
  // status đã được kế thừa từ DishPublicQueryDto (admin có thể lọc theo bất kỳ status nào)

  @ApiPropertyOptional({ description: 'UUID người tạo' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Code danh mục (1 giá trị)' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: 'Code bữa ăn (1 giá trị)' })
  @IsOptional()
  @IsString()
  mealTypeCode?: string;

  @ApiPropertyOptional({ description: 'UUID mục tiêu' })
  @IsOptional()
  @IsUUID()
  goalId?: string;

  @ApiPropertyOptional({ description: 'Lọc món tạo từ phiên import file' })
  @IsOptional()
  @IsUUID()
  createdFromImportSessionId?: string;
}
