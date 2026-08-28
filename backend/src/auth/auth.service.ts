import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;
  // Domain nội bộ — không phải email thật, chỉ dùng cho Supabase Auth
  private readonly INTERNAL_DOMAIN = 'user.mogu.internal';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('app.supabase.url')!,
      this.config.get<string>('app.supabase.secretKey')!,
    );
  }

  // ── Helpers: username → supabase email ───────────────────────────────────
  private usernameToEmail(username: string): string {
    return `${username.toLowerCase()}@${this.INTERNAL_DOMAIN}`;
  }

  // ── UC-AUTH-01: Đăng ký (username + password) ────────────────────────────
  async register(dto: RegisterDto, meta: RequestMeta) {
    // Kiểm tra username đã tồn tại chưa
    const existingAccount = await this.prisma.db.account.findUnique({
      where: { username: dto.username.toLowerCase() },
    }).catch(() => null);

    if (existingAccount) {
      throw new ConflictException({
        code: 'AUTH_USERNAME_EXISTS',
        message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.',
      });
    }

    const internalEmail = this.usernameToEmail(dto.username);

    // Tạo user trong Supabase Auth với email nội bộ
    const { data: signUpData, error: signUpError } = await this.supabase.auth.admin.createUser({
      email: internalEmail,
      password: dto.password,
      email_confirm: true, // bỏ qua xác minh email
    });

    if (signUpError) {
      if (
        signUpError.message.toLowerCase().includes('already registered') ||
        signUpError.message.toLowerCase().includes('duplicate')
      ) {
        throw new ConflictException({
          code: 'AUTH_USERNAME_EXISTS',
          message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.',
        });
      }
      throw new BadRequestException({ code: 'AUTH_REGISTER_FAILED', message: signUpError.message });
    }

    if (!signUpData.user) {
      throw new BadRequestException({ code: 'AUTH_REGISTER_FAILED', message: 'Đăng ký thất bại' });
    }

    // Tạo profile + account + consent (transaction)
    await this.prisma.db.$transaction(async (tx) => {
      // Tạo profile
      await tx.profile.upsert({
        where: { userId: signUpData.user!.id },
        create: {
          userId: signUpData.user!.id,
          accountStatus: 'ACTIVE',
          onboardingStatus: 'NOT_STARTED',
          consents: {
            create: [
              { consentType: 'TERMS_OF_SERVICE', version: dto.consentVersion, source: 'mobile_register' },
              { consentType: 'PRIVACY_POLICY', version: dto.consentVersion, source: 'mobile_register' },
            ],
          },
        },
        update: { accountStatus: 'ACTIVE' },
      });

      // Lấy profile id vừa tạo
      const profile = await tx.profile.findUnique({
        where: { userId: signUpData.user!.id },
        select: { id: true },
      });

      // Tạo account với username (liên kết profileId nếu schema có)
      await tx.account.upsert({
        where: { username: dto.username.toLowerCase() },
        create: {
          username: dto.username.toLowerCase(),
          passwordHash: signUpData.user!.id, // placeholder — password thật do Supabase quản lý
          mustChangePassword: false,
        },
        update: {},
      });
    });

    // Đăng nhập ngay để lấy session
    const { data: loginData, error: loginError } = await this.supabase.auth.signInWithPassword({
      email: internalEmail,
      password: dto.password,
    });

    if (loginError || !loginData.session) {
      throw new BadRequestException({
        code: 'AUTH_REGISTER_FAILED',
        message: 'Không thể tạo phiên đăng nhập sau khi đăng ký.',
      });
    }

    await this.audit({
      userId: signUpData.user.id,
      eventType: 'REGISTER_COMPLETED',
      result: 'SUCCESS',
      ...meta,
    });

    return {
      session: {
        accessToken: loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        expiresIn: loginData.session.expires_in,
      },
      user: await this.buildUserResponse(signUpData.user.id),
      nextStep: 'onboarding',
    };
  }

  // ── UC-AUTH-02: Đăng nhập (username + password) ──────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const internalEmail = this.usernameToEmail(dto.username);

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: internalEmail,
      password: dto.password,
    });

    if (error || !data.session) {
      await this.audit({
        eventType: 'LOGIN_FAILED',
        result: 'FAILURE',
        metadataSanitized: { reason: 'invalid_credentials' },
        ...meta,
      });

      // Không tiết lộ username có tồn tại không
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }

    // Kiểm tra trạng thái account
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId: data.user.id },
    });

    if (profile?.accountStatus === 'LOCKED') {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_LOCKED',
        message: 'Tài khoản đã bị khóa tạm thời. Vui lòng liên hệ quản trị viên.',
      });
    }

    if (profile?.accountStatus === 'SUSPENDED' || profile?.accountStatus === 'DELETED') {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_SUSPENDED',
        message: 'Tài khoản không còn hoạt động.',
      });
    }

    // Auto-activate PENDING_VERIFICATION từ flow cũ
    if (profile?.accountStatus === 'PENDING_VERIFICATION') {
      await this.prisma.db.profile.update({
        where: { userId: data.user.id },
        data: { accountStatus: 'ACTIVE' },
      });
    }

    // Kiểm tra mustChangePassword
    const account = await this.prisma.db.account.findUnique({
      where: { username: dto.username.toLowerCase() },
      select: { mustChangePassword: true },
    }).catch(() => null);

    await this.audit({
      userId: data.user.id,
      eventType: 'LOGIN_SUCCEEDED',
      result: 'SUCCESS',
      ...meta,
    });

    return {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      },
      user: await this.buildUserResponse(data.user.id),
      nextStep: this.resolveNextStep(profile?.onboardingStatus),
      mustChangePassword: account?.mustChangePassword ?? false,
    };
  }

  // ── Refresh token ─────────────────────────────────────────────────────────
  async refreshToken(dto: RefreshTokenDto, meta: RequestMeta) {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_FAILED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    await this.audit({
      userId: data.user?.id,
      eventType: 'TOKEN_REFRESHED',
      result: 'SUCCESS',
      ...meta,
    });

    return {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      },
    };
  }

  // ── GET /me ───────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });

    if (!profile) {
      throw new UnauthorizedException({
        code: 'AUTH_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy profile',
      });
    }

    return this.buildUserResponse(userId);
  }

  // ── GET /me/roles ─────────────────────────────────────────────────────────
  async getMyRoles(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: {
        profileRoles: {
          select: { role: true },
        },
      },
    });

    return {
      roles: profile?.profileRoles.map((pr) => pr.role) ?? [],
    };
  }

  // ── UC-AUTH-03: Quên mật khẩu (Admin reset) ──────────────────────────────
  // Người dùng liên hệ admin, admin gọi POST /admin/accounts/:id/reset-password
  // Endpoint này chỉ trả thông báo chung
  async forgotPassword(_dto: ForgotPasswordDto, _meta: RequestMeta) {
    return {
      message: 'Vui lòng liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.',
    };
  }

  // ── Admin reset password (tạo temporary password) ─────────────────────────
  async adminResetPassword(targetUserId: string, dto: AdminResetPasswordDto, actorId: string, meta: RequestMeta) {
    // Lấy profile
    const profile = await this.prisma.db.profile.findUnique({ where: { userId: targetUserId } });
    if (!profile) {
      throw new BadRequestException({ code: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy người dùng.' });
    }

    // Lấy email nội bộ
    const supabaseUser = await this.supabase.auth.admin.getUserById(targetUserId);
    if (!supabaseUser.data.user?.email) {
      throw new BadRequestException({ code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản Supabase.' });
    }

    // Cập nhật password trong Supabase
    const { error } = await this.supabase.auth.admin.updateUserById(targetUserId, {
      password: dto.temporaryPassword,
    });

    if (error) {
      throw new BadRequestException({ code: 'RESET_FAILED', message: error.message });
    }

    // Thu hồi tất cả session cũ
    await this.supabase.auth.admin.signOut(targetUserId, 'global');

    // Đánh dấu mustChangePassword từ username tương ứng
    const username = supabaseUser.data.user.email.replace(`@${this.INTERNAL_DOMAIN}`, '');
    await this.prisma.db.account.update({
      where: { username },
      data: { mustChangePassword: true },
    }).catch(() => null);

    // Audit log
    await this.audit({
      userId: actorId,
      eventType: 'TEMP_PASSWORD_ISSUED',
      result: 'SUCCESS',
      metadataSanitized: { targetUserId, reason: dto.reason },
      ...meta,
    });

    return { message: 'Mật khẩu tạm đã được cấp. Người dùng cần đổi mật khẩu khi đăng nhập tiếp theo.' };
  }

  // ── Đổi temporary password ───────────────────────────────────────────────
  async changeTemporaryPassword(userId: string, accessToken: string, dto: ChangeTemporaryPasswordDto, meta: RequestMeta) {
    // Lấy thông tin user từ Supabase
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    if (!userData.user?.email) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
    }

    const username = userData.user.email.replace(`@${this.INTERNAL_DOMAIN}`, '');

    // Xác minh current password (temporary)
    const { data: verifyData, error: verifyError } = await this.supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: dto.currentPassword,
    });

    if (verifyError || !verifyData.session) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }

    // Đặt mật khẩu mới
    const userClient = createClient(
      this.config.get<string>('app.supabase.url')!,
      this.config.get<string>('app.supabase.publishableKey')!,
      { global: { headers: { Authorization: `Bearer ${verifyData.session.access_token}` } } },
    );

    const { error: updateError } = await userClient.auth.updateUser({ password: dto.newPassword });
    if (updateError) {
      throw new BadRequestException({ code: 'CHANGE_PASSWORD_FAILED', message: updateError.message });
    }

    // Xóa flag mustChangePassword
    await this.prisma.db.account.update({
      where: { username },
      data: { mustChangePassword: false },
    }).catch(() => null);

    await this.audit({
      userId,
      eventType: 'TEMP_PASSWORD_CHANGED',
      result: 'SUCCESS',
      ...meta,
    });

    return {
      message: 'Mật khẩu đã được cập nhật thành công.',
      session: {
        accessToken: verifyData.session.access_token,
        refreshToken: verifyData.session.refresh_token,
        expiresIn: verifyData.session.expires_in,
      },
    };
  }

  // ── UC-AUTH-05: Đăng xuất ─────────────────────────────────────────────────
  async logout(userId: string, accessToken: string, dto: LogoutDto, meta: RequestMeta) {
    if (dto.scope === 'all') {
      await this.supabase.auth.admin.signOut(userId, 'global');
    } else {
      const userClient = createClient(
        this.config.get<string>('app.supabase.url')!,
        this.config.get<string>('app.supabase.publishableKey')!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
      );
      await userClient.auth.signOut();
    }

    await this.audit({
      userId,
      eventType: 'LOGOUT',
      result: 'SUCCESS',
      metadataSanitized: { scope: dto.scope },
      ...meta,
    });

    return { message: 'Đăng xuất thành công.' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async buildUserResponse(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      include: {
        profileRoles: { select: { role: true } },
      },
    });
    return {
      id: userId,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      accountStatus: profile?.accountStatus,
      onboardingStatus: profile?.onboardingStatus,
      onboardingStep: profile?.onboardingStep,
      roles: profile?.profileRoles?.map((r) => r.role) ?? [],
    };
  }

  private resolveNextStep(onboardingStatus?: string | null): string {
    switch (onboardingStatus) {
      case 'COMPLETED': return 'home';
      case 'IN_PROGRESS': return 'onboarding_resume';
      default: return 'onboarding';
    }
  }

  private async audit(params: {
    userId?: string;
    eventType: string;
    result: 'SUCCESS' | 'FAILURE';
    ipHash?: string;
    deviceIdHash?: string;
    platform?: string;
    metadataSanitized?: Record<string, unknown>;
    correlationId?: string;
  }) {
    try {
      await this.prisma.db.authAuditLog.create({
        data: {
          userId: params.userId,
          eventType: params.eventType as any,
          result: params.result as any,
          ipHash: params.ipHash,
          deviceIdHash: params.deviceIdHash,
          platform: params.platform,
          metadataSanitized: params.metadataSanitized as any,
          correlationId: params.correlationId,
        },
      });
    } catch (err) {
      this.logger.error('Audit log failed', err);
    }
  }
}

// Type helper
interface RequestMeta {
  ipHash?: string;
  deviceIdHash?: string;
  platform?: string;
  correlationId?: string;
}
