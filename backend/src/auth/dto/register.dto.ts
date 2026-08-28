import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'huytruong', minLength: 3, maxLength: 32 })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._]+$/, { message: 'Username chỉ gồm chữ, số, dấu chấm và gạch dưới' })
  username: string;

  @ApiProperty({ example: 'Matkhau@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường và số',
  })
  password: string;

  @ApiProperty({ example: '1.1' })
  @IsString()
  @IsNotEmpty()
  consentVersion: string;
}
