import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlacesService } from './places.service';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AdminListPlacesDto,
  AdminUpdatePlaceDishDto,
  AdminUpdatePlaceDto,
  NearbyPlacesDto,
  PlaceDetailQueryDto,
  ResolvePlaceDto,
  SearchPlacesDto,
} from './places.dto';

export {
  AdminListPlacesDto,
  AdminUpdatePlaceDishDto,
  AdminUpdatePlaceDto,
  NearbyPlacesDto,
  ResolvePlaceDto,
  SearchPlacesDto,
};

@ApiTags('Places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm địa điểm (DB local V1, hỗ trợ lọc bán kính)' })
  search(@Query() dto: SearchPlacesDto) {
    return this.placesService.search(dto);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Quán gần người dùng bán 1 món (mặc định 3km), kèm rating/giá/giờ mở' })
  nearby(@Query() dto: NearbyPlacesDto) {
    return this.placesService.nearby(dto);
  }

  @Post('resolve')
  @ApiOperation({ summary: 'Upsert place từ provider candidate' })
  resolve(@Body() dto: ResolvePlaceDto) {
    return this.placesService.resolve(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết quán (giờ mở, rating, link nguồn, món bán)' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Query() q: PlaceDetailQueryDto) {
    return this.placesService.getDetail(id, q.lat, q.lng);
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

  @Get(':id/dishes')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Danh sách món liên kết với quán' })
  adminListDishes(@Param('id') id: string) {
    return this.placesService.adminListDishes(id);
  }

  @Patch(':id/dishes')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Thêm/sửa trạng thái/xóa liên kết quán ↔ món' })
  adminUpdateDish(@Param('id') id: string, @Body() dto: AdminUpdatePlaceDishDto) {
    return this.placesService.adminUpdateDish(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CONTENT_ADMIN')
  @ApiOperation({ summary: '[Admin] Xóa địa điểm' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  adminDelete(@Param('id') id: string, @Query('force') force?: string) {
    return this.placesService.adminDelete(id, force === 'true');
  }
}
