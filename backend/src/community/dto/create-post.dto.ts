import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePostDto {
  @ApiProperty({ example: 'Hôm nay mình nấu bún bò Huế ngon tuyệt!' })
  @IsString()
  @MaxLength(500)
  content: string;

  @ApiPropertyOptional({ type: [String], deprecated: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Media IDs READY owned by user' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dishId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] })
  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DRAFT'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DRAFT'])
  status?: 'ACTIVE' | 'DRAFT';

  @ApiPropertyOptional({ description: 'Idempotency key' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({ type: [String], deprecated: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dishId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  placeId?: string | null;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] })
  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DRAFT'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DRAFT'])
  status?: 'ACTIVE' | 'DRAFT';
}

export class CreateCommunityMediaIntentDto {
  @ApiProperty({ example: 'image/jpeg', description: 'image/jpeg|png|webp hoặc video/mp4|quicktime' })
  @IsString()
  mimeType: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string;
}
