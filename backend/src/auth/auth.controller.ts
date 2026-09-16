import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SystemRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto';
import {
  PasswordResetRequestDto,
  PasswordResetConfirmationDto,
  EmailVerificationDto,
  PasswordChangeDto,
} from './dto/password-recovery.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import type { User } from '@supabase/supabase-js';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractMeta(req: FastifyRequest) {
    const ip = req.ip ?? (req.headers['x-forwarded-for'] as string);
    return {
      correlationId: req.headers['x-correlation-id'] as string,
      platform: req.headers['x-platform'] as string,
      ipHash: ip
        ? Buffer.from(ip).toString('base64url').slice(0, 16)
        : undefined,
    };
  }

  // ── POST /auth/register ──────────────────────────────────────────────────
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'UC-AUTH-01: Đăng ký tài khoản mới',
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký và đăng nhập thành công — trả session ngay',
  })
  register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    return this.authService.register(dto, this.extractMeta(req));
  }

  // ── POST /auth/login ─────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC-AUTH-02: Đăng nhập bằng identifier + password' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công — trả session',
  })
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  // ── POST /auth/refresh ───────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: FastifyRequest) {
    return this.authService.refreshToken(dto, this.extractMeta(req));
  }

  // ── GET /auth/me ─────────────────────────────────────────────────────────
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại + onboarding status' })
  getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user.id);
  }

  // ── GET /auth/me/roles ────────────────────────────────────────────────────
  @Get('me/roles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách roles của user hiện tại' })
  getMyRoles(@CurrentUser() user: User) {
    return this.authService.getMyRoles(user.id);
  }

  // ── Password recovery & verification endpoints (§2) ────────────────────────
  @Public()
  @Post('password-reset-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu' })
  passwordResetRequest(@Body() dto: PasswordResetRequestDto) {
    return this.authService.passwordResetRequest(dto);
  }

  @Public()
  @Post('password-reset-confirmations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận đặt lại mật khẩu' })
  passwordResetConfirm(@Body() dto: PasswordResetConfirmationDto) {
    return this.authService.passwordResetConfirm(dto);
  }

  @Public()
  @Post('email-verifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác minh email' })
  verifyEmail(@Body() dto: EmailVerificationDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('password-change')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu người dùng' })
  passwordChange(
    @CurrentUser() user: User,
    @Body() dto: PasswordChangeDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.passwordChange(
      user.id,
      dto,
      this.extractMeta(req),
    );
  }

  // ── POST /auth/forgot-password ───────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC-AUTH-03: Yêu cầu hỗ trợ đặt lại mật khẩu (liên hệ Admin)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: FastifyRequest) {
    return this.authService.forgotPassword(dto, this.extractMeta(req));
  }

  // ── POST /auth/change-temporary-password ─────────────────────────────────
  @Post('change-temporary-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu tạm sau khi Admin reset' })
  changeTemporaryPassword(
    @CurrentUser() user: User,
    @Req() req: FastifyRequest & { accessToken: string },
    @Body() dto: ChangeTemporaryPasswordDto,
  ) {
    return this.authService.changeTemporaryPassword(
      user.id,
      req.accessToken,
      dto,
      this.extractMeta(req),
    );
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────
  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'UC-AUTH-05: Đăng xuất' })
  logout(
    @CurrentUser() user: User,
    @Req() req: FastifyRequest & { accessToken: string },
    @Body() dto: LogoutDto,
  ) {
    return this.authService.logout(
      user.id,
      req.accessToken,
      dto,
      this.extractMeta(req),
    );
  }
}

// ── Sessions Management Controller (§2) ──────────────────────────────────────
@ApiTags('Sessions')
@Controller('me/sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  private extractMeta(req: FastifyRequest) {
    return {
      platform: req.headers['x-platform'] as string,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách phiên đăng nhập của tôi' })
  getSessions(@CurrentUser() user: User, @Req() req: FastifyRequest) {
    return this.authService.getSessions(user.id, this.extractMeta(req));
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Đóng một phiên đăng nhập theo ID' })
  deleteSession(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.deleteSession(user.id, sessionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Đóng tất cả các phiên ngoại trừ phiên hiện tại' })
  deleteAllSessionsExceptCurrent(
    @CurrentUser() user: User,
    @Query('exceptCurrent') exceptCurrent?: boolean,
  ) {
    return this.authService.deleteAllSessionsExceptCurrent(user.id);
  }
}

// ── Admin: Reset password ──────────────────────────────────────────────────
@ApiTags('Admin / Accounts')
@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminAccountController {
  constructor(private readonly authService: AuthService) {}

  private extractMeta(req: FastifyRequest) {
    const ip = req.ip ?? (req.headers['x-forwarded-for'] as string);
    return {
      correlationId: req.headers['x-correlation-id'] as string,
      platform: req.headers['x-platform'] as string,
      ipHash: ip
        ? Buffer.from(ip).toString('base64url').slice(0, 16)
        : undefined,
    };
  }

  @Post(':userId/reset-password')
  @Roles(SystemRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Deprecated] Reset mật khẩu tạm — dùng POST /admin/users/:userId/password-reset-requests',
    deprecated: true,
  })
  adminResetPassword(
    @Param('userId') targetUserId: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor: User,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.adminResetPassword(
      targetUserId,
      dto,
      actor.id,
      this.extractMeta(req),
    );
  }
}
