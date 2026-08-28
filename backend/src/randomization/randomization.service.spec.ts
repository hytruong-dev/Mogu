import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-import/ai.service';
import { RandomizationService } from './randomization.service';

const makeDish = (id: string, overrides?: any) => ({
  id,
  name: `Dish ${id}`,
  slug: `dish-${id}`,
  isFeatured: false,
  publishedAt: new Date(),
  prepMinutes: 30,
  priceMin: 50000,
  priceMax: 80000,
  region: { name: 'Miền Bắc' },
  dishGoals: [],
  mealTypes: [],
  nutritionProfiles: [],
  media: [],
  savedByUsers: [],
  ...overrides,
});

const mockPrisma = {
  db: {
    profile: {
      findUnique: jest.fn(),
    },
    dish: {
      findMany: jest.fn(),
    },
    randomHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
};

describe('RandomizationService', () => {
  let service: RandomizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RandomizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: { generateCompletion: jest.fn() } },
      ],
    }).compile();

    service = module.get<RandomizationService>(RandomizationService);
    jest.clearAllMocks();
  });

  it('NotFoundException khi profile không tồn tại', async () => {
    mockPrisma.db.profile.findUnique.mockResolvedValue(null);

    await expect(
      service.randomize('nonexistent-user', { goalCodes: ['HEALTHY'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('AT-07: User dị ứng hải sản — kết quả không chứa món CONTAINS SEAFOOD', async () => {
    mockPrisma.db.profile.findUnique.mockResolvedValue({
      userId: 'user1',
      userAllergens: [{ allergen: { code: 'SEAFOOD' } }],
      userDietaryPreferences: [],
      userAvoidedIngredients: [],
      userDietTypes: [],
    });
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    // Dish DB query phải exclude SEAFOOD CONTAINS
    mockPrisma.db.dish.findMany.mockResolvedValue([
      makeDish('safe-dish'),
    ]);
    mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });

    const result = await service.randomize('user1', { goalCodes: ['HEALTHY'] });

    // Kiểm tra query đúng — allergen WHERE phải có
    const findManyCall = mockPrisma.db.dish.findMany.mock.calls[0][0];
    expect(findManyCall.where.dishAllergens?.none).toBeDefined();
    expect(findManyCall.where.dishAllergens.none.level).toBe('CONTAINS');

    expect(result.dish).toBeTruthy();
    expect((result.dish as any).id).toBe('safe-dish');
  });

  it('AT-08: Không có candidates → trả relaxableCriteria, không nới allergen', async () => {
    mockPrisma.db.profile.findUnique.mockResolvedValue({
      userId: 'user1',
      userAllergens: [{ allergen: { code: 'PEANUT' } }],
      userDietaryPreferences: [],
      userAvoidedIngredients: [],
      userDietTypes: [],
    });
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    mockPrisma.db.dish.findMany.mockResolvedValue([]);

    const result = await service.randomize('user1', { mealTypeCode: 'LUNCH' });

    expect(result.dish).toBeNull();
    expect((result as any).explanation?.relaxableCriteria).toContain('mealType');
    // Allergen KHÔNG trong relaxable criteria
    expect((result as any).explanation?.relaxableCriteria).not.toContain('allergen');
  });

  it('Meal type filter được pass vào where clause', async () => {
    mockPrisma.db.profile.findUnique.mockResolvedValue({
      userId: 'user1',
      userAllergens: [],
      userDietaryPreferences: [],
      userAvoidedIngredients: [],
      userDietTypes: [],
    });
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);
    mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });

    await service.randomize('user1', { mealTypeCode: 'BREAKFAST' });

    const whereClause = mockPrisma.db.dish.findMany.mock.calls[0][0].where;
    expect(whereClause.mealTypes?.some?.mealTypeTag?.code?.in).toContain('BREAKFAST');
  });

  it('Budget filter được áp dụng', async () => {
    mockPrisma.db.profile.findUnique.mockResolvedValue({
      userId: 'user1',
      userAllergens: [],
      userDietaryPreferences: [],
      userAvoidedIngredients: [],
      userDietTypes: [],
    });
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);
    mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });

    await service.randomize('user1', { maxBudget: 50000 });

    const whereClause = mockPrisma.db.dish.findMany.mock.calls[0][0].where;
    expect(whereClause.priceMin?.lte).toBe(50000);
  });
});
