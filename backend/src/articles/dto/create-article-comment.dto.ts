import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleCommentDto {
  @ApiProperty({ example: 'Bài viết hay quá!' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
