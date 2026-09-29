import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class TtsDto {
  @IsString() @MinLength(1) @MaxLength(4000) text!: string;
  @IsOptional() @IsNumber() @Min(0.5) @Max(1.5) rate?: number;
}
export class AskDto {
  @IsUUID() dishId!: string;
  @IsString() @MinLength(1) @MaxLength(1000) question!: string;
  @IsInt() @Min(0) @Max(39) currentStep!: number;
  @IsOptional() @IsInt() @Min(0) @Max(86400) timerRemainingSec?: number;
  @IsOptional() @IsNumber() @Min(0.1) @Max(100) servings?: number;
}
