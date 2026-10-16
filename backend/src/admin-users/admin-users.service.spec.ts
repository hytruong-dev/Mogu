import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

const userId = '22222222-2222-2222-2222-222222222222';
const actorId = '33333333-3333-3333-3333-333333333333';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  const db: any = {
    profile: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    accountRestriction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    refreshSession: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: { create: jest.fn() },
    emailVerificationToken: { create: jest.fn() },
    adminActionAudit: { create: jest.fn(), findMany: jest.fn() },
    adminExportJob: { create: jest.fn(), findFirst: jest.fn() },
    privacyJob: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    randomHistory: { count: jest.fn() },
    communityPost: { count: jest.fn() },
    profileRole: {
      upsert: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn) => (typeof fn === 'function' ? fn(db) : Promise.all(fn))),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: { db } },
      ],
    }).compile();
    service = module.get(AdminUsersService);
  });

  it('getSummary returns metrics', async () => {
    db.profile.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5);
    db.account.count.mockResolvedValue(12);

    const result = await service.getSummary({
      from: '2026-09-08',
      to: '2026-09-15',
      timezone: 'Asia/Ho_Chi_Minh',
    });

    expect(result.metrics.totalUsers).toBe(100);
    expect(result.metrics.newUsers).toBe(10);
    expect(result.metrics.activeUsersToday).toBe(12);
    expect(result.definitions.version).toBe('admin-user-metrics-v1');
  });

  it('getUser returns masked email and productSummary counts only', async () => {
    db.profile.findUnique.mockResolvedValue({
      userId,
      displayName: 'Huong',
      avatarUrl: null,
      accountStatus: AccountStatus.ACTIVE,
      onboardingStatus: 'COMPLETED',
      createdAt: new Date('2024-01-12'),
      profileVersion: 7,
      userGoals: [{ goal: { code: 'LOSE_WEIGHT', name: 'Giảm cân' } }],
      profileRoles: [{ role: 'USER' }],
      restrictions: [],
      _count: { savedDishes: 23, communityPosts: 4 },
    });
    db.account.findFirst.mockResolvedValue({
      id: 'acc-1',
      username: 'huonggiang',
      lastLoginAt: new Date('2026-09-15'),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    db.refreshSession.count.mockResolvedValue(2);
    db.randomHistory.count.mockResolvedValue(156);
    db.communityPost.count.mockResolvedValue(4);

    const result = await service.getUser(userId);

    expect(result.identity.emailMasked).toBe(true);
    expect(result.identity.email).toBe('huonggiang@masked');
    expect(result.productSummary).toEqual({
      onboardingStatus: 'COMPLETED',
      primaryGoal: { code: 'LOSE_WEIGHT', name: 'Giảm cân' },
      savedDishCount: 23,
      randomRunCount: 156,
      publishedPostCount: 4,
    });
    expect(result.productSummary).not.toHaveProperty('allergies');
    expect(result).not.toHaveProperty('weightKg');
  });

  it('requestPasswordReset creates token and does not return password', async () => {
    db.profile.findUnique.mockResolvedValue({ userId });
    db.passwordResetToken.create.mockResolvedValue({ id: 'tok' });
    db.account.findFirst.mockResolvedValue({ username: 'huonggiang' });
    db.adminActionAudit.create.mockResolvedValue({});

    const result = await service.requestPasswordReset(actorId, userId, {
      reasonCode: 'USER_REQUESTED_SUPPORT',
    });

    expect(result.status).toBe('QUEUED');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('token');
    expect(db.passwordResetToken.create).toHaveBeenCalled();
    expect(db.adminActionAudit.create).toHaveBeenCalled();
  });

  it('createUser provisions account and profile and writes audit', async () => {
    db.account.findUnique.mockResolvedValue(null);
    db.profile.create.mockResolvedValue({ id: 'prof-new' });
    db.account.create.mockResolvedValue({ id: 'acc-new' });
    db.profileRole.create.mockResolvedValue({});
    db.adminActionAudit.create.mockResolvedValue({});

    const res = await service.createUser(actorId, {
      username: 'reviewer_test',
      email: 'reviewer@mogu.vn',
      displayName: 'Reviewer Test',
      role: 'REVIEWER' as any,
    });

    expect(res.username).toBe('reviewer_test');
    expect(res.role).toBe('REVIEWER');
    expect(res.temporaryPassword).toBeDefined();
    expect(res.mustChangePassword).toBe(true);
    expect(db.profile.create).toHaveBeenCalled();
    expect(db.account.create).toHaveBeenCalled();
    expect(db.profileRole.create).toHaveBeenCalled();
    expect(db.adminActionAudit.create).toHaveBeenCalled();
  });

  it('directPasswordReset sets mustChangePassword and revokes sessions', async () => {
    db.profile.findUnique.mockResolvedValue({ userId });
    db.account.findFirst.mockResolvedValue({ id: 'acc-1' });
    db.account.update.mockResolvedValue({ id: 'acc-1' });
    db.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    db.adminActionAudit.create.mockResolvedValue({});

    const res = await service.directPasswordReset(actorId, userId, {
      temporaryPassword: 'Temp@Password123',
      reasonCode: 'HOTLINE',
    });

    expect(res.status).toBe('SUCCESS');
    expect(res.temporaryPassword).toBe('Temp@Password123');
    expect(res.mustChangePassword).toBe(true);
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mustChangePassword: true,
          failedLoginAttempts: 0,
        }),
      }),
    );
    expect(db.refreshSession.updateMany).toHaveBeenCalled();
    expect(db.adminActionAudit.create).toHaveBeenCalled();
  });
});
