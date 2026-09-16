import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService masking & cursor', () => {
  const prisma = {
    db: {
      profile: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      account: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      adminActionAudit: { create: jest.fn() },
      refreshSession: { count: jest.fn() },
      randomHistory: { count: jest.fn() },
      communityPost: { count: jest.fn() },
    },
  } as any;

  const service = new AdminUsersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getSummary returns metrics without inventing comparison', async () => {
    prisma.db.profile.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.db.account.count.mockResolvedValueOnce(3);

    const result = await service.getSummary({});
    expect(result.metrics.totalUsers).toBe(10);
    expect(result.metrics.newUsers).toBe(2);
    expect(result.metrics.activeUsersToday).toBe(3);
    expect(result.comparison).toBeNull();
  });

  it('listUsers masks email and omits health fields', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.db.profile.findMany.mockResolvedValue([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'Test User',
        avatarUrl: null,
        accountStatus: 'ACTIVE',
        createdAt,
        profileVersion: 1,
        userGoals: [{ goal: { code: 'BALANCED', name: 'Ăn cân bằng' } }],
        restrictions: [],
        profileRoles: [],
      },
    ]);
    prisma.db.account.findMany.mockResolvedValue([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        passwordHash: '11111111-1111-1111-1111-111111111111',
        username: 'testuser',
        usernameNormalized: 'testuser',
        lastLoginAt: null,
      },
    ]);

    const result = await service.listUsers({ limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe('testuser@masked');
    expect(result.items[0].emailMasked).toBe(true);
    expect(result.items[0]).not.toHaveProperty('allergens');
    expect(result.items[0]).not.toHaveProperty('savedDishes');
  });
});
