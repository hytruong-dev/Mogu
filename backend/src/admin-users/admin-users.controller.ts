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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin / Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.SUPER_ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  private actorId(user: any) {
    return typeof user === 'string' ? user : (user.sub ?? user.id);
  }

  @Get('users/summary')
  @ApiOperation({ summary: 'Dashboard metrics người dùng' })
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.adminUsers.getSummary({ from, to, timezone });
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sách người dùng (cursor)' })
  listUsers(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.adminUsers.listUsers({ q, status, cursor, limit });
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Chi tiết user (email masked)' })
  getUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminUsers.getUser(userId);
  }

  @Post('users/:userId/password-reset-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Gửi password reset (không trả password)' })
  passwordReset(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body()
    body: { reasonCode?: string; caseId?: string; revokeSessions?: boolean },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.requestPasswordReset(
      this.actorId(actor),
      userId,
      body,
      requestId,
    );
  }

  @Post('users/:userId/email-verification-reminders')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Gửi nhắc xác minh email' })
  verificationReminder(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { reasonCode?: string; caseId?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.sendVerificationReminder(
      this.actorId(actor),
      userId,
      body,
      requestId,
    );
  }

  @Get('users/:userId/sessions')
  @ApiOperation({ summary: 'Danh sách session' })
  listSessions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminUsers.listSessions(userId);
  }

  @Post('users/:userId/session-revocations')
  @ApiOperation({ summary: 'Thu hồi session' })
  revokeSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body()
    body: {
      scope?: 'ALL' | 'SELECTED';
      sessionIds?: string[];
      reasonCode?: string;
      caseId?: string;
    },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.revokeSessions(
      this.actorId(actor),
      userId,
      body,
      requestId,
    );
  }

  @Post('users/:userId/suspensions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo suspension' })
  createSuspension(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body()
    body: {
      reasonCode: string;
      reasonNote?: string;
      caseId?: string;
      startsAt?: string;
      endsAt?: string;
      revokeSessions?: boolean;
    },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.createSuspension(
      this.actorId(actor),
      userId,
      body,
      requestId,
    );
  }

  @Post('users/:userId/suspensions/:suspensionId/end')
  @ApiOperation({ summary: 'Kết thúc suspension' })
  endSuspension(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('suspensionId', ParseUUIDPipe) suspensionId: string,
    @Body() body: { reasonCode?: string; caseId?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.endSuspension(
      this.actorId(actor),
      userId,
      suspensionId,
      body,
      requestId,
    );
  }

  @Post('users/:userId/security-unlocks')
  @ApiOperation({ summary: 'Mở khóa bảo mật' })
  securityUnlock(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { reasonCode?: string; caseId?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.securityUnlock(
      this.actorId(actor),
      userId,
      body,
      requestId,
    );
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'Đọc roles' })
  getRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminUsers.getRoles(userId);
  }

  @Put('users/:userId/roles/:role')
  @ApiOperation({ summary: 'Gán role' })
  assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: string,
    @Body() body: { reasonCode?: string; ticketId?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.assignRole(
      this.actorId(actor),
      userId,
      role,
      body,
      requestId,
    );
  }

  @Delete('users/:userId/roles/:role')
  @ApiOperation({ summary: 'Thu hồi role (last SUPER_ADMIN guarded)' })
  revokeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: string,
    @Body() body: { reasonCode?: string; ticketId?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.revokeRole(
      this.actorId(actor),
      userId,
      role,
      body ?? {},
      requestId,
    );
  }

  @Get('users/:userId/audit-events')
  @ApiOperation({ summary: 'Audit events theo user' })
  auditEvents(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('eventType') eventType?: string,
  ) {
    return this.adminUsers.listAuditEvents(userId, { cursor, limit, eventType });
  }

  @Post('user-list-exports')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Xuất danh sách người dùng (async)' })
  createExport(
    @Body()
    body: {
      filters?: Record<string, unknown>;
      columns?: string[];
      format?: string;
      reasonCode?: string;
    },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.createUserListExport(
      this.actorId(actor),
      body,
      requestId,
    );
  }

  @Get('user-list-exports/:jobId')
  @ApiOperation({ summary: 'Trạng thái / download export' })
  getExport(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() actor: any,
  ) {
    return this.adminUsers.getUserListExport(this.actorId(actor), jobId);
  }

  @Get('users/:userId/privacy-cases')
  @ApiOperation({ summary: 'Privacy cases của user' })
  privacyCases(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminUsers.listPrivacyCases(userId);
  }

  @Post('privacy-cases/:caseId/actions')
  @ApiOperation({ summary: 'Hành động trên privacy case' })
  privacyAction(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() body: { action: string; reasonCode?: string; note?: string },
    @CurrentUser() actor: any,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminUsers.privacyCaseAction(
      this.actorId(actor),
      caseId,
      body,
      requestId,
    );
  }
}
