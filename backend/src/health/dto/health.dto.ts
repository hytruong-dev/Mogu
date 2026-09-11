import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DiaryItemReferenceType,
  DiaryMealSlot,
  DiaryMealSourceType,
} from '@prisma/client';

export class MealLogItemDto {
  @IsEnum(DiaryItemReferenceType)
  referenceType: DiaryItemReferenceType;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @IsNumber()
  gramEquivalent?: number;
}

export class MealLogSourceDto {
  @IsEnum(DiaryMealSourceType)
  type: DiaryMealSourceType;

  @IsOptional()
  @IsUUID()
  randomizationId?: string;

  @IsOptional()
  @IsUUID()
  weeklyPlanSlotId?: string;
}

export class CreateMealLogDto {
  @IsEnum(DiaryMealSlot)
  mealSlot: DiaryMealSlot;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MealLogSourceDto)
  source?: MealLogSourceDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MealLogItemDto)
  items: MealLogItemDto[];
}

export class CreateWaterLogDto {
  @IsInt()
  @Min(1)
  @Max(3000)
  amountMl: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  localDate?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
