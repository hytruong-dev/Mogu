import { PrismaService } from '../prisma/prisma.service';
import { FoodScanReportService } from '../food-scan/food-scan-report.service';
import { FoodScanEmbeddingService } from '../food-scan/food-scan-embedding.service';
import { AdminFoodScanService } from './admin-food-scan.service';

const now = new Date('2026-09-29T00:00:00Z');
const report = {
  id: 'r1',
  scanEventId: 's1',
  userId: 'u1',
  imageBucket: 'food-scan-reports',
  imageStorageKey: 'k.jpg',
  imagePhash: 'abc',
  recognizedName: 'Don Quảng Ngãi',
  guesses: [{ nameVi: 'Don Quảng Ngãi', nameEn: null, confidence: 0.8 }],
  category: 'soup_noodle',
  cuisine: 'Vietnamese',
  visibleIngredients: ['don'],
  suggestedDishIds: ['d-canh'],
  source: 'AUTO',
  status: 'NEW',
  reportCount: 2,
  linkedDishId: null,
  handledBy: null,
  handledAt: null,
  adminNote: null,
  createdAt: now,
  updatedAt: now,
  linkedDish: null,
};

function setup() {
  const db = {
    foodScanMissingDishReport: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'NEW', _count: { _all: 3 } },
        { status: 'ADDED', _count: { _all: 1 } },
      ]),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([report]),
      findUnique: jest.fn().mockResolvedValue(report),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...report, ...data, linkedDish: null }),
      ),
    },
    dish: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'd-canh', name: 'Canh cua', slug: 'canh-cua' }]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'd-don',
        name: 'Don',
        alternateNames: ['Món don'],
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    adminActionAudit: { create: jest.fn().mockResolvedValue({}) },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const reports = {
    signedImageUrl: jest.fn().mockResolvedValue('https://signed/k.jpg'),
  } as unknown as FoodScanReportService;
  const embedding = {
    embedText: jest.fn().mockResolvedValue(null),
  } as unknown as FoodScanEmbeddingService;
  const service = new AdminFoodScanService(
    { db } as unknown as PrismaService,
    reports,
    embedding,
  );
  return { service, db };
}

describe('AdminFoodScanService', () => {
  it('summarizes counts per status', async () => {
    const { service } = setup();
    expect(await service.summary()).toEqual({
      new: 3,
      inProgress: 0,
      added: 1,
      dismissed: 0,
    });
  });

  it('lists reports with signed image and suggested dishes', async () => {
    const { service } = setup();
    const res = await service.list({ status: 'NEW' });
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      imageUrl: 'https://signed/k.jpg',
      recognizedName: 'Don Quảng Ngãi',
      reportCount: 2,
      suggestedDishes: [{ id: 'd-canh', name: 'Canh cua' }],
    });
  });

  it('links an existing dish and adds the AI name as alias', async () => {
    const { service, db } = setup();
    const res = await service.update(
      'r1',
      { status: 'ADDED', linkedDishId: '11111111-1111-1111-1111-111111111111', addAlias: true },
      'admin-1',
    );
    expect(res.aliasAdded).toBe(true);
    expect(db.dish.update.mock.calls[0][0].data.alternateNames).toEqual([
      'Món don',
      'Don Quảng Ngãi',
    ]);
    expect(db.foodScanMissingDishReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'ADDED',
      handledBy: 'admin-1',
    });
    expect(db.adminActionAudit.create).toHaveBeenCalled();
  });

  it('does not duplicate an alias that already exists (accent-insensitive)', async () => {
    const { service, db } = setup();
    db.dish.findFirst.mockResolvedValueOnce({
      id: 'd-don',
      name: 'Don',
      alternateNames: ['Don Quang Ngai'],
    });
    const res = await service.update(
      'r1',
      { linkedDishId: '11111111-1111-1111-1111-111111111111', addAlias: true },
      'admin-1',
    );
    expect(res.aliasAdded).toBe(false);
    expect(db.dish.update).not.toHaveBeenCalled();
  });
});
