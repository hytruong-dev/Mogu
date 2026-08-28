import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveStepNameDto {
  @ApiPropertyOptional({
    description: 'Tên hiển thị. Bỏ qua hoặc null để dùng mặc định "bạn".',
    example: 'Quang',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tên không được để trống nếu cung cấp' })
  @MaxLength(50, { message: 'Tên quá dài. Vui lòng dùng tối đa 50 ký tự.' })
  displayName?: string | null;
}
