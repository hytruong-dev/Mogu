import { ImportJobsService } from './import-jobs.service';
import { DishExtractionV11 } from './ai-import.types';
import { RecipeDiscoveryResult } from './sources/recipe-source-discovery.service';

function bareService(): any {
  const service = Object.create(ImportJobsService.prototype) as any;
  service.eventSequences = new Map<string, number>();
  service.logger = { debug: jest.fn(), warn: jest.fn(), log: jest.fn(), error: jest.fn() };
  return service;
}

function extraction(overrides: Partial<DishExtractionV11['basic']> = {}): DishExtractionV11 {
  return {
    schemaVersion: '1.1',
    basic: {
      name: 'Bún bò Huế',
      alternateNames: [],
      shortDescription: 'x',
      difficulty: 'MEDIUM',
      prepMinutes: 30,
      cookMinutes: 90,
      servings: 4,
      servingSize: '1 tô',
      priceMin: 120000,
      priceMax: 180000,
      origin: { isRegionalSpecialty: true, confidence: 90 },
      ...overrides,
    } as DishExtractionV11['basic'],
    ingredients: [
      { rawText: 'bún 500g', name: 'bún', quantity: 500, unitCode: 'G', optional: false },
      { rawText: 'muối vừa đủ', name: 'muối', quantity: null, unitCode: 'VỪA_ĐỦ', optional: false },
    ],
    recipe: {
      title: 'Cách nấu',
      servings: 4,
      prepMinutes: 30,
      cookMinutes: 90,
      difficulty: 'MEDIUM',
      steps: [{ stepNumber: 1, title: 'Sơ chế', description: 'x' }],
    },
    classification: {
      categoryCodes: ['NOODLE'],
      mealTypeCodes: ['LUNCH'],
      goalCodes: [],
      dietTypeCodes: [],
      flavorCodes: [],
      confidenceByField: {},
    },
    generalTips: [],
  } as unknown as DishExtractionV11;
}

describe('ImportJobsService pricing', () => {
  it('maps homeCook -> priceMin/Max (WHOLE_RECIPE) and dineOut -> per serving', () => {
    const result = bareService().resolvePricing(
      extraction({
        pricing: {
          homeCook: { min: 150000, max: 200000, basis: 'WHOLE_RECIPE' },
          dineOut: { min: 40000, max: 65000, basis: 'PER_SERVING' },
          note: 'Giá mặt bằng TP.HCM 2026',
        },
      }),
      true,
    );
    expect(result.homeCook).toEqual({ min: 150000, max: 200000, basis: 'WHOLE_RECIPE' });
    expect(result.dineOut).toEqual({ min: 40000, max: 65000, basis: 'PER_SERVING' });
    expect(result.source).toBe('AI_PRICING');
    expect(result.reliable).toBe(true);
    expect(result.note).toContain('2026');
  });

  it('falls back to legacy priceMin/priceMax and derives dine-out from per-serving home cost', () => {
    const result = bareService().resolvePricing(extraction(), false);
    expect(result.homeCook.min).toBe(120000);
    expect(result.homeCook.max).toBe(180000);
    expect(result.source).toBe('DERIVED');
    expect(result.reliable).toBe(false);
    // 120000 / 4 phần * 2 = 60000 ; 180000 / 4 * 2.5 = 112500 -> 113000
    expect(result.dineOut.min).toBe(60000);
    expect(result.dineOut.max).toBe(113000);
  });

  it('swaps reversed ranges and fills missing bound', () => {
    const result = bareService().resolvePricing(
      extraction({ pricing: { homeCook: { min: 200000, max: 100000, basis: 'WHOLE_RECIPE' }, dineOut: { min: 50000, max: null, basis: 'PER_SERVING' } } }),
      true,
    );
    expect(result.homeCook).toMatchObject({ min: 100000, max: 200000 });
    expect(result.dineOut).toMatchObject({ min: 50000, max: 50000 });
  });
});

