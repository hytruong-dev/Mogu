import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MISSING_DISH_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'ADDED',
  'DISMISSED',
] as const;
export type MissingDishStatus = (typeof MISSING_DISH_STATUSES)[number];

export class ListMissingDishesQueryDto {
  @IsOptional()
  @IsIn(MISSING_DISH_STATUSES)
  status?: MissingDishStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateMissingDishDto {
  @IsOptional()
  @IsIn(MISSING_DISH_STATUSES)
  status?: MissingDishStatus;

  @IsOptional()
  @IsUUID()
  linkedDishId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string | null;

  /** Add the AI-recognized name to the linked dish's alternate names. */
  @IsOptional()
  @IsBoolean()
  addAlias?: boolean;
}
