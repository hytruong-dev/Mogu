import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Gender } from '@prisma/client';

export class SaveStepGenderDto {
  @ApiPropertyOptional({
    description: 'Giới tính. Tùy chọn — bỏ qua được.',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Vui lòng chọn một lựa chọn hợp lệ.' })
  gender?: Gender | null;
}
