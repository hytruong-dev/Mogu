import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@ApiTags('Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalogs')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('goals')
  @ApiOperation({
    summary: 'Danh sách goals active cho trang chủ',
    description:
      'Trả về danh sách goals active để hiển thị Quick Goal trên trang chủ. ' +
      'HOME-BR-007: quick goal chỉ là context cho phiên Random, không tự đổi primary_goal hồ sơ. ' +
      'Client nên cache theo trường `version`.',
  })
  @ApiOkResponse({ description: 'Danh sách goals active có version' })
  getActiveGoals() {
    return this.catalog.getActiveGoals();
  }

  @Get('onboarding')
  @ApiOperation({
    summary: 'Lấy catalog cho onboarding',
    description:
      'Trả về danh sách goals, sở thích ăn uống và dị ứng để dùng trong 8 bước onboarding. Client nên cache theo trường `version`.',
  })
  getOnboardingCatalog() {
    return this.catalog.getOnboardingCatalog();
  }

  @Get('regions')
  @ApiOperation({ summary: 'Catalog khu vực' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getRegions(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.catalog.getRegions(q, Number(limit) || 20);
  }

  @Get('allergens')
  @ApiOperation({ summary: 'Catalog dị ứng' })
  getAllergens() {
    return this.catalog.getAllergens();
  }

  @Get('dietary-preferences')
  @ApiOperation({ summary: 'Catalog sở thích / chế độ ăn' })
  @ApiQuery({ name: 'type', required: false })
  getDietaryPreferences(@Query('type') type?: string) {
    return this.catalog.getDietaryPreferences(type);
  }

  @Get('selection-priorities')
  @ApiOperation({ summary: 'Catalog ưu tiên chọn món' })
  getSelectionPriorities() {
    return this.catalog.getSelectionPriorities();
  }
}
