import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai-import/ai.service';
import { DishEligibilityService } from '../dishes/eligibility/dish-eligibility.service';
import { MealLogsService } from '../health/meal-logs.service';
import {
  buildRadiusCascade,
  proximityScore,
  RandomizationService,
  resolveStrictRadiusKm,
} from './randomization.service';
import { LocationModeEnum, MealSlotEnum } from './dto/randomization.dto';
import { aggregateNearbyDishes, PlacesService, type NearbyDishStat } from '../places/places.service';

const mockPlaces = {
  findNearbyDishPlaceRows: jest.fn(),
  findNearbyPlacesForDish: jest.fn(),
  ensureAreaCoverage: jest.fn(),
  countPlacesWithin: jest.fn(),
};

const stat = (partial: Partial<NearbyDishStat> & Pick<NearbyDishStat, 'placeCount' | 'nearestMeters'>): NearbyDishStat => ({
  openCount: 0,
  bestRating: null,
  hasConfirmed: false,
  priceMin: null,
  priceMax: null,
  pricedPlaceCount: 0,
  ...partial,
});

const emptyProfile = {
  userId: 'user1',
  userAllergens: [],
  userDietaryPreferences: [],
  userAvoidedIngredients: [],
  userDietTypes: [],
};

/** Ids restricted by the nearby filter (`{ id: { in: [...] } }`) in a dish.findMany call. */
const nearbyIdsOf = (call: any): string[] | undefined =>
  flattenAnd(call?.[0]?.where).find((c: any) => Array.isArray(c?.id?.in))?.id.in;

const makeDish = (id: string, overrides?: any) => ({
  id,
  name: `Dish ${id}`,
  slug: `dish-${id}`,
  isFeatured: false,
  publishedAt: new Date(),
  prepMinutes: 30,
  priceMin: 50000,
  priceMax: 80000,
  dineOutPriceMin: 35000,
  dineOutPriceMax: 45000,
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
      findUnique: jest.fn(),
    },
    randomHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
};

const flattenAnd = (where: any): any[] => {
  if (!where) return [];
  if (Array.isArray(where.AND)) {
    return where.AND.flatMap(flattenAnd);
  }
  return [where];
};

