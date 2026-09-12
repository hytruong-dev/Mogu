import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'mogu_user' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}

export class PasswordResetConfirmationDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  tokenOrOtp: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường và số',
  })
  newPassword: string;
}

export class EmailVerificationDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  tokenOrOtp: string;
}

export class PasswordChangeDto {
  @ApiProperty({ example: 'CurrentPassword@123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu mới phải có chữ hoa, chữ thường và số',
  })
  newPassword: string;
}