describe('ImportJobsService legacy data + quantity default', () => {
  it('defaults missing ingredient quantity to 1 in toLegacyDishData', () => {
    const legacy = bareService().toLegacyDishData(extraction());
    expect(legacy.ingredients[0].quantity).toBe(500);
    expect(legacy.ingredients[1].quantity).toBe(1);
  });
});

describe('ImportJobsService sources', () => {
  it('builds JSON_LD / VIDEO / NUTRITION DishSource entries with reliability', () => {
    const best = {
      url: 'https://www.dienmayxanh.com/vao-bep/bun-bo-hue',
      domain: 'dienmayxanh.com',
      title: 'Cách nấu bún bò Huế',
      evidence: { sourceUrl: '', ingredients: [], steps: [] },
      stepImageCount: 4,
      stepsWithImages: 4,
      hasVideo: true,
      titleMatches: true,
      score: 90,
    };
    const discovery: RecipeDiscoveryResult = {
      candidates: [],
      sources: [
        best,
        { ...best, url: 'https://www.cooky.vn/x', domain: 'cooky.vn', score: 60 },
      ],
      best,
      videoUrl: 'https://www.youtube.com/watch?v=YCaprrMJyoc',
      videoTitle: 'Cách nấu bún bò Huế',
      videoSource: 'JSON_LD',
      warnings: [],
    };
    const sources = bareService().buildSources(discovery, [
      { provider: 'VIETNAM_FCT_2007', title: 'VFCT 2007', url: 'https://viendinhduong.vn/x' },
      { provider: 'USDA_FDC', title: 'USDA', url: 'https://fdc.nal.usda.gov/' },
    ]);

    expect(sources).toEqual([
      expect.objectContaining({ sourceType: 'JSON_LD', reliability: 85, domain: 'dienmayxanh.com' }),
      expect.objectContaining({ sourceType: 'JSON_LD', reliability: 75, domain: 'cooky.vn' }),
      expect.objectContaining({ sourceType: 'VIDEO', reliability: 85, domain: 'youtube.com', url: 'https://www.youtube.com/watch?v=YCaprrMJyoc' }),
      expect.objectContaining({ sourceType: 'NUTRITION', reliability: 90, domain: 'viendinhduong.vn' }),
      expect.objectContaining({ sourceType: 'NUTRITION', reliability: 90, domain: 'fdc.nal.usda.gov' }),
    ]);
  });

  it('dedupes sources by URL', () => {
    const discovery: RecipeDiscoveryResult = {
      candidates: [],
      sources: [],
      best: null,
      videoUrl: 'https://www.youtube.com/watch?v=abc123456',
      videoTitle: null,
      videoSource: 'TAVILY_YOUTUBE',
      warnings: [],
    };
    const sources = bareService().buildSources(discovery, [
      { provider: 'X', title: 'dup', url: 'https://www.youtube.com/watch?v=abc123456' },
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ sourceType: 'VIDEO', reliability: 80 });
  });
});

describe('ImportJobsService event sequencing', () => {
  it('tăng sequence độc lập theo từng job', () => {
    const emitProgress = jest.fn();
    const service = Object.create(ImportJobsService.prototype) as any;
    service.eventSequences = new Map<string, number>();
    service.gateway = { emitProgress };

    const job = {
      id: 'job-1',
      query: 'Phở bò',
      status: 'SEARCHING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0,
      sourceTypes: [],
      createdAt: new Date().toISOString(),
    };

    service.emitProgress(job, 'step 1', 'SEARCHING');
    service.emitProgress({ ...job, progress: 16 }, 'step 2', 'EXTRACTING');
    service.emitProgress({ ...job, id: 'job-2' }, 'step 1', 'SEARCHING');

    expect(emitProgress.mock.calls.map(([payload]) => ({
      eventId: payload.eventId,
      sequence: payload.sequence,
    }))).toEqual([
      { eventId: 'job-1:1', sequence: 1 },
      { eventId: 'job-1:2', sequence: 2 },
      { eventId: 'job-2:1', sequence: 1 },
    ]);
  });
});