describe('RandomizationService', () => {
  let service: RandomizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RandomizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlacesService, useValue: mockPlaces },
        { provide: AiService, useValue: { generateCompletion: jest.fn() } },
        DishEligibilityService,
        {
          provide: MealLogsService,
          useValue: {
            getRecentLoggedDishIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<RandomizationService>(RandomizationService);
    jest.clearAllMocks();
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    mockPrisma.db.dish.findUnique.mockImplementation(({ where }: any) => Promise.resolve(makeDish(where.id)));
    mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([]);
    mockPlaces.findNearbyPlacesForDish.mockResolvedValue([]);
    mockPlaces.ensureAreaCoverage.mockResolvedValue({ status: 'HIT', source: null, placeCount: 0, linkCount: 0 });
    mockPlaces.countPlacesWithin.mockResolvedValue(0);
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

    const result = await service.randomize('user1', {
      goalCodes: ['HEALTHY'],
      runtimeOverrides: { locationMode: LocationModeEnum.OFF },
    });

    // Kiểm tra query đúng — allergen WHERE phải có
    const findManyCall = mockPrisma.db.dish.findMany.mock.calls[0][0];
    const andClauses = flattenAnd(findManyCall.where);
    const allergenClause = andClauses.find((c: any) => c.dishAllergens?.none);
    expect(allergenClause).toBeDefined();
    expect(allergenClause.dishAllergens.none.level).toEqual({ in: ['CONTAINS'] });

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

    const result = await service.randomize('user1', {
      mealTypeCode: 'LUNCH',
      runtimeOverrides: { locationMode: LocationModeEnum.OFF },
    });

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

    await service.randomize('user1', {
      mealTypeCode: 'BREAKFAST',
      runtimeOverrides: { locationMode: LocationModeEnum.OFF },
    });

    const whereClause = mockPrisma.db.dish.findMany.mock.calls[0][0].where;
    const andClauses = flattenAnd(whereClause);
    const mealClause = andClauses.find((c: any) => c.mealTypes?.some?.mealTypeTag?.code?.in);
    expect(mealClause?.mealTypes?.some?.mealTypeTag?.code?.in).toContain('BREAKFAST');
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

    await service.randomize('user1', {
      maxBudget: 50000,
      runtimeOverrides: { locationMode: LocationModeEnum.OFF },
    });

    const whereClause = mockPrisma.db.dish.findMany.mock.calls[0][0].where;
    const andClauses = flattenAnd(whereClause);
    const priceClause = andClauses.find((c: any) => c.dineOutPriceMin?.lte !== undefined);
    expect(priceClause?.dineOutPriceMin?.lte).toBe(50000);
  });

  describe('Random theo vị trí — STRICT (mặc định): ràng buộc cứng bán kính', () => {
    const location = { latitude: 10.7769, longitude: 106.7009 };

    beforeEach(() => {
      mockPrisma.db.profile.findUnique.mockResolvedValue(emptyProfile);
      mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });
    });

    it('Không gửi location với RANDOM_FLOW → trả LOCATION_REQUIRED (ràng buộc cứng GPS)', async () => {
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);

      const result: any = await service.randomize('user1', {});

      expect(mockPlaces.findNearbyDishPlaceRows).not.toHaveBeenCalled();
      expect(mockPlaces.ensureAreaCoverage).not.toHaveBeenCalled();
      expect(result.dish).toBeNull();
      expect(result.explanation?.failReasonCode).toBe('LOCATION_REQUIRED');
    });

    it('Có món trong 3km → warm-up khu vực, chỉ random trong các món đó', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
        { dishId: 'near', placeId: 'p1', distanceMeters: 800, openStatus: 'OPEN' },
        { dishId: 'far', placeId: 'p2', distanceMeters: 8000 },
      ]);
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('near')]);

      const result: any = await service.randomize('user1', {
        location,
        runtimeOverrides: { radiusKm: 3 },
      } as any);

      expect(mockPlaces.ensureAreaCoverage).toHaveBeenCalledWith(location.latitude, location.longitude, 3000);
      // STRICT: chỉ query đúng 3km, không lấy tới 10km
      expect(mockPlaces.findNearbyDishPlaceRows).toHaveBeenCalledWith(location.latitude, location.longitude, 3000);
      expect(nearbyIdsOf(mockPrisma.db.dish.findMany.mock.calls[0])).toEqual(['near']);
      expect(result.dish?.id).toBe('near');
      expect(result.nearby?.mode).toBe('STRICT');
      expect(result.nearby?.radiusKm).toBe(3);
      expect(result.nearby?.placeCount).toBe(1);
      expect(result.nearby?.openCount).toBe(1);
      expect(result.nearby?.fallback).toBe(false);
      expect(result.explanation?.fallbackApplied ?? []).not.toContain('radius');
      expect(result.explanation?.fallbackApplied ?? []).not.toContain('nearby');
    });

    it('Không có món trong 3km → KHÔNG mở rộng, KHÔNG random toàn cục, trả NO_NEARBY_DISH', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
        { dishId: 'mid', placeId: 'p1', distanceMeters: 4200 },
      ]);
      mockPlaces.countPlacesWithin.mockResolvedValue(2);
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('mid')]);

      const result: any = await service.randomize('user1', { location } as any);

      // Hàng 4.2km nằm ngoài 3km nên bị loại ngay từ aggregate → không query dish nào
      expect(mockPrisma.db.dish.findMany).not.toHaveBeenCalled();
      expect(result.dish).toBeNull();
      expect(result.explanation?.failReasonCode).toBe('NO_NEARBY_DISH');
      expect(result.explanation?.relaxableCriteria).not.toContain('radius');
      expect(result.nearby?.mode).toBe('STRICT');
      expect(result.nearby?.radiusKm).toBeNull();
      expect(result.nearby?.placeCount).toBe(2);
      expect(result.nearby?.dishCountInRadius).toBe(0);
      expect(result.explanation?.summary).toMatch(/3km/);
      expect(mockPrisma.db.randomHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NO_CANDIDATE', failReasonCode: 'NO_NEARBY_DISH' }),
        }),
      );
    });

    it('Có món trong 3km nhưng không hợp hồ sơ ở mọi mức soft → NO_NEARBY_DISH, không bỏ ràng buộc vị trí', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
        { dishId: 'near', placeId: 'p1', distanceMeters: 500 },
      ]);
      mockPrisma.db.dish.findMany.mockImplementation(async (args: any) =>
        nearbyIdsOf([args]) ? [] : [makeDish('global')],
      );

      const result: any = await service.randomize('user1', { location } as any);

      expect(result.dish).toBeNull();
      expect(result.explanation?.failReasonCode).toBe('NO_NEARBY_DISH');
      expect(result.nearby?.dishCountInRadius).toBe(1);
      // Mọi call đều có lọc id — không call nào là global
      for (const call of mockPrisma.db.dish.findMany.mock.calls) {
        expect(nearbyIdsOf(call)).toEqual(['near']);
      }
      expect(result.explanation?.relaxableCriteria).toEqual(['mealType', 'budget', 'dietType', 'excludeList']);
    });

    it('Lookup quán gần lỗi → NEARBY_LOOKUP_FAILED, không random bừa', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockRejectedValue(new Error('db down'));
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);

      const result: any = await service.randomize('user1', { location } as any);
      expect(result.dish).toBeNull();
      expect(result.explanation?.failReasonCode).toBe('NEARBY_LOOKUP_FAILED');
      expect(mockPrisma.db.dish.findMany).not.toHaveBeenCalled();
    });

    it('Warm-up TIMEOUT vẫn tiếp tục với dữ liệu DB sẵn có', async () => {
      mockPlaces.ensureAreaCoverage.mockResolvedValue({ status: 'TIMEOUT', source: null, placeCount: 0, linkCount: 0 });
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
        { dishId: 'near', placeId: 'p1', distanceMeters: 1200 },
      ]);
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('near')]);

      const result: any = await service.randomize('user1', { location } as any);
      expect(result.dish?.id).toBe('near');
      expect(result.nearby?.warmup).toBe('TIMEOUT');
    });

    it('locationMode=OFF → bỏ qua vị trí hoàn toàn', async () => {
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);

      const result: any = await service.randomize('user1', {
        location,
        runtimeOverrides: { locationMode: 'OFF' },
      } as any);

      expect(mockPlaces.ensureAreaCoverage).not.toHaveBeenCalled();
      expect(mockPlaces.findNearbyDishPlaceRows).not.toHaveBeenCalled();
      expect(result.dish?.id).toBe('d1');
      expect(result.nearby ?? null).toBeNull();
    });
  });

  describe('Random theo vị trí — PREFER (cascade cũ, dùng cho weekly plan)', () => {
    const location = { latitude: 10.7769, longitude: 106.7009 };
    const prefer = { location, runtimeOverrides: { locationMode: 'PREFER' } } as any;

    beforeEach(() => {
      mockPrisma.db.profile.findUnique.mockResolvedValue(emptyProfile);
      mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });
    });

    it('Không gọi warm-up (đã có fallback toàn cục)', async () => {
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('any')]);
      await service.randomize('user1', prefer);
      expect(mockPlaces.ensureAreaCoverage).not.toHaveBeenCalled();
      expect(mockPlaces.findNearbyDishPlaceRows).toHaveBeenCalledWith(location.latitude, location.longitude, 10_000);
    });

    it('Không có món trong 3km → mở rộng 5km và đánh dấu fallback "radius"', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
        { dishId: 'mid', placeId: 'p1', distanceMeters: 4200 },
      ]);
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('mid')]);

      const result: any = await service.randomize('user1', prefer);

      expect(nearbyIdsOf(mockPrisma.db.dish.findMany.mock.calls[0])).toEqual(['mid']);
      expect(result.nearby?.mode).toBe('PREFER');
      expect(result.nearby?.radiusKm).toBe(5);
      expect(result.explanation?.fallbackApplied).toContain('radius');
    });

    it('Không có quán nào trong 10km → random toàn bộ món và đánh dấu fallback "nearby"', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([]);
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('any')]);

      const result: any = await service.randomize('user1', prefer);

      expect(nearbyIdsOf(mockPrisma.db.dish.findMany.mock.calls[0])).toBeUndefined();
      expect(result.dish?.id).toBe('any');
      expect(result.nearby?.fallback).toBe(true);
      expect(result.explanation?.fallbackApplied).toContain('nearby');
    });

    it('Lookup quán gần lỗi → vẫn random bình thường', async () => {
      mockPlaces.findNearbyDishPlaceRows.mockRejectedValue(new Error('db down'));
      mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);

      const result: any = await service.randomize('user1', prefer);
      expect(result.dish?.id).toBe('d1');
    });
  });
});

