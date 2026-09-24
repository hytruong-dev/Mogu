import {
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsOptional,
  IsIn,
  IsString,
  Matches,
  Min,
  Max,
  ArrayMinSize,
  ArrayUnique,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeeklyMealSlot, WeeklyKcalMode, LikedDishPreference } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MealSlotScheduleItemDto {
  @ApiProperty({ enum: WeeklyMealSlot })
  @IsEnum(WeeklyMealSlot)
  type: WeeklyMealSlot;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: '07:00', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be HH:mm',
  })
  time?: string | null;
}

export class WeeklyPlanAdvancedOptionsDto {
  @ApiPropertyOptional({ description: 'Map to preferHomeCook' })
  @IsBoolean()
  @IsOptional()
  preferSelfCook?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowOutsideMeals?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  limitRepeats?: boolean;

  @ApiPropertyOptional({ example: 7 })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  repeatWindowDays?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  preferNewDishes?: boolean;

  @ApiPropertyOptional({ enum: LikedDishPreference })
  @IsEnum(LikedDishPreference)
  @IsOptional()
  likedDishPreference?: LikedDishPreference;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  keepLockedMeals?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  preserveLoggedDays?: boolean;
}

export class UpsertWeeklyPlanConfigDto {
  @ApiProperty({ description: 'Tong ngan sach VND cho toan ky (durationDays)', example: 300000 })
  @IsInt()
  @Min(0)
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
    description: 'Cac slot bua an duoc kich hoat (unique). MORNING = BREAKFAST trong UX.',
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

  @ApiPropertyOptional({ type: [MealSlotScheduleItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealSlotScheduleItemDto)
  mealSlotSchedule?: MealSlotScheduleItemDto[];

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  avoidRepeat?: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  preferHomeCook?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  allowOutsideMeals?: boolean;

  @ApiPropertyOptional({ default: 7 })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  repeatWindowDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  preferNewDishes?: boolean;

  @ApiPropertyOptional({ enum: LikedDishPreference, default: LikedDishPreference.LIGHT })
  @IsEnum(LikedDishPreference)
  @IsOptional()
  likedDishPreference?: LikedDishPreference;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  keepLockedMeals?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  preserveLoggedDays?: boolean;

  @ApiPropertyOptional({ type: WeeklyPlanAdvancedOptionsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyPlanAdvancedOptionsDto)
  advanced?: WeeklyPlanAdvancedOptionsDto;

  @ApiProperty({ description: 'Do lech kcal chap nhan (%)', example: 10 })
  @IsInt()
  @Min(5)
  @Max(30)
  @IsOptional()
  calorieTolerancePercent?: number;
}
