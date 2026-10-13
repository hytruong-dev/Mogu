import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchPlacesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Lọc trong bán kính (km) khi có lat/lng' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class NearbyPlacesDto {
  @ApiProperty({ example: 10.7769 })
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 106.7009 })
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ description: 'Món cần tìm quán bán' })
  @IsOptional()
  @IsUUID()
  dishId?: string;

  @ApiPropertyOptional({ description: 'Từ khóa (fallback khi chưa có liên kết món)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.2)
  @Max(20)
  radiusKm?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: ['distance', 'rating'], default: 'distance' })
  @IsOptional()
  @IsIn(['distance', 'rating'])
  sort?: 'distance' | 'rating';
}

export class PlaceDetailQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class ResolvePlaceDto {
  @ApiProperty({ example: 'LOCAL' })
  @IsString()
  provider: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerPlaceId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressShort?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class AdminListPlacesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'LOCAL | GOOGLE | SHOPEEFOOD | OSM | GEOAPIFY' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isVerified?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  hasDishes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}

export class AdminUpdatePlaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressShort?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdatePlaceDishDto {
  @ApiProperty()
  @IsUUID()
  dishId!: string;

  @ApiPropertyOptional({ enum: ['CONFIRMED', 'LIKELY', 'REJECTED'] })
  @IsOptional()
  @IsIn(['CONFIRMED', 'LIKELY', 'REJECTED'])
  matchStatus?: 'CONFIRMED' | 'LIKELY' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priceVnd?: number;

  @ApiPropertyOptional({ description: 'Xóa liên kết' })
  @IsOptional()
  @IsBoolean()
  remove?: boolean;
}
