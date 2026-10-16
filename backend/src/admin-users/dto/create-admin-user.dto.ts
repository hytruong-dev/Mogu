import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SystemRole } from '@prisma/client';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'reviewer01', description: 'Tên đăng nhập (3-32 ký tự, không dấu)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username chỉ gồm chữ, số, dấu chấm và gạch dưới',
  })
  username: string;

  @ApiPropertyOptional({ example: 'reviewer@mogu.vn', description: 'Email để nhận thông báo và khôi phục' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', description: 'Tên hiển thị' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Reviewer@123',
    description: 'Mật khẩu khởi tạo (nếu để trống hệ thống sẽ tự sinh ngẫu nhiên an toàn)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  password?: string;

  @ApiProperty({
    enum: SystemRole,
    default: SystemRole.USER,
    description: 'Vai trò của tài khoản',
  })
  @IsEnum(SystemRole, { message: 'Vai trò không hợp lệ (USER, REVIEWER, CONTENT_ADMIN, SUPER_ADMIN)' })
  role: SystemRole;

  @ApiPropertyOptional({
    default: true,
    description: 'Bắt buộc đổi mật khẩu khi đăng nhập lần đầu',
  })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class DirectPasswordResetDto {
  @ApiPropertyOptional({
    example: 'TempPassword@123',
    description: 'Mật khẩu tạm thời (nếu để trống hệ thống tự sinh ngẫu nhiên)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  temporaryPassword?: string;

  @ApiPropertyOptional({
    example: 'USER_HOTLINE_REQUEST',
    description: 'Mã lý do đặt lại mật khẩu',
  })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional({
    example: 'TCK-2026-001',
    description: 'Mã ticket hỗ trợ (nếu có)',
  })
  @IsOptional()
  @IsString()
  caseId?: string;
}
