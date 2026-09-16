import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Enums ──────────────────────────────────────────────────────────────────────

export enum MealSlotEnum {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  ANY = 'ANY',
}

export enum BudgetModeEnum {
  EXPLICIT_RANGE = 'EXPLICIT_RANGE',
  ECONOMY_PROFILE = 'ECONOMY_PROFILE',
  PROFILE_DEFAULT = 'PROFILE_DEFAULT',
  UNLIMITED = 'UNLIMITED',
}

export enum RecommendationSourceEnum {
  RANDOM_FLOW = 'RANDOM_FLOW',
  RANDOM_AGAIN = 'RANDOM_AGAIN',
  HOME_QUICK_RANDOM = 'HOME_QUICK_RANDOM',
  WEEKLY_PLAN_SWAP = 'WEEKLY_PLAN_SWAP',
}

export enum RecommendationEventTypeEnum {
  IMPRESSION = 'IMPRESSION',
  OPEN_DETAIL = 'OPEN_DETAIL',
  SELECT = 'SELECT',
  RETRY = 'RETRY',
  SAVE = 'SAVE',
  SHARE = 'SHARE',
  DISLIKE = 'DISLIKE',
  NOT_RELEVANT = 'NOT_RELEVANT',
  TOO_EXPENSIVE = 'TOO_EXPENSIVE',
  TOO_FAR = 'TOO_FAR',
  ALLERGY_CONCERN = 'ALLERGY_CONCERN',
  DISMISS = 'DISMISS',
}

// ── Sub-DTOs ───────────────────────────────────────────────────────────────────

export class MealDto {
  @ApiPropertyOptional({ enum: MealSlotEnum, example: 'LUNCH' })
  @IsOptional()
  @IsEnum(MealSlotEnum)
  slot?: MealSlotEnum;

  @ApiPropertyOptional({ example: 'USER_SELECTED' })
  @IsOptional()
  @IsString()
  selectionSource?: string;
}

export class BudgetDto {
  @ApiPropertyOptional({ enum: BudgetModeEnum, default: 'UNLIMITED' })
  @IsOptional()
  @IsEnum(BudgetModeEnum)
  mode?: BudgetModeEnum;

  @ApiPropertyOptional({ example: 40000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minVnd?: number;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxVnd?: number;
}

export class LocationDto {
  @ApiPropertyOptional({ example: 10.7769 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7009 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class RuntimeOverridesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietTypeCodes?: string[];

  @ApiPropertyOptional({ example: 'RAIN' })
  @IsOptional()
  @IsString()
  weatherCode?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  radiusKm?: number;
}

// ── Main DTOs ──────────────────────────────────────────────────────────────────

/** BA-006 v1.1 request — backward-compatible với legacy */
export class RandomizationRequestDto {
  // ── v1.1 fields ────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: RecommendationSourceEnum, default: 'RANDOM_FLOW' })
  @IsOptional()
  @IsEnum(RecommendationSourceEnum)
  source?: RecommendationSourceEnum;

  @ApiPropertyOptional({ type: MealDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealDto)
  meal?: MealDto;

  @ApiPropertyOptional({ type: BudgetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetDto)
  budget?: BudgetDto;

  @ApiPropertyOptional({ type: RuntimeOverridesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuntimeOverridesDto)
  runtimeOverrides?: RuntimeOverridesDto;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  // ── Legacy fields (BA-004 — vẫn accept trong giai đoạn migration) ─
  @ApiPropertyOptional({ example: 'LUNCH', description: '[Legacy] dùng meal.slot thay thế' })
  @IsOptional()
  @IsString()
  mealTypeCode?: string;

  @ApiPropertyOptional({ type: [String], description: '[Legacy] dùng runtimeOverrides.goalCodes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalCodes?: string[];

  @ApiPropertyOptional({ type: [String], description: '[Legacy] dùng runtimeOverrides.dietTypeCodes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietTypeCodes?: string[];

  @ApiPropertyOptional({ description: '[Legacy] dùng budget.maxVnd' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ example: 'RAIN', description: '[Legacy] dùng runtimeOverrides.weatherCode' })
  @IsOptional()
  @IsString()
  weatherCode?: string;

  // ── Shared ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ type: [String], description: 'Dishes to exclude (max 20)' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  excludeDishIds?: string[];
}

export class RandomHistoryQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor (createdAt,id) base64url' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Chỉ lấy các random đã chọn' })
  @IsOptional()
  @IsBoolean()
  selectedOnly?: boolean;

  @ApiPropertyOptional({ description: 'SELECTED | SKIPPED | ALL' })
  @IsOptional()
  @IsString()
  outcome?: string;
}

export class RetryRandomizationDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  keepCriteria?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  excludePreviousResult?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedRelaxations?: string[];
}

export class SelectRandomizationDto {
  @ApiPropertyOptional({ example: '2026-08-25T12:30:00+07:00' })
  @IsOptional()
  @IsString()
  plannedAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  createMealLog?: boolean;
}

export class RecommendationEventDto {
  @ApiProperty({ enum: RecommendationEventTypeEnum })
  @IsEnum(RecommendationEventTypeEnum)
  eventType!: RecommendationEventTypeEnum;

  @ApiPropertyOptional({ example: 'DO_NOT_LIKE_MAIN_INGREDIENT' })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}
