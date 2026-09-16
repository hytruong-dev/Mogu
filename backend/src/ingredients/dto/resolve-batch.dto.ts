import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveBatchItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  clientRef: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  rawName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;
}

export class ResolveBatchDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  createMissing?: boolean;

  @ApiProperty({ type: [ResolveBatchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolveBatchItemDto)
  items: ResolveBatchItemDto[];
}
