import { IngredientImageStatus } from '@prisma/client';
import { IngredientImageEnrichmentService } from './ingredient-image-enrichment.service';
import type { IngredientImageSearchHit } from './image-provider';

function hit(
  id: string,
  score: number,
  overrides?: Partial<IngredientImageSearchHit>,
): IngredientImageSearchHit & { score: number; scoreBreakdown: Record<string, any> } {
  return {
    provider: 'wikipedia_lead',
    providerAssetId: id,
    sourcePageUrl: `https://commons/${id}`,
    originalUrl: `https://img/${id}.jpg`,
    previewUrl: `https://img/${id}_s.jpg`,
    author: 'a',
    licenseCode: 'CC-BY-4.0',
    title: id,
    score,
    scoreBreakdown: {},
    tier: 'A',
    ...overrides,
  } as any;
}

function setup(opts: {
  ingredient?: Partial<{
    id: string;
    name: string;
    nameEn: string | null;
    imageUrl: string | null;
    synonyms: string[];
    enrichment: any;
  }>;
  metadata?: () => Promise<any>;
  entity?: any;
  ranked?: Array<ReturnType<typeof hit>>;
  minScore?: string;
  visionResult?: any;
}) {
  const ingredient = {
    id: 'ing-1',
    name: 'Thịt bò',
    nameEn: null,
    imageUrl: null,
    imageStatus: IngredientImageStatus.QUEUED,
    synonyms: [],
    enrichment: null,
    ...opts.ingredient,
  };
  const ingredientUpdate = jest.fn().mockResolvedValue({});
  const candidateUpsert = jest
    .fn()
    .mockImplementation(async ({ create }) => ({ id: `cand-${create.providerAssetId}` }));
  const prisma = {
    db: {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(ingredient),
        update: ingredientUpdate,
      },
      ingredientImageCandidate: { upsert: candidateUpsert },
    },
  };
  const config = {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'INGREDIENT_IMAGE_AUTO_ASSIGN_MIN_SCORE') return opts.minScore;
      if (key === 'SUPABASE_URL') return 'https://sb';
      return def;
    }),
  };

  const defaultEntity = {
    viTitle: 'Thịt bò',
    enTitle: 'beef',
    wikidataId: 'Q1234',
    aliasesVi: ['thịt bò tươi'],
    commonsCategory: 'Beef',
    p18Files: ['beef.jpg'],
    leadImage: { source: 'https://thumb/beef.jpg' },
    sources: [{ name: 'Wikipedia', url: 'https://vi.wikipedia.org/wiki/Thịt_bò' }],
    ...opts.entity,
  };

  const resolver = {
    resolve: jest.fn().mockResolvedValue(defaultEntity),
    enrichWithEnglishName: jest.fn().mockResolvedValue(defaultEntity),
  };
  const wikiLead = {
    searchByEntity: jest.fn().mockResolvedValue([hit('lead-1', 90)]),
  };
  const pixabay = {
    searchMultiLanguage: jest.fn().mockResolvedValue([]),
  };
  const commonsCategory = {
    searchByCategory: jest.fn().mockResolvedValue([]),
  };
  const wikimedia = { search: jest.fn().mockResolvedValue([]) };
  const openverse = { search: jest.fn().mockResolvedValue([]) };
  const licensePolicy = { filter: jest.fn((h: any[]) => h) };
  const ranked = opts.ranked ?? [hit('lead-1', 90)];
  const ranker = { rank: jest.fn().mockReturnValue(ranked) };
  const visionVerifier = {
    verify: jest.fn().mockResolvedValue(opts.visionResult ?? null),
  };
  const downloader = {
    download: jest.fn().mockResolvedValue({
      buffer: Buffer.from('x'),
      mimeType: 'image/webp',
      checksumSha256: 'sum',
      width: 100,
      height: 100,
    }),
  };
  const metadataService = {
    enrichMetadata: jest.fn(opts.metadata ?? (async () => ({ nameEn: 'beef' }))),
  };

  const service = new IngredientImageEnrichmentService(
    prisma as any,
    config as any,
    resolver as any,
    wikiLead as any,
    pixabay as any,
    commonsCategory as any,
    wikimedia as any,
    openverse as any,
    licensePolicy as any,
    ranker as any,
    visionVerifier as any,
    downloader as any,
    metadataService as any,
  );
  jest
    .spyOn(service as any, 'uploadToStorage')
    .mockImplementation(async (...args: unknown[]) => `provider/${args[0]}/${args[1]}.webp`);

  return {
    service,
    prisma,
    ingredientUpdate,
    candidateUpsert,
    resolver,
    wikiLead,
    pixabay,
    commonsCategory,
    wikimedia,
    openverse,
    ranker,
    visionVerifier,
    metadataService,
  };
}

