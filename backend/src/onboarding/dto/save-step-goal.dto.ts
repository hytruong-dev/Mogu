import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class SaveStepGoalDto {
  @ApiProperty({
    description: 'ID mục tiêu chính (bắt buộc). Lấy từ GET /v1/catalogs/onboarding.',
    example: 'uuid-of-goal',
  })
  @IsNotEmpty({ message: 'Hãy chọn một mục tiêu chính.' })
  @IsUUID('4', { message: 'ID mục tiêu không hợp lệ.' })
  primaryGoalId!: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID mục tiêu phụ (tối đa 2, không trùng primaryGoalId).',
    type: [String],
    example: [],
  })
  @IsArray()
  @ArrayMaxSize(2, { message: 'Bạn có thể chọn tối đa 2 mục tiêu phụ.' })
  @ArrayUnique({ message: 'Mục tiêu phụ không được trùng nhau.' })
  @IsUUID('4', { each: true, message: 'ID mục tiêu phụ không hợp lệ.' })
  @ValidateIf((o) => o.secondaryGoalIds && o.secondaryGoalIds.length > 0)
  secondaryGoalIds?: string[];
}
