import {
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsOptional,
  IsIn,
  Min,
  Max,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';
import { WeeklyMealSlot, WeeklyKcalMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertWeeklyPlanConfigDto {
  @ApiProperty({ description: 'Tong ngan sach VND cho toan ky (durationDays)', example: 500000 })
  @IsInt()
  @Min(1)
  budgetVnd: number;

  @ApiProperty({ description: 'Kcal/ngay muc tieu (CUSTOM) hoac fallback', example: 2000 })
  @IsInt()
  @Min(800)
  @Max(5000)
  kcalPerDay: number;

  @ApiProperty({ enum: WeeklyKcalMode, default: WeeklyKcalMode.PROFILE })
  @IsEnum(WeeklyKcalMode)
  @IsOptional()
  kcalMode?: WeeklyKcalMode;

  @ApiProperty({ description: 'So ngay', enum: [3, 5, 7, 14], default: 7 })
  @IsInt()
  @IsIn([3, 5, 7, 14])
  @IsOptional()
  durationDays?: number;

  @ApiProperty({
    description: 'Deprecated — derive tu enabledSlots unique',
    example: 3,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(4)
  @IsOptional()
  mealsPerDay?: number;

  @ApiProperty({
    description: 'Cac slot bua an duoc kich hoat (unique)',
    enum: WeeklyMealSlot,
    isArray: true,
    example: ['MORNING', 'LUNCH', 'DINNER'],
  })
  @IsArray()
  @ArrayUnique()
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