describe('resolveStrictRadiusKm', () => {
  it('mặc định 3km, chặn tối đa 20km, không mở rộng', () => {
    expect(resolveStrictRadiusKm()).toBe(3);
    expect(resolveStrictRadiusKm(0)).toBe(3);
    expect(resolveStrictRadiusKm(1.5)).toBe(1.5);
    expect(resolveStrictRadiusKm(50)).toBe(20);
  });
});

describe('buildRadiusCascade', () => {
  it('mặc định 3 → 5 → 10km', () => {
    expect(buildRadiusCascade()).toEqual([3, 5, 10]);
    expect(buildRadiusCascade(0)).toEqual([3, 5, 10]);
    expect(buildRadiusCascade(Number.NaN)).toEqual([3, 5, 10]);
  });

  it('bắt đầu từ bán kính yêu cầu và chỉ mở rộng ra các mốc lớn hơn', () => {
    expect(buildRadiusCascade(1)).toEqual([1, 3, 5, 10]);
    expect(buildRadiusCascade(5)).toEqual([5, 10]);
    expect(buildRadiusCascade(7)).toEqual([7, 10]);
  });

  it('bán kính lớn bị chặn ở mức tối đa', () => {
    expect(buildRadiusCascade(50)).toEqual([20]);
  });
});

