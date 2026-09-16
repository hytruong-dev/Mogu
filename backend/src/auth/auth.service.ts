import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
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
import { ConsentType } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: SupabaseClient;
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

  private usernameToEmail(username: string): string {
    return `${username.toLowerCase()}@${this.INTERNAL_DOMAIN}`;
  }

  // ── POST /v1/auth/register ────────────────────────────────────────────────
  async register(dto: RegisterDto, meta: RequestMeta) {
    const existingAccount = await this.prisma.db.account
      .findUnique({
        where: { username: dto.username.toLowerCase() },
      })
      .catch(() => null);

    if (existingAccount) {
      throw new ConflictException({
        code: 'AUTH_USERNAME_EXISTS',
        message: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.',
      });
    }

    const internalEmail = dto.email ?? this.usernameToEmail(dto.username);

    const { data: signUpData, error: signUpError } =
      await this.supabase.auth.admin.createUser({
        email: internalEmail,
        password: dto.password,
        email_confirm: true,
      });

    if (signUpError) {
      if (
        signUpError.message.toLowerCase().includes('already registered') ||
        signUpError.message.toLowerCase().includes('duplicate')
      ) {
        throw new ConflictException({
          code: 'AUTH_USERNAME_EXISTS',
          message: 'Tên đăng nhập hoặc email này đã được sử dụng.',
        });
      }
      throw new BadRequestException({
        code: 'AUTH_REGISTER_FAILED',
        message: signUpError.message,
      });
    }

    if (!signUpData.user) {
      throw new BadRequestException({
        code: 'AUTH_REGISTER_FAILED',
        message: 'Đăng ký thất bại',
      });
    }

    // Build consents list
    const consentEntries: Array<{
      consentType: ConsentType;
      version: string;
      source: string;
    }> = [];

    if (dto.consents && dto.consents.length > 0) {
      for (const c of dto.consents) {
        if (!c.accepted) continue;
        const typeMapped =
          c.type === 'TERMS' || c.type === 'TERMS_OF_SERVICE'
            ? ConsentType.TERMS_OF_SERVICE
            : ConsentType.PRIVACY_POLICY;
        consentEntries.push({
          consentType: typeMapped,
          version: c.version,
          source: 'mobile_register',
        });
      }
    } else {
      const ver = dto.consentVersion ?? '1.0';
      consentEntries.push(
        {
          consentType: ConsentType.TERMS_OF_SERVICE,
          version: ver,
          source: 'mobile_register',
        },
        {
          consentType: ConsentType.PRIVACY_POLICY,
          version: ver,
          source: 'mobile_register',
        },
      );
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId: signUpData.user!.id },
        create: {
          userId: signUpData.user!.id,
          accountStatus: 'ACTIVE',
          onboardingStatus: 'NOT_STARTED',
          consents: {
            create: consentEntries,
          },
        },
        update: { accountStatus: 'ACTIVE' },
      });

      await tx.account.upsert({
        where: { username: dto.username.toLowerCase() },
        create: {
          username: dto.username.toLowerCase(),
          userId: signUpData.user!.id,
          passwordHash: signUpData.user!.id,
          mustChangePassword: false,
        },
        update: {
          userId: signUpData.user!.id,
        },
      });
    });

    const { data: loginData, error: loginError } =
      await this.supabase.auth.signInWithPassword({
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

    await this.trackSession(signUpData.user.id, loginData.session.refresh_token, meta);

    return {
      session: {
        accessToken: loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        expiresIn: loginData.session.expires_in,
        accessTokenExpiresAt: new Date(
          Date.now() + loginData.session.expires_in * 1000,
        ).toISOString(),
      },
      user: await this.buildUserResponse(signUpData.user.id),
      nextStep: 'onboarding',
    };
  }

  // ── POST /v1/auth/login ──────────────────────────────────────────────────
  async login(dto: LoginDto, meta: RequestMeta) {
    const rawIdentifier = dto.identifier ?? dto.username;
    if (!rawIdentifier) {
      throw new BadRequestException({
        code: 'AUTH_INVALID_INPUT',
        message: 'Vui lòng cung cấp username hoặc email.',
      });
    }

    const isEmail = rawIdentifier.includes('@');
    const internalEmail = isEmail
      ? rawIdentifier
      : this.usernameToEmail(rawIdentifier);

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

      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
    }

    const profile = await this.prisma.db.profile.findUnique({
      where: { userId: data.user.id },
    });

    if (profile?.accountStatus === 'LOCKED') {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_LOCKED',
        message: 'Tài khoản đã bị khóa tạm thời. Vui lòng liên hệ quản trị viên.',
      });
    }

    if (
      profile?.accountStatus === 'SUSPENDED' ||
      profile?.accountStatus === 'DELETED'
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_SUSPENDED',
        message: 'Tài khoản không còn hoạt động.',
      });
    }

    if (profile?.accountStatus === 'PENDING_VERIFICATION') {
      await this.prisma.db.profile.update({
        where: { userId: data.user.id },
        data: { accountStatus: 'ACTIVE' },
      });
    }

    const accountName = isEmail
      ? rawIdentifier.split('@')[0]
      : rawIdentifier.toLowerCase();
    const account = await this.prisma.db.account
      .findUnique({
        where: { username: accountName },
        select: { mustChangePassword: true },
      })
      .catch(() => null);

    await this.audit({
      userId: data.user.id,
      eventType: 'LOGIN_SUCCEEDED',
      result: 'SUCCESS',
      ...meta,
    });

    await this.trackSession(data.user.id, data.session.refresh_token, meta);

    return {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        accessTokenExpiresAt: new Date(
          Date.now() + data.session.expires_in * 1000,
        ).toISOString(),
      },
      user: await this.buildUserResponse(data.user.id),
      nextStep: this.resolveNextStep(profile?.onboardingStatus),
      mustChangePassword: account?.mustChangePassword ?? false,
    };
  }

  // ── POST /v1/auth/refresh ────────────────────────────────────────────────
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

    if (data.user?.id) {
      await this.trackSession(data.user.id, data.session.refresh_token, meta);
    }

    return {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        accessTokenExpiresAt: new Date(
          Date.now() + data.session.expires_in * 1000,
        ).toISOString(),
      },
    };
  }

  // ── GET /v1/auth/me ──────────────────────────────────────────────────────
  async getMe(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new UnauthorizedException({
        code: 'AUTH_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy profile',
      });
    }

    return this.buildUserResponse(userId);
  }

  // ── GET /v1/auth/me/roles ────────────────────────────────────────────────
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

  // ── Password recovery ─────────────────────────────────────────────────────
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async findAccountByUserId(userId: string) {
    const byUserId = await this.prisma.db.account.findFirst({
      where: { userId },
    });
    if (byUserId) return byUserId;
    return this.prisma.db.account.findFirst({
      where: { passwordHash: userId },
    });
  }

  private async trackSession(
    userId: string,
    refreshToken: string | undefined,
    meta: RequestMeta,
  ) {
    if (!refreshToken) return;
    try {
      const account = await this.findAccountByUserId(userId);
      if (!account) return;
      const tokenHash = this.hashToken(refreshToken);
      await (this.prisma.db as any).refreshSession.upsert({
        where: { tokenHash },
        create: {
          accountId: account.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          installationId: meta.installationId ?? null,
          platform: meta.platform ?? null,
          deviceLabel: meta.platform ? `${meta.platform} device` : 'Mobile Device',
          lastUsedAt: new Date(),
        },
        update: {
          lastUsedAt: new Date(),
          installationId: meta.installationId ?? undefined,
          platform: meta.platform ?? undefined,
          revokedAt: null,
        },
      });
    } catch (err) {
      this.logger.warn(`trackSession failed: ${(err as Error).message}`);
    }
  }

  async passwordResetRequest(dto: PasswordResetRequestDto) {
    const neutral = {
      message:
        'Nếu tài khoản tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.',
    };

    try {
      const isEmail = dto.identifier.includes('@');
      let userId: string | null = null;

      if (isEmail) {
        const { data } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
        const found = data.users.find(
          (u) => u.email?.toLowerCase() === dto.identifier.toLowerCase(),
        );
        userId = found?.id ?? null;
      } else {
        const account = await this.prisma.db.account.findUnique({
          where: { username: dto.identifier.toLowerCase() },
        });
        userId = account?.passwordHash ?? null;
      }

      if (!userId) return neutral;

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      await (this.prisma.db as any).passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const nodeEnv = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
      if (nodeEnv !== 'production') {
        this.logger.log(`[DEV] password reset token for ${userId}: ${rawToken}`);
      }
      // Production email send would go here when SMTP is configured.
    } catch (err) {
      this.logger.warn(`passwordResetRequest: ${(err as Error).message}`);
    }

    return neutral;
  }

  async passwordResetConfirm(dto: PasswordResetConfirmationDto) {
    const tokenHash = this.hashToken(dto.tokenOrOtp);
    const row = await (this.prisma.db as any).passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      });
    }

    const { error } = await this.supabase.auth.admin.updateUserById(row.userId, {
      password: dto.newPassword,
    });
    if (error) {
      throw new BadRequestException({
        code: 'RESET_FAILED',
        message: error.message,
      });
    }

    await (this.prisma.db as any).passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    await this.supabase.auth.admin.signOut(row.userId, 'global');

    const account = await this.findAccountByUserId(row.userId);
    if (account) {
      await this.prisma.db.refreshSession.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return {
      message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.',
    };
  }

  async verifyEmail(dto: EmailVerificationDto) {
    const tokenHash = this.hashToken(dto.tokenOrOtp);
    const row = await (this.prisma.db as any).emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'VERIFY_TOKEN_INVALID',
        message: 'Mã xác minh email không hợp lệ hoặc đã hết hạn.',
      });
    }

    await (this.prisma.db as any).emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    await this.prisma.db.profile.update({
      where: { userId: row.userId },
      data: { accountStatus: 'ACTIVE' },
    });

    return { message: 'Xác minh email thành công.' };
  }

  async passwordChange(
    userId: string,
    dto: PasswordChangeDto,
    meta: RequestMeta,
  ) {
    const { data: userData } = await this.supabase.auth.admin.getUserById(
      userId,
    );
    if (!userData.user?.email) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản.',
      });
    }

    const { data: verifyData, error: verifyError } =
      await this.supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: dto.currentPassword,
      });

    if (verifyError || !verifyData.session) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }

    const { error: updateError } =
      await this.supabase.auth.admin.updateUserById(userId, {
        password: dto.newPassword,
      });

    if (updateError) {
      throw new BadRequestException({
        code: 'CHANGE_PASSWORD_FAILED',
        message: updateError.message,
      });
    }

    await this.audit({
      userId,
      eventType: 'PASSWORD_CHANGED',
      result: 'SUCCESS',
      ...meta,
    });

    return { message: 'Mật khẩu đã được cập nhật thành công.' };
  }

  // ── Sessions Management ──────────────────────────────────────────────────
  async getSessions(userId: string, meta: RequestMeta) {
    const account = await this.findAccountByUserId(userId);
    if (!account) {
      return { items: [] };
    }

    const sessions = await this.prisma.db.refreshSession.findMany({
      where: {
        accountId: account.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 50,
    });

    return {
      items: sessions.map((s) => ({
        sessionId: s.id,
        deviceLabel: (s as any).deviceLabel ?? 'Mobile Device',
        platform: (s as any).platform ?? meta.platform ?? 'mobile',
        installationId: (s as any).installationId ?? null,
        lastSeenAt: (s.lastUsedAt ?? s.createdAt).toISOString(),
        isCurrent:
          !!meta.installationId &&
          (s as any).installationId === meta.installationId,
      })),
    };
  }

  async deleteSession(userId: string, sessionId: string) {
    const account = await this.findAccountByUserId(userId);
    if (!account) return { success: true };

    await this.prisma.db.refreshSession.updateMany({
      where: { id: sessionId, accountId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async deleteAllSessionsExceptCurrent(userId: string, currentSessionId?: string) {
    const account = await this.findAccountByUserId(userId);
    if (!account) return { success: true };

    await this.prisma.db.refreshSession.updateMany({
      where: {
        accountId: account.id,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ── UC-AUTH-03: Quên mật khẩu (Admin reset) ──────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto, _meta: RequestMeta) {
    return {
      message:
        'Vui lòng liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.',
    };
  }

  // ── Admin reset password ──────────────────────────────────────────────────
  async adminResetPassword(
    targetUserId: string,
    dto: AdminResetPasswordDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId: targetUserId },
    });
    if (!profile) {
      throw new BadRequestException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const supabaseUser =
      await this.supabase.auth.admin.getUserById(targetUserId);
    if (!supabaseUser.data.user?.email) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản Supabase.',
      });
    }

    const { error } = await this.supabase.auth.admin.updateUserById(
      targetUserId,
      {
        password: dto.temporaryPassword,
      },
    );

    if (error) {
      throw new BadRequestException({
        code: 'RESET_FAILED',
        message: error.message,
      });
    }

    await this.supabase.auth.admin.signOut(targetUserId, 'global');

    const username = supabaseUser.data.user.email.replace(
      `@${this.INTERNAL_DOMAIN}`,
      '',
    );
    await this.prisma.db.account
      .update({
        where: { username },
        data: { mustChangePassword: true },
      })
      .catch(() => null);

    await this.audit({
      userId: actorId,
      eventType: 'TEMP_PASSWORD_ISSUED',
      result: 'SUCCESS',
      metadataSanitized: { targetUserId, reason: dto.reason },
      ...meta,
    });

    return {
      message:
        'Mật khẩu tạm đã được cấp. Người dùng cần đổi mật khẩu khi đăng nhập tiếp theo.',
    };
  }

  // ── Đổi temporary password ───────────────────────────────────────────────
  async changeTemporaryPassword(
    userId: string,
    accessToken: string,
    dto: ChangeTemporaryPasswordDto,
    meta: RequestMeta,
  ) {
    const { data: userData } =
      await this.supabase.auth.admin.getUserById(userId);
    if (!userData.user?.email) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản.',
      });
    }

    const username = userData.user.email.replace(
      `@${this.INTERNAL_DOMAIN}`,
      '',
    );

    const { data: verifyData, error: verifyError } =
      await this.supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: dto.currentPassword,
      });

    if (verifyError || !verifyData.session) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }

    const userClient = createClient(
      this.config.get<string>('app.supabase.url')!,
      this.config.get<string>('app.supabase.publishableKey')!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${verifyData.session.access_token}`,
          },
        },
      },
    );

    const { error: updateError } = await userClient.auth.updateUser({
      password: dto.newPassword,
    });
    if (updateError) {
      throw new BadRequestException({
        code: 'CHANGE_PASSWORD_FAILED',
        message: updateError.message,
      });
    }

    await this.prisma.db.account
      .update({
        where: { username },
        data: { mustChangePassword: false },
      })
      .catch(() => null);

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
  async logout(
    userId: string,
    accessToken: string,
    dto: LogoutDto,
    meta: RequestMeta,
  ) {
    if (dto.allDevices || dto.scope === 'all') {
      await this.supabase.auth.admin.signOut(userId, 'global');
    } else {
      const userClient = createClient(
        this.config.get<string>('app.supabase.url')!,
        this.config.get<string>('app.supabase.publishableKey')!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
      );
      await userClient.auth.signOut().catch(() => {});
    }

    await this.audit({
      userId,
      eventType: 'LOGOUT',
      result: 'SUCCESS',
      metadataSanitized: { scope: dto.scope, allDevices: dto.allDevices },
      ...meta,
    });

    return { success: true, message: 'Đăng xuất thành công.' };
  }

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
      case 'COMPLETED':
        return 'home';
      case 'IN_PROGRESS':
        return 'onboarding_resume';
      default:
        return 'onboarding';
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

interface RequestMeta {
  ipHash?: string;
  deviceIdHash?: string;
  platform?: string;
  correlationId?: string;
  installationId?: string;
}
