import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ImportSourceType {
  AI_GENERATED = 'AI_GENERATED',
  JSON_LD = 'JSON_LD',
  VIDEO = 'VIDEO',
  NUTRITION = 'NUTRITION',
  UNSTRUCTURED = 'UNSTRUCTURED',
}

export class CreateImportJobDto {
  @ApiProperty({ description: 'Tên món ăn cần nhập', example: 'Phở bò' })
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(150)
  query: string;

  @ApiPropertyOptional({
    description: 'Từ khóa liên quan giúp AI hiểu ngữ cảnh',
    example: ['phở tái', 'Vietnamese beef pho'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item.trim() : item) : value,
  )
  relatedKeywords?: string[];

  @ApiPropertyOptional({
    description: 'Code vùng miền (north/south/central)',
    example: 'north',
  })
  @IsOptional()
  @IsIn(['north', 'central', 'south'])
  regionHint?: string;

  @ApiPropertyOptional({
    description: 'Nguồn dữ liệu (hiện tại chỉ dùng để log, AI tự tổng hợp)',
    example: ['JSON_LD', 'VIDEO', 'NUTRITION'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(ImportSourceType, { each: true })
  sourceTypes?: ImportSourceType[];
}
