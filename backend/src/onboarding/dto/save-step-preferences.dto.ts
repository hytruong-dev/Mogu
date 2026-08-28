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
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SaveStepPreferencesDto {
  @ApiPropertyOptional({
    description: 'Danh sách ID sở thích / chế độ ăn. Lấy từ GET /v1/catalogs/onboarding.',
    type: [String],
    example: [],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'ID sở thích không hợp lệ.' })
  dietaryPreferenceIds?: string[];

  /**
   * Đánh dấu "Tôi không có dị ứng" — loại trừ lẫn nhau với allergenIds
   */
  @ApiPropertyOptional({
    description:
      'true = người dùng xác nhận không có dị ứng. Loại trừ lẫn nhau với allergenIds.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  noAllergies?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách ID dị ứng. Không dùng cùng noAllergies=true.',
    type: [String],
    example: [],
  })
  @ValidateIf((o) => !o.noAllergies)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'ID dị ứng không hợp lệ.' })
  allergenIds?: string[];

  @ApiPropertyOptional({
    description: 'Nguyên liệu cần tránh (tối đa 30 mục, mỗi mục 1–80 ký tự).',
    type: [String],
    example: ['hành lá', 'tiêu'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Bạn đã thêm quá nhiều nguyên liệu cần tránh.' })
  @ArrayUnique({ message: 'Nguyên liệu không được trùng nhau.' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true, message: 'Tên nguyên liệu tối đa 80 ký tự.' })
  avoidIngredients?: string[];
}
