import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d'], default: '7d' })
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '7d';
}

export class DashboardGrowthQueryDto {
  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7;
}

export class DashboardTrendingQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d'], default: '7d' })
  @IsOptional()
  @IsIn(['24h', '7d'])
  window?: '24h' | '7d' = '7d';

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

export class DashboardActivitiesQueryDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'CSV: IMPORT_JOB,DISH_REVIEW,MODERATION,ADMIN_ACTION' })
  @IsOptional()
  @IsString()
  types?: string;

  @ApiPropertyOptional({ description: 'ISO occurredAt cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
