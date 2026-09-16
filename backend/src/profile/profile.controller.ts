import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateBasicDto } from './dto/update-basic.dto';
import { UpdateHealthDto } from './dto/update-health.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import {
  CreateAvatarUploadIntentDto,
  PutAvoidancesDto,
} from './dto/avatar-avoidances.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  private userId(user: { sub?: string; id?: string }) {
    return user.sub ?? user.id!;
  }

  @Get('me/profile-dashboard')
  @ApiOperation({ summary: 'BFF màn Profile chính (không chứa health/DOB)' })
  getProfileDashboard(
    @CurrentUser() user: { sub: string; id?: string },
    @Query('localDate') localDate?: string,
    @Query('timezone') timezone?: string,
    @Query('weekStartsOn') weekStartsOn?: string,
  ) {
    return this.profileService.getProfileDashboard(this.userId(user), {
      localDate,
      timezone,
      weekStartsOn,
    });
  }

  @Get(['profile/me', 'me/profile'])
  @ApiOperation({ summary: 'Lấy thông tin profile đầy đủ' })
  getProfile(@CurrentUser() user: { sub: string; id?: string }) {
    return this.profileService.getProfile(this.userId(user));
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
    return this.profileService.updateBasic(
      this.userId(user),
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
    return this.profileService.updateHealth(
      this.userId(user),
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
    return this.profileService.updatePreferences(
      this.userId(user),
      dto,
      ifMatch ?? profileVersionHeader,
    );
  }

  @Get('me/journey')
  @ApiOperation({ summary: 'Lấy hành trình cá nhân của tôi' })
  getJourney(
    @CurrentUser() user: { sub: string; id?: string },
    @Query('month') month?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.profileService.getJourney(this.userId(user), month, timezone);
  }

  @Get('me/health-profile')
  @ApiOperation({ summary: 'Aggregate measurements + targets cho màn Health' })
  getHealthProfile(@CurrentUser() user: { sub: string; id?: string }) {
    return this.profileService.getHealthProfile(this.userId(user));
  }

  @Put('me/avoidances')
  @ApiOperation({ summary: 'Thay thế danh sách nguyên liệu cần tránh' })
  putAvoidances(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: PutAvoidancesDto,
  ) {
    return this.profileService.putAvoidances(this.userId(user), dto.items);
  }

  @Post('me/avatar-upload-intents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo intent upload avatar (signed URL stub)' })
  createAvatarIntent(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: CreateAvatarUploadIntentDto,
  ) {
    return this.profileService.createAvatarUploadIntent(this.userId(user), dto);
  }

  @Post('me/avatar-upload-intents/:mediaId/finalize')
  @ApiOperation({ summary: 'Finalize avatar upload và gắn vào profile' })
  finalizeAvatar(
    @CurrentUser() user: { sub: string; id?: string },
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.profileService.finalizeAvatarUpload(this.userId(user), mediaId);
  }

  @Get('me/avatar')
  @ApiOperation({ summary: 'Trạng thái avatar hiện tại' })
  getAvatar(@CurrentUser() user: { sub: string; id?: string }) {
    return this.profileService.getAvatar(this.userId(user));
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Xóa avatar (yêu cầu If-Match)' })
  @ApiHeader({ name: 'If-Match', required: true })
  deleteAvatar(
    @CurrentUser() user: { sub: string; id?: string },
    @Headers('if-match') ifMatch?: string,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    return this.profileService.deleteAvatar(
      this.userId(user),
      ifMatch ?? profileVersionHeader,
    );
  }
}
