import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'huytruong' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ example: 'huytruong' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'Matkhau@123' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({ example: 'device-uuid-123' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ example: '0a90743f-1f80-42f4-9e56-342477389414' })
  @IsOptional()
  @IsString()
  installationId?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;

  @ApiPropertyOptional({ example: '0a90743f-1f80-42f4-9e56-342477389414' })
  @IsOptional()
  @IsString()
  installationId?: string;
}
