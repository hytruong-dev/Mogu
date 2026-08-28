import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @ApiProperty({
    description: 'Mật khẩu tạm thời (8+ ký tự, có chữ hoa, thường, số)',
    example: 'Temp@1234',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu tạm phải có chữ hoa, chữ thường và số',
  })
  temporaryPassword: string;

  @ApiPropertyOptional({ description: 'Lý do reset (ghi vào audit log)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
