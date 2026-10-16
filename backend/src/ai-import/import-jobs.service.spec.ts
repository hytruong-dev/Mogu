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

describe('ImportJobsService reconcileIngredients', () => {
  it('calls resolveOrProvisionBatch with createMissing=false, createAmbiguous=false, enqueueImageEnrichment=false', async () => {
    const service = Object.create(ImportJobsService.prototype) as any;
    service.logger = { debug: jest.fn(), warn: jest.fn(), log: jest.fn(), error: jest.fn() };
    service.log = jest.fn();

    const resolveOrProvisionBatchMock = jest.fn();
    // pass 1 mock
    resolveOrProvisionBatchMock.mockResolvedValueOnce({
      items: [
        { clientRef: 'ai-0', ingredientId: 'beef-123', canonicalName: 'Thịt bò', outcome: 'EXISTING_EXACT', candidates: [] },
        { clientRef: 'ai-1', ingredientId: null, canonicalName: null, outcome: 'UNRESOLVED', candidates: [{ id: 'shallot-1', name: 'Hành tím', score: 0.88, synonyms: [] }] },
        { clientRef: 'ai-2', ingredientId: null, canonicalName: null, outcome: 'UNRESOLVED', candidates: [] },
      ],
      byClientRef: new Map([
        ['ai-0', { clientRef: 'ai-0', ingredientId: 'beef-123', canonicalName: 'Thịt bò', outcome: 'EXISTING_EXACT', candidates: [] }],
        ['ai-1', { clientRef: 'ai-1', ingredientId: null, canonicalName: null, outcome: 'UNRESOLVED', candidates: [{ id: 'shallot-1', name: 'Hành tím', score: 0.88, synonyms: [] }] }],
        ['ai-2', { clientRef: 'ai-2', ingredientId: null, canonicalName: null, outcome: 'UNRESOLVED', candidates: [] }],
      ]),
      createdIds: [],
    });

    // pass 2 mock
    resolveOrProvisionBatchMock.mockResolvedValueOnce({
      items: [
        { clientRef: 'ai-0', ingredientId: 'beef-123', canonicalName: 'Thịt bò', outcome: 'EXISTING_EXACT', candidates: [] },
        { clientRef: 'ai-1', ingredientId: 'shallot-1', canonicalName: 'Hành tím', outcome: 'EXISTING_SYNONYM', confidence: 90, candidates: [] },
        { clientRef: 'ai-2', ingredientId: null, canonicalName: null, outcome: 'NONE', candidates: [] },
      ],
      byClientRef: new Map(),
      createdIds: [],
    });

    const aiAdjudicateMock = jest.fn().mockResolvedValue([
      { ref: 'ai-1', matchId: 'shallot-1', confidence: 90, synonyms: ['hành khô'] },
    ]);

    const learnSynonymsMock = jest.fn().mockResolvedValue([]);

    service.ingredientCatalog = {
      resolveOrProvisionBatch: resolveOrProvisionBatchMock,
      learnSynonyms: learnSynonymsMock,
    };
    service.ai = {
      adjudicateIngredientMatches: aiAdjudicateMock,
    };

    const result = await service.reconcileIngredients('job-1', 'Phở bò', [
      { clientRef: 'ai-0', rawName: 'thịt bò', rawText: '500g thịt bò', unit: 'g' },
      { clientRef: 'ai-1', rawName: 'hành khô', rawText: '3 củ hành khô', unit: 'củ' },
      { clientRef: 'ai-2', rawName: 'gia vị bí truyền', rawText: '1 gói gia vị bí truyền', unit: 'gói' },
    ]);

    // Check pass 1 options
    expect(resolveOrProvisionBatchMock).toHaveBeenNthCalledWith(1, expect.any(Array), {
      createMissing: false,
      enqueueImageEnrichment: false,
      createdVia: 'AI_IMPORT',
    });

    // Check pass 2 options
    expect(resolveOrProvisionBatchMock).toHaveBeenNthCalledWith(2, expect.any(Array), {
      createMissing: false,
      createAmbiguous: false,
      enqueueImageEnrichment: false,
      createdVia: 'AI_IMPORT',
    });

    expect(result.items[0].ingredientId).toBe('beef-123');
    expect(result.items[1].ingredientId).toBe('shallot-1');
    expect(result.items[2].ingredientId).toBeNull();
    expect(result.createdIds).toEqual([]);
    expect(learnSynonymsMock).toHaveBeenCalledWith([{ id: 'shallot-1', synonyms: ['hành khô'] }]);
  });
});

describe('ImportJobsService retry', () => {
  it('resets job progress to PENDING and reuses the existing job id', async () => {
    const service = bareService();
    const existingJob = {
      id: 'job-123',
      query: 'Phở bò tái lăn',
      status: 'FAILED',
      currentStep: 2,
      progress: 30,
      errorMessage: 'AI timeout',
      sourceTypes: ['AI_GENERATED'],
      relatedKeywords: ['phở'],
      regionHint: 'NORTH',
    };
    service.findOne = jest.fn().mockResolvedValue(existingJob);
    service.running = new Set(['job-123']);
    service.store = {
      update: jest.fn().mockImplementation((_id: string, patch: any) => Promise.resolve({ ...existingJob, ...patch })),
      addLog: jest.fn().mockResolvedValue(undefined),
    };
    service.emitProgress = jest.fn();
    service.queue = {
      enqueue: jest.fn().mockResolvedValue(true),
    };

    const retried = await service.retry('job-123', 'actor-1');

    expect(retried.id).toBe('job-123');
    expect(retried.status).toBe('PENDING');
    expect(retried.progress).toBe(0);
    expect(retried.errorMessage).toBeUndefined();
    expect(service.queue.enqueue).toHaveBeenCalledWith({
      jobId: 'job-123',
      actorId: 'actor-1',
      request: {
        query: 'Phở bò tái lăn',
        sourceTypes: ['AI_GENERATED'],
        relatedKeywords: ['phở'],
        regionHint: 'NORTH',
      },
    });
  });
});
