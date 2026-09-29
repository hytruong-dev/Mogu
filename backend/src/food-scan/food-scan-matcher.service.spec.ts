import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FoodScanReportService } from './food-scan-report.service';
import { FoodScanCandidate, FoodScanExtraction } from './dto/food-scan.dto';
import {
  capUnknownDishCandidates,
  evidenceScore,
  foldFoodScanName,
  FoodScanMatcherService,
  ingredientJaccard,
  ingredientPrecision,
  selectFoodScanStatus,
  stripFoodScanStopWords,
} from './food-scan-matcher.service';

const extraction: FoodScanExtraction = {
  primaryName: 'Phở bò',
  alternateNames: [],
  guesses: [{ nameVi: 'Phở bò', nameEn: 'Beef Pho', confidence: 0.9 }],
  category: 'soup_noodle',
  cuisine: 'Vietnamese',
  visibleIngredients: [],
  isFood: true,
  quality: 'GOOD',
};
const nutrition = {
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  servingName: null,
  servingG: null,
  basis: null,
};
const candidate = (score: number): FoodScanCandidate => ({
  dishId: 'db-id',
  name: 'Phở bò',
  imageUrl: null,
  score,
  nutrition,
});

describe('FoodScan manual report acknowledgement', () => {
  it.each([null, { id: 'report-id', created: true }])(
    'acknowledges success only when a report persisted (%j)',
    async (persisted) => {
      const db = {
        foodScanEvent: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'scan-id', userId: 'user-id', extraction, shortlist: [], imagePhash: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const reports = { createOrBump: jest.fn().mockResolvedValue(persisted) };
      const service = new FoodScanMatcherService(
        { db } as unknown as PrismaService,
        new ConfigService({}), undefined, undefined, undefined,
        reports as unknown as FoodScanReportService,
      );
      expect(await service.reportMissing('scan-id', 'user-id', null)).toEqual({
        success: Boolean(persisted), scanId: 'scan-id', reportId: persisted?.id ?? null,
      });
    },
  );
});

describe('FoodScan matching evidence', () => {
  it('folds Vietnamese names and strips food stop words', () => {
    expect(foldFoodScanName('Đậu Phộng')).toBe('dau phong');
    expect(stripFoodScanStopWords(foldFoodScanName('Món Phở Bò Đặc Biệt'))).toBe('pho bo');
  });
  it('computes ingredient precision as observed in recipe over observed', () => {
    expect(ingredientPrecision([], [['Bò']])).toBeNull();
    expect(ingredientPrecision(['Bò', 'hành tây'], [['Bò', 'beef'], ['Hành tây']])).toBe(1);
    expect(ingredientPrecision(['Bò', 'cà chua'], [['Bò']])).toBe(0.5);
  });
  it('normalizes missing evidence rather than scoring missing evidence as zero', () => {
    expect(evidenceScore(0.8, null, null)).toBeCloseTo(0.8);
    expect(evidenceScore(1, 0.5, 0)).toBeCloseTo(0.6);
    expect(evidenceScore(null, null, null)).toBe(0);
  });
  it('does not treat invisible ingredients as observed; deduplicates aliases', () => {
    expect(ingredientJaccard([], [['Bò']])).toBeNull();
    expect(
      ingredientJaccard(['Bò', 'bo'], [['Bò', 'beef'], ['Hành']]),
    ).toBeCloseTo(0.5);
    expect(ingredientJaccard(['Bò'], [])).toBeNull();
  });
  it('matches only with threshold and separation', () => {
    expect(
      selectFoodScanStatus(extraction, [candidate(0.8), candidate(0.7)]),
    ).toBe('MATCHED');
    expect(
      selectFoodScanStatus(extraction, [candidate(0.8), candidate(0.75)]),
    ).toBe('SUGGESTIONS');
    expect(selectFoodScanStatus(extraction, [candidate(0.6)])).toBe(
      'SUGGESTIONS',
    );
    expect(selectFoodScanStatus(extraction, [candidate(0.49)])).toBe(
      'NO_MATCH',
    );
    expect(selectFoodScanStatus(extraction, [])).toBe('NO_MATCH');
    expect(
      selectFoodScanStatus({ ...extraction, quality: 'POOR' }, [candidate(1)]),
    ).toBe('SUGGESTIONS');
    expect(
      selectFoodScanStatus({ ...extraction, isFood: false }, [candidate(1)]),
    ).toBe('NOT_FOOD');
  });
  describe('UNKNOWN_DISH evidence rules', () => {
    const base = {
      rerankRan: true,
      rerankBestIndex: 1 as number | null,
      topIsPhash: false,
      topLexicalScore: 0,
    };
    const strong = [candidate(0.85), candidate(0.6)];

    it('is UNKNOWN_DISH when rerank ran and rejected every candidate', () => {
      expect(
        selectFoodScanStatus(extraction, strong, {
          ...base,
          rerankBestIndex: null,
        }),
      ).toBe('UNKNOWN_DISH');
    });
    it('keeps a strong name match even if rerank rejected', () => {
      expect(
        selectFoodScanStatus(extraction, strong, {
          ...base,
          rerankBestIndex: null,
          topLexicalScore: 0.97,
        }),
      ).toBe('MATCHED');
    });
    it('keeps a pHash match even if rerank rejected', () => {
      expect(
        selectFoodScanStatus(extraction, strong, {
          ...base,
          rerankBestIndex: null,
          topIsPhash: true,
        }),
      ).toBe('MATCHED');
    });
    it('is UNKNOWN_DISH when rerank did not run and only image similarity matched', () => {
      expect(
        selectFoodScanStatus(extraction, strong, {
          ...base,
          rerankRan: false,
          rerankBestIndex: null,
          topLexicalScore: 0.3,
        }),
      ).toBe('UNKNOWN_DISH');
    });
    it('accepts rerank-chosen candidates', () => {
      expect(selectFoodScanStatus(extraction, strong, base)).toBe('MATCHED');
    });
    it('caps unknown candidates to 3 faint suggestions', () => {
      const capped = capUnknownDishCandidates([
        candidate(0.9),
        candidate(0.8),
        candidate(0.7),
        candidate(0.6),
      ]);
      expect(capped).toHaveLength(3);
      expect(capped.every((c) => c.score <= 0.45)).toBe(true);
      expect(capped.every((c) => c.confidenceLabel === 'LOW')).toBe(true);
    });
  });
  it('returns only DB candidates and converts canonical whole-recipe nutrition', async () => {
    const db = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'db-id', primaryScore: 1, alternateScore: null },
        ]),
      dish: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'db-id',
              name: 'Phở bò',
              media: [],
              dishIngredients: [],
              nutrition: {
                calories: 1000,
                proteinG: null,
                carbsG: 80,
                fatG: 20,
                basis: 'WHOLE_RECIPE',
                servings: 4,
                servingG: null,
                servingName: '1 tô',
              },
            },
          ]),
      },
    };
    const service = new FoodScanMatcherService(
      { db } as unknown as PrismaService,
      new ConfigService({}),
    );
    const result = await service.match(extraction, 'vision');
    expect(result.status).toBe('MATCHED');
    expect(result.candidates[0].nutrition).toEqual({
      calories: 250,
      proteinG: null,
      carbsG: 20,
      fatG: 5,
      basis: 'PER_SERVING',
      servingName: '1 tô',
      servingG: null,
    });
    expect(db.dish.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['db-id'] },
      status: 'PUBLISHED',
      deletedAt: null,
    });
  });
  it('never invents estimates or a dish ID when no canonical hit exists', async () => {
    const service = new FoodScanMatcherService(
      {
        db: { $queryRaw: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      new ConfigService({}),
    );
    expect(await service.match(extraction, 'vision')).toMatchObject({
      status: 'NO_MATCH',
      recognizedName: 'Phở bò',
      candidates: [],
      model: 'vision',
      confidence: 0,
    });
  });
});