describe('proximityScore', () => {
  it('không có vị trí → điểm trung tính 5', () => {
    expect(proximityScore(undefined, false)).toBe(5);
  });

  it('có vị trí nhưng món không bán gần → 0', () => {
    expect(proximityScore(undefined, true)).toBe(0);
  });

  it('chấm theo khoảng cách quán gần nhất', () => {
    expect(proximityScore(stat({ placeCount: 1, nearestMeters: 500 }), true)).toBe(7);
    expect(proximityScore(stat({ placeCount: 1, nearestMeters: 2000 }), true)).toBe(5);
    expect(proximityScore(stat({ placeCount: 1, nearestMeters: 4000 }), true)).toBe(3);
    expect(proximityScore(stat({ placeCount: 1, nearestMeters: 8000 }), true)).toBe(1);
  });

  it('+1 khi có >= 3 quán, +1 khi có quán đang mở, +1 khi rating >= 4 hoặc CONFIRMED; tối đa 10', () => {
    expect(proximityScore(stat({ placeCount: 3, nearestMeters: 2000 }), true)).toBe(6);
    expect(proximityScore(stat({ placeCount: 3, nearestMeters: 2000, openCount: 1 }), true)).toBe(7);
    expect(proximityScore(stat({ placeCount: 3, nearestMeters: 2000, openCount: 1, bestRating: 4.3 }), true)).toBe(8);
    expect(proximityScore(stat({ placeCount: 1, nearestMeters: 2000, hasConfirmed: true }), true)).toBe(6);
    expect(
      proximityScore(stat({ placeCount: 5, nearestMeters: 500, openCount: 2, bestRating: 4.5 }), true),
    ).toBe(10);
  });

  it('món gần xếp hạng cao hơn món xa', () => {
    const near = proximityScore(stat({ placeCount: 2, nearestMeters: 600 }), true);
    const far = proximityScore(stat({ placeCount: 2, nearestMeters: 6000 }), true);
    expect(near).toBeGreaterThan(far);
  });

  it('quán đang mở xếp hạng cao hơn quán đóng cùng khoảng cách', () => {
    const open = proximityScore(stat({ placeCount: 1, nearestMeters: 800, openCount: 1 }), true);
    const closed = proximityScore(stat({ placeCount: 1, nearestMeters: 800, openCount: 0 }), true);
    expect(open).toBeGreaterThan(closed);
  });
});

