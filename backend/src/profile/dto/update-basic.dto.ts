import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateBasicDto {
  @ApiPropertyOptional({
    description: 'Tên hiển thị (1–50 ký tự). null để xóa.',
    example: 'Quang',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50, { message: 'Tên quá dài. Vui lòng dùng tối đa 50 ký tự.' })
  displayName?: string | null;

  @ApiPropertyOptional({
    description: 'Ngày sinh ISO (YYYY-MM-DD). Không được là ngày tương lai.',
    example: '1995-06-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh chưa hợp lệ. Vui lòng kiểm tra lại.' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({
    description: 'Giới tính.',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Vui lòng chọn một lựa chọn hợp lệ.' })
  gender?: Gender | null;
}
