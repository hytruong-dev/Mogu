import { Body, Controller, Get, Headers, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy cài đặt ứng dụng của tôi' })
  getSettings(@CurrentUser() user: { sub: string; id?: string }) {
    const userId = user.sub ?? user.id!;
    return this.settingsService.getSettings(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật cài đặt (yêu cầu If-Match)' })
  @ApiHeader({
    name: 'If-Match',
    description: 'Version của settings hiện tại',
    required: true,
  })
  updateSettings(
    @CurrentUser() user: { sub: string; id?: string },
    @Body() dto: UpdateSettingsDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const userId = user.sub ?? user.id!;
    return this.settingsService.updateSettings(userId, dto, ifMatch);
  }
}
