import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIngredientDto {
  @ApiProperty({ description: 'Mã nguyên liệu (unique)', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: 'Tên nguyên liệu', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Tên đồng nghĩa', isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ description: 'Đơn vị đo', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: 'Mã nhóm dị ứng (nut, seafood, dairy...)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allergenCode?: string;

  @ApiPropertyOptional({ description: 'URL ảnh nguyên liệu (đã upload)' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Storage key trong Supabase Storage', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiPropertyOptional({ description: 'Kích hoạt', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIngredientDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  allergenCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
