import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Forgot password — không còn dùng OTP
// User cần liên hệ admin để được reset mật khẩu
export class ForgotPasswordDto {
  @ApiPropertyOptional({ description: 'Tên đăng nhập (để admin tra cứu)' })
  @IsOptional()
  @IsString()
  username?: string;
}
