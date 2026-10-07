import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsTargetsService } from '../health/measurements-targets.service';

const userId = '11111111-1111-1111-1111-111111111111';

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  id: 'profile-1',
  userId,
  displayName: 'Huy',
  avatarUrl: null,
  bio: null,
  regionId: null,
  avatarMediaId: null,
  activityLevel: null,
  locale: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  gender: 'MALE',
  dateOfBirth: new Date('2000-01-01'),
  heightCm: 170,
  weightKg: 65,
  noAllergies: false,
  onboardingStatus: 'COMPLETED',
  profileVersion: 3,
  updatedAt: new Date('2026-09-14T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('ProfileService dashboard + journey', () => {
  let service: ProfileService;
  const recalculateHealthTarget = jest.fn();
  const db: any = {
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userGoal: { findFirst: jest.fn(), findMany: jest.fn() },
    communityPost: { count: jest.fn() },
    profileMeasurement: { create: jest.fn(), findFirst: jest.fn() },
    healthTarget: { findFirst: jest.fn() },
    selectionPriorityCatalog: { findMany: jest.fn() },
    savedDish: { count: jest.fn() },
    userFollow: { count: jest.fn() },
    randomHistory: { count: jest.fn() },
    diaryMealLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    diaryMealLogItem: { findMany: jest.fn() },
    notification: { count: jest.fn() },
    waterLog: { findMany: jest.fn() },
    achievementDefinition: { findMany: jest.fn() },
    userAchievement: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    userDietaryPreference: { findMany: jest.fn() },
    userAllergen: { findMany: jest.fn() },
    userAvoidedIngredient: { findMany: jest.fn() },
    userSelectionPriority: { findMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    region: { findUnique: jest.fn() },
    $transaction: jest.fn((fn) => (typeof fn === 'function' ? fn(db) : Promise.all(fn))),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: { db } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MeasurementsTargetsService, useValue: { recalculateHealthTarget } },
      ],
    }).compile();
    service = module.get(ProfileService);
  });

  it('getProfileDashboard returns identity + counters without health fields', async () => {
    db.profile.findUnique.mockResolvedValue(makeProfile());
    db.account.findFirst.mockResolvedValue({ username: 'huytruong' });
    db.userGoal.findFirst.mockResolvedValue({
      goal: { id: 'g1', code: 'BALANCE', name: 'Ăn cân bằng' },
    });
    db.communityPost.count.mockImplementation(async (args: any) => (args?.where?.status === 'DRAFT' ? 4 : 24));
    db.savedDish.count.mockResolvedValue(128);
    db.userFollow.count.mockImplementation(async (args: any) => (args?.where?.followerId ? 7 : 18));
    db.randomHistory.count.mockResolvedValue(24);
    db.diaryMealLog.count.mockResolvedValue(36);
    db.notification.count.mockResolvedValue(3);
    db.diaryMealLog.findMany.mockResolvedValue([
      { localDate: new Date('2026-09-14') },
      { localDate: new Date('2026-09-13') },
    ]);
    db.diaryMealLogItem.findMany.mockResolvedValue([
      { referenceId: 'd1' },
      { referenceId: 'd2' },
    ]);

    const result = await service.getProfileDashboard(userId, {
      localDate: '2026-09-14',
      timezone: 'Asia/Ho_Chi_Minh',
    });

    expect(result.profile.username).toBe('huytruong');
    expect(result.socialStats.publishedPostCount).toBe(24);
    expect(result.socialStats.savedDishCount).toBe(128);
    expect(result.socialStats.followerCount).toBe(18);
    expect(result.socialStats.followingCount).toBe(7);
    expect(result.socialStats.draftPostCount).toBe(4);
    expect(result.shortcuts.myDraftPosts).toBe(4);
    expect(result.journeyPreview.mealsLoggedThisMonth).toBe(36);
    expect(result.notificationUnreadCount).toBe(3);
    expect(result).not.toHaveProperty('dateOfBirth');
    expect(result.profile).not.toHaveProperty('weightKg');
  });

  it('getJourney fills days[] for the month and scopes totals', async () => {
    db.profile.findUnique.mockResolvedValue(makeProfile());
    db.diaryMealLog.findMany.mockImplementation(async (args: any) => {
      if (args?.distinct) {
        return [{ localDate: new Date('2026-09-01') }];
      }
      return [
        { localDate: new Date('2026-09-01') },
        { localDate: new Date('2026-09-01') },
        { localDate: new Date('2026-09-02') },
      ];
    });
    db.waterLog.findMany.mockResolvedValue([
      { amountMl: 500, localDate: new Date('2026-09-01') },
    ]);
    db.diaryMealLogItem.findMany.mockResolvedValue([{ referenceId: 'd1' }]);
    db.achievementDefinition.findMany.mockResolvedValue([]);
    db.userAchievement.findMany.mockResolvedValue([]);

    const result = await service.getJourney(userId, '2026-09', 'Asia/Ho_Chi_Minh');

    expect(result.month).toBe('2026-09');
    expect(result.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(result.days).toHaveLength(30);
    expect(result.days[0]).toMatchObject({
      localDate: '2026-09-01',
      status: 'QUALIFIED',
      mealLogCount: 2,
    });
    expect(result.totals.mealsLogged).toBe(3);
    expect(result.totals.waterMl).toBe(500);
  });
});

