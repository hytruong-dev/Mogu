import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'ID mục tiêu chính.',
    example: 'uuid-of-goal',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID mục tiêu chính không hợp lệ.' })
  primaryGoalId?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID mục tiêu phụ (tối đa 2).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Bạn có thể chọn tối đa 2 mục tiêu phụ.' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  secondaryGoalIds?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách ID sở thích / chế độ ăn.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dietaryPreferenceIds?: string[];

  @ApiPropertyOptional({
    description: 'true = không có dị ứng. Loại trừ lẫn nhau với allergenIds.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  noAllergies?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách ID dị ứng.',
    type: [String],
  })
  @ValidateIf((o) => !o.noAllergies)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allergenIds?: string[];

  @ApiPropertyOptional({
    description: 'Nguyên liệu cần tránh (tối đa 30 mục).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  avoidIngredients?: string[];
}
