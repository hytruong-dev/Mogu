import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FoodScanReportService } from './food-scan-report.service';
import { FoodScanExtraction } from './dto/food-scan.dto';

const extraction: FoodScanExtraction = {
  primaryName: 'Don Quảng Ngãi',
  alternateNames: [],
  guesses: [{ nameVi: 'Don Quảng Ngãi', nameEn: 'Don clam soup', confidence: 0.8 }],
  category: 'soup_noodle',
  cuisine: 'Vietnamese',
  visibleIngredients: ['don', 'hành lá'],
  isFood: true,
  quality: 'GOOD',
};

function setup() {
  const model = {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({ id: 'new-report' }),
  };
  const prisma = { db: { foodScanMissingDishReport: model } } as unknown as PrismaService;
  const service = new FoodScanReportService(prisma, new ConfigService({}));
  // No Supabase configured in tests: image uploads resolve to null.
  return { service, model };
}

describe('FoodScanReportService', () => {
  it('creates a new report with the AI guesses', async () => {
    const { service, model } = setup();
    const result = await service.createOrBump({
      scanEventId: 'scan-1',
      imagePhash: 'abc',
      extraction,
      suggestedDishIds: ['d1'],
      source: 'AUTO',
    });
    expect(result).toEqual({ id: 'new-report', created: true });
    expect(model.create.mock.calls[0][0].data).toMatchObject({
      scanEventId: 'scan-1',
      recognizedName: 'Don Quảng Ngãi',
      visibleIngredients: ['don', 'hành lá'],
      suggestedDishIds: ['d1'],
      source: 'AUTO',
    });
  });

  it('dedupes by pHash within 30 days by bumping report_count', async () => {
    const { service, model } = setup();
    model.findFirst
      .mockResolvedValueOnce(null) // no report for this scan
      .mockResolvedValueOnce({ id: 'existing' }); // same photo
    const result = await service.createOrBump({
      scanEventId: 'scan-2',
      imagePhash: 'abc',
      extraction,
      source: 'AUTO',
    });
    expect(result).toEqual({ id: 'existing', created: false });
    expect(model.create).not.toHaveBeenCalled();
    expect(model.update.mock.calls[0][0].data.reportCount).toEqual({ increment: 1 });
  });

  it('keeps a single report per scan and upgrades AUTO to USER', async () => {
    const { service, model } = setup();
    model.findFirst.mockResolvedValueOnce({ id: 'scan-report', imageStorageKey: 'k' });
    const result = await service.createOrBump({
      scanEventId: 'scan-1',
      extraction,
      source: 'USER',
    });
    expect(result).toEqual({ id: 'scan-report', created: false });
    expect(model.update.mock.calls[0][0].data).toEqual({ source: 'USER' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('never throws (best-effort)', async () => {
    const { service, model } = setup();
    model.findFirst.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.createOrBump({ scanEventId: 's', extraction, source: 'AUTO' }),
    ).resolves.toBeNull();
  });
});
