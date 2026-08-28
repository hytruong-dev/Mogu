import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ enum: ['current', 'all'], default: 'current' })
  @IsOptional()
  @IsIn(['current', 'all'])
  scope?: 'current' | 'all' = 'current';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
