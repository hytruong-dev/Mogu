import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConsentItemDto {
  @ApiProperty({ example: 'TERMS' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  accepted: boolean;
}

export class RegisterDto {
  @ApiProperty({ example: 'huytruong', minLength: 3, maxLength: 32 })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username chỉ gồm chữ, số, dấu chấm và gạch dưới',
  })
  username: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Matkhau@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường và số',
  })
  password: string;

  @ApiPropertyOptional({ example: '1.1' })
  @IsOptional()
  @IsString()
  consentVersion?: string;

  @ApiPropertyOptional({ type: [ConsentItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consents?: ConsentItemDto[];

  @ApiPropertyOptional({ example: '0a90743f-1f80-42f4-9e56-342477389414' })
  @IsOptional()
  @IsString()
  installationId?: string;
}
