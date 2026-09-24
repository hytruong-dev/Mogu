import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ArrayMinSize,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeeklyMealSlot, WeeklyKcalMode } from '@prisma/client';
import { WeeklyPlanAdvancedOptionsDto } from './upsert-weekly-plan-config.dto';

/**
 * Generate request — hỗ trợ contract UX redesign 2026.
 * Có thể chỉ gửi startDate (dùng config đã lưu) hoặc gửi full payload override.
 */
export class GenerateWeeklyPlanDto {
  @ApiProperty({
    description: 'Ngay bat dau ke hoach (ISO date, YYYY-MM-DD)',
    example: '2026-09-23',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(14)
  durationDays?: number;

  @ApiPropertyOptional({ example: 300000, description: 'Ngân sách tuần (VND)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsInt()
  @Min(800)
  @Max(5000)
  dailyCalories?: number;

  @ApiPropertyOptional({ enum: WeeklyKcalMode })
  @IsOptional()
  @IsEnum(WeeklyKcalMode)
  calorieSource?: WeeklyKcalMode;

  @ApiPropertyOptional({
    enum: WeeklyMealSlot,
    isArray: true,
    example: ['MORNING', 'LUNCH', 'DINNER'],
    description: 'BREAKFAST trên FE map sang MORNING',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsEnum(WeeklyMealSlot, { each: true })
  mealSlots?: WeeklyMealSlot[];

  @ApiPropertyOptional({ type: WeeklyPlanAdvancedOptionsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyPlanAdvancedOptionsDto)
  advanced?: WeeklyPlanAdvancedOptionsDto;

  @ApiPropertyOptional({ description: 'Idempotency key (cũng có thể gửi qua header)' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
