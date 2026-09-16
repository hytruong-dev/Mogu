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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrivacyService } from './privacy.service';

@ApiTags('Privacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  private userId(user: any) {
    return typeof user === 'string' ? user : (user.sub ?? user.id);
  }

  @Post('data-exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Yêu cầu xuất dữ liệu cá nhân' })
  requestExport(
    @CurrentUser() user: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.privacy.requestExport(this.userId(user), idempotencyKey);
  }

  @Get('data-exports/:jobId')
  @ApiOperation({ summary: 'Tải kết quả xuất dữ liệu (signed URL style)' })
  getExport(
    @CurrentUser() user: any,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.privacy.getExport(this.userId(user), jobId);
  }

  @Post(['account-deletion', 'account-deletion-requests'])
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Yêu cầu xóa tài khoản (grace period)' })
  requestDeletion(@CurrentUser() user: any) {
    return this.privacy.requestAccountDeletion(this.userId(user));
  }

  @Get('account-deletion-request')
  @ApiOperation({ summary: 'Trạng thái yêu cầu xóa tài khoản' })
  getDeletion(@CurrentUser() user: any) {
    return this.privacy.getAccountDeletionRequest(this.userId(user));
  }

  @Delete('account-deletion-request')
  @ApiOperation({ summary: 'Hủy yêu cầu xóa tài khoản trong grace period' })
  cancelDeletion(@CurrentUser() user: any) {
    return this.privacy.cancelAccountDeletionRequest(this.userId(user));
  }

  @Delete('random-history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa lịch sử random' })
  async deleteRandomHistory(@CurrentUser() user: any) {
    await this.privacy.clearHistory(this.userId(user), 'random');
  }

  @Delete('health-data')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa toàn bộ dữ liệu sức khỏe' })
  async deleteHealthData(@CurrentUser() user: any) {
    await this.privacy.clearHealth(this.userId(user));
  }

  @Post('clear-history')
  @ApiOperation({ summary: 'Xóa lịch sử random / hoạt động (legacy)' })
  clearHistory(
    @CurrentUser() user: any,
    @Body() body: { scope?: 'random' | 'all' },
  ) {
    return this.privacy.clearHistory(this.userId(user), body?.scope ?? 'random');
  }

  @Post('clear-health')
  @ApiOperation({ summary: 'Xóa nhật ký sức khỏe (legacy)' })
  clearHealth(@CurrentUser() user: any) {
    return this.privacy.clearHealth(this.userId(user));
  }
}
