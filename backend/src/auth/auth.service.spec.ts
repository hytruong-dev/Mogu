// Mock @supabase/supabase-js trước khi import AuthService
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
      signOut: jest.fn(),
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        updateUserById: jest.fn().mockResolvedValue({ error: null }),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    },
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrismaDb = {
  profile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  refreshSession: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn: (tx: any) => Promise<any>) =>
    fn(mockPrismaDb),
  ),
};

const mockPrismaService = { db: mockPrismaDb };

const mockConfigService = {
  get: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      'app.supabase.url': 'https://test.supabase.co',
      'app.supabase.secretKey': 'test-secret-key',
      'app.supabase.serviceRoleKey': 'test-service-role-key',
    };
    return cfg[key] ?? null;
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── resolveNextStep ────────────────────────────────────────────────────────

  it('resolveNextStep returns onboarding_resume when status is IN_PROGRESS', () => {
    const step = (service as any).resolveNextStep('IN_PROGRESS');
    expect(step).toBe('onboarding_resume');
  });

  it('resolveNextStep returns home when status is COMPLETED', () => {
    const step = (service as any).resolveNextStep('COMPLETED');
    expect(step).toBe('home');
  });

  it('resolveNextStep returns onboarding when status is null', () => {
    const step = (service as any).resolveNextStep(null);
    expect(step).toBe('onboarding');
  });

  it('resolveNextStep returns onboarding when status is NOT_STARTED', () => {
    const step = (service as any).resolveNextStep('NOT_STARTED');
    expect(step).toBe('onboarding');
  });

  // ── buildUserResponse ──────────────────────────────────────────────────────

  describe('buildUserResponse', () => {
    it('should return roles array when profile has roles', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce({
        userId: 'user-1',
        displayName: 'Test Admin',
        avatarUrl: null,
        accountStatus: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        onboardingStep: 8,
        profileRoles: [{ role: 'SUPER_ADMIN' }],
      });

      const result = await (service as any).buildUserResponse('user-1');
      expect(result.roles).toEqual(['SUPER_ADMIN']);
      expect(result.displayName).toBe('Test Admin');
      expect(result.id).toBe('user-1');
    });

    it('should return empty roles when profileRoles is empty', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce({
        userId: 'user-2',
        displayName: 'Regular User',
        avatarUrl: null,
        accountStatus: 'ACTIVE',
        onboardingStatus: 'NOT_STARTED',
        onboardingStep: 0,
        profileRoles: [],
      });

      const result = await (service as any).buildUserResponse('user-2');
      expect(result.roles).toEqual([]);
    });

    it('should return null displayName when profile not found', async () => {
      mockPrismaDb.profile.findUnique.mockResolvedValueOnce(null);
      const result = await (service as any).buildUserResponse('user-3');
      expect(result.displayName).toBeNull();
      expect(result.roles).toEqual([]);
    });
  });

  // ── Password Recovery & OTP ───────────────────────────────────────────────

  describe('passwordResetRequest & confirm', () => {
    it('creates 6-digit OTP and returns neutral message with devOtp in non-prod', async () => {
      mockPrismaDb.account.findUnique.mockResolvedValueOnce({
        id: 'acc-1',
        userId: 'u-123',
        username: 'huytruong',
      });
      mockPrismaDb.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 });
      mockPrismaDb.passwordResetToken.create.mockResolvedValueOnce({ id: 'prt-1' });

      const res = await service.passwordResetRequest({ identifier: 'huytruong' });
      expect(res.message).toBeDefined();
      expect((res as any).devOtp).toMatch(/^\d{6}$/);
      expect(mockPrismaDb.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-123',
          }),
        }),
      );
    });

    it('confirms reset when OTP is valid and updates user password', async () => {
      mockPrismaDb.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: 'prt-1',
        userId: 'u-123',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      mockPrismaDb.passwordResetToken.update.mockResolvedValueOnce({ id: 'prt-1' });
      mockPrismaDb.account.findFirst.mockResolvedValueOnce({ id: 'acc-1' });
      mockPrismaDb.account.update.mockResolvedValueOnce({ id: 'acc-1' });
      mockPrismaDb.refreshSession.updateMany.mockResolvedValueOnce({ count: 2 });

      const res = await service.passwordResetConfirm({
        tokenOrOtp: '123456',
        newPassword: 'NewPassword@2026',
      });

      expect(res.message).toContain('thành công');
      expect(mockPrismaDb.passwordResetToken.update).toHaveBeenCalled();
      expect(mockPrismaDb.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mustChangePassword: false,
            failedLoginAttempts: 0,
          }),
        }),
      );
    });
  });
});
