import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@ApiTags('Catalogs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalogs')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * GET /v1/catalogs/goals
   * Danh sách quick goals cho Home (HOME-BR-007: chỉ là context phiên, không đổi profile).
   */
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

  /**
   * GET /v1/catalogs/onboarding
   * Trả về danh sách goals, dietary preferences, allergens để hiển thị trong onboarding.
   * Client nên cache theo catalog version.
   */
  @Get('onboarding')
  @ApiOperation({
    summary: 'Lấy catalog cho onboarding',
    description:
      'Trả về danh sách goals, sở thích ăn uống và dị ứng để dùng trong 8 bước onboarding. Client nên cache theo trường `version`.',
  })
  getOnboardingCatalog() {
    return this.catalog.getOnboardingCatalog();
  }
}
