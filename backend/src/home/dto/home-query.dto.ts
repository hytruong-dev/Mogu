import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class HomeQueryDto {
  @ApiPropertyOptional({
    description: 'Ngày local của user (YYYY-MM-DD). Mặc định: hôm nay theo timezone.',
    example: '2026-09-11',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone (vd. Asia/Ho_Chi_Minh). Mặc định: Asia/Ho_Chi_Minh.',
    example: 'Asia/Ho_Chi_Minh',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