describe('aggregateNearbyDishes', () => {
  const rows = [
    { dishId: 'a', placeId: 'p1', distanceMeters: 900, openStatus: 'OPEN' as const, ratingAvg: 4.2, matchStatus: 'LIKELY' as const },
    { dishId: 'a', placeId: 'p2', distanceMeters: 2500, openStatus: 'CLOSED' as const, ratingAvg: 3.5, matchStatus: 'CONFIRMED' as const },
    { dishId: 'a', placeId: 'p2', distanceMeters: 2500, openStatus: 'CLOSED' as const }, // trùng quán
    { dishId: 'b', placeId: 'p3', distanceMeters: 4500 },
  ];

  it('đếm số quán duy nhất + quán gần nhất + số quán mở + rating tốt nhất + CONFIRMED trong bán kính', () => {
    const stats = aggregateNearbyDishes(rows, 3000);
    expect(stats.get('a')).toEqual({
      placeCount: 2,
      nearestMeters: 900,
      openCount: 1,
      bestRating: 4.2,
      hasConfirmed: true,
      priceMin: null,
      priceMax: null,
      pricedPlaceCount: 0,
    });
    expect(stats.has('b')).toBe(false);
  });

  it('bán kính lớn hơn bao gồm thêm món', () => {
    const stats = aggregateNearbyDishes(rows, 5000);
    expect(stats.get('b')).toEqual({
      placeCount: 1,
      nearestMeters: 4500,
      openCount: 0,
      bestRating: null,
      hasConfirmed: false,
      priceMin: null,
      priceMax: null,
      pricedPlaceCount: 0,
    });
  });

  it('tổng hợp giá quán p25..p75 chính xác khi có thông tin giá', () => {
    const pricedRows = [
      { dishId: 'd', placeId: 'p1', distanceMeters: 500, placePriceMin: 20000, placePriceMax: 40000 },
      { dishId: 'd', placeId: 'p2', distanceMeters: 1000, placePriceMin: 30000, placePriceMax: 50000 },
      { dishId: 'd', placeId: 'p3', distanceMeters: 1500, dishPriceVnd: 35000 },
    ];
    const stats = aggregateNearbyDishes(pricedRows as any, 2000);
    const dStat = stats.get('d');
    expect(dStat).toBeDefined();
    expect(dStat?.pricedPlaceCount).toBe(3);
    expect(dStat?.priceMin).toBeGreaterThanOrEqual(20000);
    expect(dStat?.priceMax).toBeLessThanOrEqual(50000);
  });
});

