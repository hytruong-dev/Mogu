import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ enum: ['current', 'all'], default: 'current' })
  @IsOptional()
  @IsIn(['current', 'all'])
  scope?: 'current' | 'all' = 'current';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