describe('IngredientImageEnrichmentService.enrichIngredient', () => {
  it('resolves entity first and prioritizes Tier A & B search', async () => {
    const { service, resolver, wikiLead, pixabay, ranker } = setup({});
    await service.enrichIngredient('ing-1');

    expect(resolver.resolve).toHaveBeenCalledWith('Thịt bò', undefined, []);
    expect(wikiLead.searchByEntity).toHaveBeenCalled();
    expect(pixabay.searchMultiLanguage).toHaveBeenCalled();
    expect(ranker.rank).toHaveBeenCalled();
  });

  it('still searches images when metadata enrichment fails', async () => {
    const { service, wikiLead, ingredientUpdate } = setup({
      metadata: async () => {
        throw new Error('AI down');
      },
    });
    await service.enrichIngredient('ing-1');

    expect(wikiLead.searchByEntity).toHaveBeenCalled();
    const statuses = ingredientUpdate.mock.calls.map((c: any[]) => c[0].data.imageStatus);
    expect(statuses).not.toContain(IngredientImageStatus.FAILED);
  });

  it('auto-assigns top candidate as provisional image when score >= threshold and vision passes', async () => {
    const { service, ingredientUpdate, candidateUpsert } = setup({
      ranked: [hit('best', 75), hit('second', 60)],
      minScore: '50',
      visionResult: {
        matchesName: true,
        isIngredient: true,
        isRawOrTypicalForm: true,
        confidence: 0.9,
      },
    });
    await service.enrichIngredient('ing-1');

    const statuses = candidateUpsert.mock.calls.map((c: any[]) => c[0].create.status);
    expect(statuses).toEqual(['PROVISIONAL', 'STORED']);

    const last = ingredientUpdate.mock.calls.at(-1)![0].data;
    expect(last.imageStatus).toBe(IngredientImageStatus.PENDING_REVIEW);
    expect(last.imageKey).toBe('provider/ing-1/sum.webp');
    expect(last.imageUrl).toBe(
      'https://sb/storage/v1/object/public/ingredient-images/provider/ing-1/sum.webp',
    );
  });

  it('demotes a correct-but-atypical image (e.g. microscope/plant in field) so a typical one wins', async () => {
    const atypical = hit('sem-crystals', 90);
    const typical = hit('kitchen-form', 70);
    const verify = jest
      .fn()
      .mockResolvedValueOnce({
        matchesName: true,
        isIngredient: true,
        isRawOrTypicalForm: false,
        confidence: 0.9,
      })
      .mockResolvedValueOnce({
        matchesName: true,
        isIngredient: true,
        isRawOrTypicalForm: true,
        confidence: 0.9,
      });
    const { service, candidateUpsert } = setup({
      ranked: [atypical, typical],
      minScore: '50',
    });
    (service as any).visionVerifier.verify = verify;
    await service.enrichIngredient('ing-1');

    const created = candidateUpsert.mock.calls.map((c: any[]) => c[0].create);
    const provisional = created.find((c) => c.status === 'PROVISIONAL');
    expect(provisional?.providerAssetId).toBe('kitchen-form');
  });

  it('rejects provisional assignment when vision indicates matchesName=false', async () => {
    const candidateHit = hit('wrong-item', 70);
    const { service, ingredientUpdate, candidateUpsert } = setup({
      ranked: [candidateHit],
      minScore: '50',
      visionResult: { matchesName: false, isIngredient: true, confidence: 0.9 },
    });
    await service.enrichIngredient('ing-1');

    // Candidate score was reduced and matchesName is false, so it is STORED not PROVISIONAL
    expect(candidateUpsert.mock.calls[0][0].create.status).toBe('STORED');
    const last = ingredientUpdate.mock.calls.at(-1)![0].data;
    expect(last.imageUrl).toBeUndefined();
  });

  it('does not assign an image when best score is below threshold', async () => {
    const { service, ingredientUpdate, candidateUpsert } = setup({
      ranked: [hit('low', 20)],
      minScore: '50',
    });
    await service.enrichIngredient('ing-1');

    expect(candidateUpsert.mock.calls[0][0].create.status).toBe('STORED');
    const last = ingredientUpdate.mock.calls.at(-1)![0].data;
    expect(last.imageStatus).toBe(IngredientImageStatus.PENDING_REVIEW);
    expect(last.imageUrl).toBeUndefined();
  });

  it('never overrides an existing image', async () => {
    const { service, ingredientUpdate } = setup({
      ingredient: { imageUrl: 'https://existing.jpg' },
    });
    await service.enrichIngredient('ing-1');
    const assigned = ingredientUpdate.mock.calls.some((c: any[]) => c[0].data.imageUrl);
    expect(assigned).toBe(false);
  });

  it('marks NOT_FOUND when no candidate survives ranking', async () => {
    const { service, ingredientUpdate } = setup({ ranked: [] });
    await service.enrichIngredient('ing-1');
    expect(ingredientUpdate.mock.calls.at(-1)![0].data.imageStatus).toBe(
      IngredientImageStatus.NOT_FOUND,
    );
  });
});
