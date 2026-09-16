import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Trông ngon quá!' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Reply to parent comment' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
