import {
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { WeeklyMealSlot, WeeklyKcalMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertWeeklyPlanConfigDto {
  @ApiProperty({ description: 'Tong ngan sach VND/tuan', example: 500000 })
  @IsInt()
  @Min(1)
  budgetVnd: number;

  @ApiProperty({ description: 'Kcal/ngay muc tieu', example: 2000 })
  @IsInt()
  @Min(800)
  @Max(5000)
  kcalPerDay: number;

  @ApiProperty({ enum: WeeklyKcalMode, default: WeeklyKcalMode.PROFILE })
  @IsEnum(WeeklyKcalMode)
  @IsOptional()
  kcalMode?: WeeklyKcalMode;

  @ApiProperty({ description: 'So ngay (3, 5, 7, 14)', enum: [3, 5, 7, 14], default: 7 })
  @IsInt()
  @IsOptional()
  durationDays?: number;

  @ApiProperty({ description: 'So bua/ngay', example: 3 })
  @IsInt()
  @Min(1)
  @Max(4)
  @IsOptional()
  mealsPerDay?: number;

  @ApiProperty({
    description: 'Cac slot bua an duoc kich hoat',
    enum: WeeklyMealSlot,
    isArray: true,
    example: ['MORNING', 'LUNCH', 'DINNER'],
  })
  @IsArray()
  @IsEnum(WeeklyMealSlot, { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  enabledSlots?: WeeklyMealSlot[];

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  avoidRepeat?: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  preferHomeCook?: boolean;

  @ApiProperty({ description: 'Do lech kcal chap nhan (%)', example: 10 })
  @IsInt()
  @Min(5)
  @Max(30)
  @IsOptional()
  calorieTolerancePercent?: number;
}
