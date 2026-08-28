import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportSourceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DishSourceItemDto {
  @ApiProperty({ description: 'URL nguồn tham khảo' })
  @IsString()
  @MaxLength(2000)
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @ApiPropertyOptional({ enum: ImportSourceType })
  @IsOptional()
  @IsEnum(ImportSourceType)
  sourceType?: ImportSourceType;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  reliability?: number;
}

export class SaveDishSourcesDto {
  @ApiProperty({ type: [DishSourceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishSourceItemDto)
  sources: DishSourceItemDto[];
}

export class SubmitReviewDto {
  @ApiPropertyOptional({ description: 'Ghi chú gửi duyệt nội bộ' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional({ description: 'Nhóm kiểm duyệt' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reviewTeam?: string;
}
