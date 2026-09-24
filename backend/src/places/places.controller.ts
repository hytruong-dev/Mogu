import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PlacesService } from './places.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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
}

@ApiTags('Places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Tìm địa điểm (DB local V1)' })
  search(@Query() dto: SearchPlacesDto) {
    return this.placesService.search(dto);
  }

  @Post('resolve')
  @ApiOperation({ summary: 'Upsert place từ provider candidate' })
  resolve(@Body() dto: ResolvePlaceDto) {
    return this.placesService.resolve(dto);
  }
}

@ApiTags('admin/places')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/places')
export class AdminPlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Danh sách địa điểm ẩm thực' })
  adminList(@Query() dto: AdminListPlacesDto) {
    return this.placesService.adminList(dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Cập nhật thông tin địa điểm' })
  adminUpdate(@Param('id') id: string, @Body() dto: AdminUpdatePlaceDto) {
    return this.placesService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Xóa địa điểm' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  adminDelete(@Param('id') id: string, @Query('force') force?: string) {
    return this.placesService.adminDelete(id, force === 'true');
  }
}
