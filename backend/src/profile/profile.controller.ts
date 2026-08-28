import { Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateBasicDto } from './dto/update-basic.dto';
import { UpdateHealthDto } from './dto/update-health.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * GET /v1/profile/me — Lấy thông tin profile đầy đủ
   */
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin profile đầy đủ' })
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.profileService.getProfile(user.sub);
  }

  /**
   * PATCH /v1/profile/basic — Cập nhật tên, ngày sinh, giới tính
   */
  @Patch('basic')
  @ApiOperation({
    summary: 'Cập nhật thông tin cơ bản',
    description: 'Cập nhật displayName, dateOfBirth, gender. Tăng profileVersion.',
  })
  @ApiHeader({
    name: 'x-profile-version',
    description: 'Profile version hiện tại (để phát hiện conflict)',
    required: false,
  })
  updateBasic(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateBasicDto,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const profileVersion = profileVersionHeader ? parseInt(profileVersionHeader, 10) : 1;
    return this.profileService.updateBasic(user.sub, dto, profileVersion);
  }

  /**
   * PATCH /v1/profile/health — Cập nhật chiều cao, cân nặng
   */
  @Patch('health')
  @ApiOperation({
    summary: 'Cập nhật thông số sức khỏe',
    description: 'Cập nhật heightCm, weightKg. Chỉ dùng để cá nhân hóa — không phải đánh giá y khoa.',
  })
  @ApiHeader({
    name: 'x-profile-version',
    description: 'Profile version hiện tại',
    required: false,
  })
  updateHealth(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateHealthDto,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const profileVersion = profileVersionHeader ? parseInt(profileVersionHeader, 10) : 1;
    return this.profileService.updateHealth(user.sub, dto, profileVersion);
  }

  /**
   * PATCH /v1/profile/preferences — Cập nhật mục tiêu, sở thích, dị ứng
   */
  @Patch('preferences')
  @ApiOperation({
    summary: 'Cập nhật mục tiêu và sở thích',
    description:
      'Cập nhật goals, dietary preferences, allergens, avoid ingredients. Thay đổi dị ứng có hiệu lực ngay.',
  })
  @ApiHeader({
    name: 'x-profile-version',
    description: 'Profile version hiện tại',
    required: false,
  })
  updatePreferences(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdatePreferencesDto,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const profileVersion = profileVersionHeader ? parseInt(profileVersionHeader, 10) : 1;
    return this.profileService.updatePreferences(user.sub, dto, profileVersion);
  }
}