describe('ProfileService updateHealth + selection priorities', () => {
  let service: ProfileService;
  const recalc = jest.fn();
  const db: any = {
    profile: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    profileMeasurement: { create: jest.fn(), findFirst: jest.fn() },
    healthTarget: { findFirst: jest.fn() },
    selectionPriorityCatalog: { findMany: jest.fn() },
    userSelectionPriority: { findMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(db)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: { db } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MeasurementsTargetsService, useValue: { recalculateHealthTarget: recalc } },
      ],
    }).compile();
    service = module.get(ProfileService);
  });

  it('updateHealth writes measurements, recalculates targets and returns healthProfile', async () => {
    db.profile.findUnique.mockImplementation(async (args: any) => {
      if (args?.select?.targetWeightKg) {
        return { heightCm: 172, weightKg: 70, targetWeightKg: 65, activityLevel: 'ACTIVE', profileVersion: 4, updatedAt: new Date() };
      }
      if (args?.select?.profileVersion && Object.keys(args.select).length === 1) return { profileVersion: 3 };
      return makeProfile({ profileVersion: 3, heightCm: 170, weightKg: 65 });
    });
    db.profile.updateMany.mockResolvedValue({ count: 1 });
    db.profileMeasurement.findFirst.mockResolvedValue(null);
    db.healthTarget.findFirst.mockResolvedValue(null);
    recalc.mockResolvedValue({ status: 'READY' });

    const result = await service.updateHealth(
      userId,
      { heightCm: 172, weightKg: 70, targetWeightKg: 65, activityLevel: 'ACTIVE' } as any,
      '3',
    );

    expect(db.profileMeasurement.create).toHaveBeenCalledTimes(2);
    expect(db.profile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetWeightKg: 65, activityLevel: 'ACTIVE' }),
      }),
    );
    expect(recalc).toHaveBeenCalledWith(userId);
    expect(result.targetStatus).toBe('READY');
    expect(result.profileVersion).toBe(4);
    expect(result.healthProfile).toBeDefined();
  });

  it('updateHealth throws 412 when the version is stale', async () => {
    db.profile.findUnique.mockResolvedValue(makeProfile({ profileVersion: 5 }));
    await expect(service.updateHealth(userId, { heightCm: 170 } as any, '3')).rejects.toMatchObject({
      status: 412,
    });
    expect(db.profile.updateMany).not.toHaveBeenCalled();
  });

  it('putSelectionPriorities replaces rows, bumps version and rejects unknown codes', async () => {
    db.profile.findUnique.mockResolvedValue(makeProfile());
    db.selectionPriorityCatalog.findMany.mockResolvedValue([{ code: 'HEALTHY' }, { code: 'QUICK' }]);
    db.profile.update.mockResolvedValue({ profileVersion: 4 });
    db.userSelectionPriority.findMany.mockResolvedValue([{ code: 'HEALTHY', weight: 0.8 }]);

    const ok = await service.putSelectionPriorities(userId, [
      { code: 'HEALTHY', weight: 0.8 },
      { code: 'QUICK', weight: 0.2 },
    ]);
    expect(db.userSelectionPriority.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(db.userSelectionPriority.create).toHaveBeenCalledTimes(2);
    expect(ok.profileVersion).toBe(4);

    await expect(
      service.putSelectionPriorities(userId, [{ code: 'NOPE', weight: 0.5 }]),
    ).rejects.toMatchObject({ status: 400 });
  });
});