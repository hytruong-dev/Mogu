import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecommendationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'BALANCE', description: 'Goal code cho phiên Random' })
  @IsOptional()
  @IsString()
  goalCode?: string;
}

export class RecommendationListResponseDto {
  data: {
    dishId: string;
    name: string;
    imageUrl?: string;
    calories: number;
    prepMinutes: number;
    priceRange?: string;
    reasonShort?: string;
    isSaved: boolean;
  }[];
  page: number;
  limit: number;
  hasMore: boolean;
}
