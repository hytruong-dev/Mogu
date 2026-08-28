import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPostsDto {
  @ApiPropertyOptional({ description: 'Cursor pagination — ID của post cuối cùng' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