describe('Tối ưu hiệu năng: In-memory cascade & Non-blocking AI', () => {
  let service: RandomizationService;
  let aiService: any;
  const location = { latitude: 10.7769, longitude: 106.7009 };

  beforeEach(async () => {
    aiService = { generateCompletion: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RandomizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlacesService, useValue: mockPlaces },
        { provide: AiService, useValue: aiService },
        DishEligibilityService,
        {
          provide: MealLogsService,
          useValue: {
            getRecentLoggedDishIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<RandomizationService>(RandomizationService);
    jest.clearAllMocks();
    mockPrisma.db.profile.findUnique.mockResolvedValue(emptyProfile);
    mockPrisma.db.randomHistory.findMany.mockResolvedValue([]);
    mockPrisma.db.randomHistory.create.mockResolvedValue({ id: 'rh1' });
    mockPrisma.db.dish.findUnique.mockImplementation(({ where }: any) => Promise.resolve(makeDish(where.id)));
    mockPlaces.findNearbyPlacesForDish.mockResolvedValue([]);
    mockPlaces.ensureAreaCoverage.mockResolvedValue({ status: 'HIT', source: null, placeCount: 0, linkCount: 0 });
  });

  it('In-memory cascade: khi có quán gần, dish.findMany chỉ được gọi ĐÚNG 1 LẦN', async () => {
    mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
      { dishId: 'd-lunch', placeId: 'p1', distanceMeters: 800, openStatus: 'OPEN' },
      { dishId: 'd-dinner', placeId: 'p2', distanceMeters: 900, openStatus: 'OPEN' },
    ]);

    // Giả lập pool ứng viên tải về: d-dinner không hợp bữa trưa, d-lunch hợp bữa trưa
    mockPrisma.db.dish.findMany.mockResolvedValue([
      makeDish('d-dinner', {
        mealTypes: [{ mealTypeTag: { code: 'DINNER', name: 'Bữa tối' } }],
      }),
      makeDish('d-lunch', {
        mealTypes: [{ mealTypeTag: { code: 'LUNCH', name: 'Bữa trưa' } }],
      }),
    ]);

    const result = await service.randomize('user1', {
      location,
      meal: { slot: MealSlotEnum.LUNCH },
      runtimeOverrides: { radiusKm: 3 },
    } as any);

    // Chỉ gọi đúng 1 lần cho toàn bộ pool ứng viên quán gần
    expect(mockPrisma.db.dish.findMany).toHaveBeenCalledTimes(1);
    expect(result.dish?.id).toBe('d-lunch');
  });

  it('In-memory cascade nới lỏng mealType khi không có món khớp mức 0', async () => {
    mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
      { dishId: 'd-snack', placeId: 'p1', distanceMeters: 800, openStatus: 'OPEN' },
    ]);

    // Chỉ có món SNACK, yêu cầu LUNCH -> cascade qua level 1 sẽ chọn được d-snack và đánh dấu meal_type
    mockPrisma.db.dish.findMany.mockResolvedValue([
      makeDish('d-snack', {
        mealTypes: [{ mealTypeTag: { code: 'SNACK', name: 'Bữa phụ' } }],
      }),
    ]);

    const result = await service.randomize('user1', {
      location,
      meal: { slot: MealSlotEnum.LUNCH },
      runtimeOverrides: { radiusKm: 3 },
    } as any);

    expect(mockPrisma.db.dish.findMany).toHaveBeenCalledTimes(1);
    expect(result.dish?.id).toBe('d-snack');
    expect(result.explanation?.fallbackApplied).toContain('meal_type');
  });

  it('AI explanation không chặn phản hồi randomize (trả về ngay với rule-based base)', async () => {
    mockPlaces.findNearbyDishPlaceRows.mockResolvedValue([
      { dishId: 'd1', placeId: 'p1', distanceMeters: 800, openStatus: 'OPEN' },
    ]);
    mockPrisma.db.dish.findMany.mockResolvedValue([makeDish('d1')]);

    // Giả lập AI chạy chậm
    aiService.generateCompletion.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('{"summary":"AI slow"}'), 500)),
    );

    const start = Date.now();
    const result = await service.randomize('user1', {
      location,
      runtimeOverrides: { radiusKm: 3 },
    } as any);
    const duration = Date.now() - start;

    // Phản hồi không phải chờ 500ms của AI
    expect(duration).toBeLessThan(400);
    expect(result.explanation.summary).toBeDefined();
    expect(result.explanation.summary).not.toBe('AI slow');
  });

  it('getRandomizationById trả về chi tiết món kèm explanation', async () => {
    (mockPrisma.db.randomHistory as any).findFirst = jest.fn().mockResolvedValue({
      id: 'rh-123',
      userId: 'user1',
      dishId: 'd1',
      status: 'COMPLETED',
      compatibilityPercent: 88,
      reasonSnapshot: {
        summary: 'Rule base summary',
        factors: ['Gần bạn', 'Hợp bữa trưa'],
        aiExplanation: {
          summary: 'AI summary saved',
          factors: ['Gần bạn', 'Hợp bữa trưa'],
          nutritionHighlight: '450 kcal',
          matchTags: ['Gần bạn'],
          tip: 'Ăn nóng',
        },
      },
      fallbackSnapshot: { relaxed: ['meal_type'] },
      scoreBreakdown: { total: 88 },
      createdAt: new Date(),
      dish: makeDish('d1'),
    });

    const detail = await service.getRandomizationById('user1', 'rh-123');
    expect(detail.randomizationId).toBe('rh-123');
    expect(detail.dish?.id).toBe('d1');
    expect(detail.explanation.summary).toBe('AI summary saved');
    expect(detail.explanation.tip).toBe('Ăn nóng');
  });
});
