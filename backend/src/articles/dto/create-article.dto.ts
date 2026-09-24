import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({ example: '10-thuc-pham-tang-de-khang' })
  @IsString()
  @MaxLength(200)
  slug: string;

  @ApiProperty({ example: '10 thực phẩm giúp tăng cường sức đề kháng' })
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ description: 'Nội dung Markdown' })
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  readMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({ type: [String], example: ['dinh dưỡng', 'sức khỏe'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Lên lịch đăng (ISO datetime)' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;
}
