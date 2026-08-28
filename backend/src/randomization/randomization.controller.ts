import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  RandomHistoryQueryDto,
  RandomizationRequestDto,
  RecommendationEventDto,
  RetryRandomizationDto,
  SelectRandomizationDto,
} from './dto/randomization.dto';
import { RandomizationService } from './randomization.service';

@ApiTags('dish-randomizations')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RandomizationController {
  constructor(private readonly randomizationService: RandomizationService) {}

  // ── BA-006 §4.1 ─────────────────────────────────────────────────────────────
  @Get('randomization-context')
  @ApiOperation({
    summary: 'Lấy context cá nhân hóa cho màn random',
    description:
      'Trả về profile snapshot, recent dishes, suggested meal slot, available goals. ' +
      'Mobile gọi trước khi render RandomFlowScreen.',
  })
  getContext(@CurrentUser('sub') userId: string) {
    return this.randomizationService.getContext(userId);
  }

  // ── BA-006 §4.2 ─────────────────────────────────────────────────────────────
  @Post('dish-randomizations')
  @ApiOperation({
    summary: 'Random món ăn (BA-006 v1.1 + backward-compat BA-004)',
    description:
      'Hard filters: allergen CONTAINS, diet hard. Soft score: goal, time, novelty, popularity, budget. ' +
      'Trả về explanation với compatibilityPercent và fallbackApplied.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả random kèm explanation chi tiết' })
  randomize(
    @CurrentUser('sub') userId: string,
    @Body() dto: RandomizationRequestDto,
  ) {
    return this.randomizationService.randomize(userId, dto);
  }

  // ── BA-006 §4.3 ─────────────────────────────────────────────────────────────
  @Post('dish-randomizations/:id/retry')
  @ApiOperation({
    summary: 'Thử lại random (giữ tiêu chí, loại trừ kết quả cũ)',
    description: 'Liên kết với randomization cũ qua previousRandomizationId. Tự động tăng attemptNo.',
  })
  retry(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetryRandomizationDto,
  ) {
    return this.randomizationService.retry(userId, id, dto);
  }

  // ── BA-006 §4.4 ─────────────────────────────────────────────────────────────
  @Post('dish-randomizations/:id/select')
  @ApiOperation({
    summary: 'Xác nhận chọn món từ kết quả random',
    description: 'Cập nhật isSelected=true và ghi RecommendationEvent SELECT.',
  })
  markSelected(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelectRandomizationDto,
  ) {
    return this.randomizationService.markSelected(id, userId, dto);
  }

  // ── BA-006 §4.5 ─────────────────────────────────────────────────────────────
  @Post('dish-randomizations/:id/events')
  @ApiOperation({
    summary: 'Ghi nhận sự kiện feedback người dùng',
    description:
      'IMPRESSION, OPEN_DETAIL, DISLIKE, TOO_EXPENSIVE, v.v. — dùng để cải thiện thuật toán về sau.',
  })
  recordEvent(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecommendationEventDto,
  ) {
    return this.randomizationService.recordEvent(userId, id, dto);
  }

  // ── BA-006 §4.6 ─────────────────────────────────────────────────────────────
  @Get('me/random-history')
  @ApiOperation({
    summary: 'Lịch sử random của user (cursor-based)',
    description: 'selectedOnly=true để chỉ lấy những lần đã xác nhận chọn.',
  })
  history(
    @CurrentUser('sub') userId: string,
    @Query() query: RandomHistoryQueryDto,
  ) {
    return this.randomizationService.getHistory(userId, query);
  }
}
