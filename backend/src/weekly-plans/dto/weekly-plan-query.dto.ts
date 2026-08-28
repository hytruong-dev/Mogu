import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WeeklyPlanQueryDto {
  @ApiProperty({ description: 'Cursor (planId) for pagination', required: false })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiProperty({ description: 'Page size', default: 10, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;
}
