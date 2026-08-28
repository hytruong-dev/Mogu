import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { SaveStepNameDto } from './dto/save-step-name.dto';
import { SaveStepBirthdayDto } from './dto/save-step-birthday.dto';
import { SaveStepGenderDto } from './dto/save-step-gender.dto';
import { SaveStepBodyDto } from './dto/save-step-body.dto';
import { SaveStepGoalDto } from './dto/save-step-goal.dto';
import { SaveStepPreferencesDto } from './dto/save-step-preferences.dto';

type SaveStepDto =
  | SaveStepNameDto
  | SaveStepBirthdayDto
  | SaveStepGenderDto
  | SaveStepBodyDto
  | SaveStepGoalDto
  | SaveStepPreferencesDto;

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * GET /v1/onboarding
   * Lấy trạng thái và draft hiện tại của onboarding
   */
  @Get()
  @ApiOperation({ summary: 'Lấy state + draft onboarding' })
  getState(@CurrentUser() user: { sub: string }) {
    return this.onboarding.getState(user.sub);
  }

  /**
   * POST /v1/onboarding/start
   * Khởi tạo session onboarding — idempotent
   */
  @Post('start')
  @ApiOperation({
    summary: 'Bắt đầu onboarding',
    description: 'Tạo session IN_PROGRESS. Idempotent — gọi nhiều lần chỉ tạo 1 session.',
  })
  start(@CurrentUser() user: { sub: string }) {
    return this.onboarding.start(user.sub);
  }

  /**
   * PATCH /v1/onboarding/steps/:step
   * Lưu dữ liệu cho bước step (2–7)
   */
  @Patch('steps/:step')
  @ApiOperation({ summary: 'Lưu dữ liệu một bước onboarding' })
  @ApiParam({ name: 'step', description: 'Số bước (1–8)', type: Number })
  @ApiHeader({
    name: 'x-profile-version',
    description: 'Profile version hiện tại (để phát hiện conflict)',
    required: false,
  })
  saveStep(
    @CurrentUser() user: { sub: string },
    @Param('step', ParseIntPipe) step: number,
    @Body() dto: SaveStepDto,
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const profileVersion = profileVersionHeader ? parseInt(profileVersionHeader, 10) : 1;
    return this.onboarding.saveStep(user.sub, step, dto, profileVersion);
  }

  /**
   * POST /v1/onboarding/steps/:step/skip
   * Skip bước được phép (bước có skippable=true)
   */
  @Post('steps/:step/skip')
  @ApiOperation({ summary: 'Bỏ qua bước onboarding' })
  @ApiParam({ name: 'step', description: 'Số bước cần bỏ qua', type: Number })
  skipStep(
    @CurrentUser() user: { sub: string },
    @Param('step', ParseIntPipe) step: number,
  ) {
    return this.onboarding.skipStep(user.sub, step);
  }

  /**
   * GET /v1/onboarding/summary
   * Tóm tắt toàn bộ profile để hiển thị ở Step 8
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Lấy tóm tắt onboarding (Step 8)',
    description: 'Trả về toàn bộ thông tin profile để người dùng review trước khi hoàn tất.',
  })
  getSummary(@CurrentUser() user: { sub: string }) {
    return this.onboarding.getSummary(user.sub);
  }

  /**
   * POST /v1/onboarding/complete
   * Hoàn tất onboarding — idempotent
   */
  @Post('complete')
  @ApiOperation({
    summary: 'Hoàn tất onboarding',
    description:
      'Xác nhận hoàn tất. Validate dữ liệu bắt buộc, set COMPLETED, tăng profileVersion. Idempotent.',
  })
  @ApiHeader({
    name: 'x-profile-version',
    description: 'Profile version hiện tại',
    required: false,
  })
  complete(
    @CurrentUser() user: { sub: string },
    @Headers('x-profile-version') profileVersionHeader?: string,
  ) {
    const profileVersion = profileVersionHeader ? parseInt(profileVersionHeader, 10) : 1;
    return this.onboarding.complete(user.sub, profileVersion);
  }
}
