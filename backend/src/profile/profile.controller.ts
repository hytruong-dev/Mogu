import { Body, Controller, Get, Headers, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateBasicDto } from './dto/update-basic.dto';
import { UpdateHealthDto } from './dto/update-health.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(['profile/me', 'me/profile'])
  @ApiOperation({ summary: 'Lấy thông tin profile đầy đủ' })
  getProfile(@CurrentUser() user: { sub: string; id?: string }) {
    const userId = user.sub ?? user.id!;
    return this.profileService.getProfile(userId);
  }

  @Patch('profile/basic')
  @ApiOperation({
    summary: 'Cập nhật thông tin cơ bản (yêu cầu If-Match)',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag/Profile version hiện tại',
    required: false,
  })
  updateBasic(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: UpdateBasicDto,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const userId = user.sub ?? user.id!;
    return this.profileService.updateBasic(
      userId,
      dto,
      ifMatch ?? profileVersionHeader,
    );
  }

  @Patch('profile/health')
  @ApiOperation({
    summary: 'Cập nhật thông số sức khỏe (yêu cầu If-Match)',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag/Profile version hiện tại',
    required: false,
  })
  updateHealth(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: UpdateHealthDto,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const userId = user.sub ?? user.id!;
    return this.profileService.updateHealth(
      userId,
      dto,
      ifMatch ?? profileVersionHeader,
    );
  }

  @Patch('profile/preferences')
  @ApiOperation({
    summary: 'Cập nhật mục tiêu và sở thích (yêu cầu If-Match)',
  })
  @ApiHeader({
    name: 'If-Match',
    description: 'ETag/Profile version hiện tại',
    required: false,
  })
  updatePreferences(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: UpdatePreferencesDto,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const userId = user.sub ?? user.id!;
    return this.profileService.updatePreferences(
      userId,
      dto,
      ifMatch ?? profileVersionHeader,
    );
  }

  @Get('me/journey')
  @ApiOperation({ summary: 'Lấy hành trình cá nhân của tôi' })
  getJourney(
    @CurrentUser() user: { sub: string; id?: string },
    @Query('month') month?: string,
  ) {
    const userId = user.sub ?? user.id!;
    return this.profileService.getJourney(userId, month);
  }
}
