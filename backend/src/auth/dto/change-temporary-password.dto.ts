import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangeTemporaryPasswordDto {
  @ApiProperty({ description: 'Mật khẩu tạm thời đang dùng hiện tại' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'Mật khẩu mới (8+ ký tự, có chữ hoa, thường, số)',
    minLength: 8,
    maxLength: 72,
    example: 'NewPass@456',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường và số',
  })
  newPassword: string;
}
