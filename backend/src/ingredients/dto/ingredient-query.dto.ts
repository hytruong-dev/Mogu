import { IsOptional, IsString, MaxLength, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class IngredientQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm tên nguyên liệu (có hỗ trợ không dấu)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Code dị ứng để lọc', example: 'SEAFOOD' })
  @IsOptional()
  @IsString()
  allergenCode?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
