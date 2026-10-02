import { NutritionCalculatorService } from './nutrition-calculator.service';
import {
  NutritionSourceAdapter,
  NutritionSourceMatch,
  NutritionSourceRegistry,
} from './nutrition-source-adapter';
import { ExtractedIngredient } from '../ai-import.types';

const VFCT_URI = 'https://viendinhduong.vn/vi/bang-thanh-phan-thuc-pham-viet-nam-2007';
const USDA_URI = 'https://fdc.nal.usda.gov/food-details/1234';

function match(
  name: string,
  uri: string,
  nutrients: NutritionSourceMatch['nutrients'],
  confidence = 90,
): NutritionSourceMatch {
  return {
    sourceFoodId: name,
    sourceFoodName: name,
    basisGram: 100,
    nutrients,
    confidence,
    source: { kind: 'NUTRITION_DATABASE', uri, retrievedAt: new Date().toISOString() },
  };
}

function ingredient(overrides: Partial<ExtractedIngredient>): ExtractedIngredient {
  return {
    rawText: overrides.name ?? 'x',
    name: overrides.name ?? 'x',
    optional: false,
    ...overrides,
  };
}

function registryWith(table: Record<string, NutritionSourceMatch[]>): NutritionSourceRegistry {
  const adapter: NutritionSourceAdapter = {
    providerCode: 'TEST',
    isEnabled: () => true,
    lookup: async ({ canonicalName }) => table[canonicalName] ?? [],
  };
  return new NutritionSourceRegistry([adapter]);
}

describe('NutritionCalculatorService', () => {
  it('returns INGREDIENT_CALCULATED with provenance when coverage >= 70%', async () => {
    const registry = registryWith({
      'thịt bò': [match('Thịt bò loại 1', VFCT_URI, { caloriesKcal: 118, proteinG: 21, fatG: 3.8 })],
      'bún': [match('Bún', VFCT_URI, { caloriesKcal: 110, carbsG: 25.7, proteinG: 1.7 })],
    });
    const service = new NutritionCalculatorService(registry);

    const result = await service.calculate({
      dishName: 'Bún bò',
      servings: 2,
      ingredients: [
        ingredient({ name: 'thịt bò', quantity: 200, unitCode: 'G' }),
        ingredient({ name: 'bún', quantity: 200, unitCode: 'G' }),
        ingredient({ name: 'muối', quantity: 1, unitCode: 'TSP' }),
      ],
    });

    expect(result.method).toBe('INGREDIENT_CALCULATED');
    expect(result.provenance.coveragePct).toBeGreaterThanOrEqual(70);
    expect(result.provenance.generatedBy).toBe('CALCULATOR');
    expect(result.provenance.references.map((r) => r.provider)).toContain('VIETNAM_FCT_2007');
    expect(result.sourceUrl).toBeTruthy();
    expect(result.provenance.perIngredient.find((p) => p.name === 'thịt bò')).toMatchObject({
      matched: true,
      provider: 'VIETNAM_FCT_2007',
      grams: 200,
    });
    expect(result.provenance.uncovered).toContain('muối');

    // whole recipe = 200g bò (236 kcal) + 200g bún (220 kcal) = 456 kcal -> 228/serving
    expect(result.wholeRecipe.calories).toBe(456);
    expect(result.perServing.calories).toBe(228);
    expect(result.perServing.proteinG).toBeCloseTo(22.7, 0);
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });

  it('prefers VFCT over USDA for Vietnamese ingredients', async () => {
    const registry = registryWith({
      'thịt bò': [
        match('Beef, raw', USDA_URI, { caloriesKcal: 250 }, 95),
        match('Thịt bò loại 1', VFCT_URI, { caloriesKcal: 118 }, 80),
      ],
    });
    const service = new NutritionCalculatorService(registry);
    const result = await service.calculate({
      dishName: 'Bò',
      servings: 1,
      ingredients: [ingredient({ name: 'thịt bò', quantity: 100, unitCode: 'G' })],
    });
    expect(result.provenance.perIngredient[0].provider).toBe('VIETNAM_FCT_2007');
    expect(result.perServing.calories).toBe(118);
  });

  it('falls back to USDA when VFCT has no match and records USDA reference', async () => {
    const registry = registryWith({
      'phô mai': [match('Cheese, cheddar', USDA_URI, { caloriesKcal: 400, fatG: 33 }, 90)],
    });
    const service = new NutritionCalculatorService(registry);
    const result = await service.calculate({
      dishName: 'Cheese',
      servings: 1,
      ingredients: [ingredient({ name: 'phô mai', quantity: 50, unitCode: 'G' })],
    });
    expect(result.method).toBe('INGREDIENT_CALCULATED');
    expect(result.provenance.references.map((r) => r.provider)).toEqual(['USDA_FDC']);
    expect(result.perServing.calories).toBe(200);
  });

  it('uses unit gram estimates when normalizedWeightGram is missing (1 quả trứng ~55g)', async () => {
    const registry = registryWith({
      'trứng gà': [match('Trứng gà', VFCT_URI, { caloriesKcal: 166, proteinG: 14.8 })],
    });
    const service = new NutritionCalculatorService(registry);
    const result = await service.calculate({
      dishName: 'Trứng',
      servings: 1,
      ingredients: [ingredient({ name: 'trứng gà', quantity: 2, unitCode: 'QUẢ' })],
    });
    expect(result.provenance.perIngredient[0].grams).toBe(110);
    expect(result.perServing.calories).toBe(Math.round(166 * 1.1));
  });

  it('returns SOURCE_VERIFIED with sourceUrl when source JSON-LD nutrition exists', async () => {
    const service = new NutritionCalculatorService(registryWith({}));
    const result = await service.calculate({
      dishName: 'Bún bò Huế',
      servings: 4,
      ingredients: [ingredient({ name: 'bún', quantity: 400, unitCode: 'G' })],
      sourceNutrition: {
        url: 'https://www.dienmayxanh.com/vao-bep/bun-bo-hue',
        values: { calories: 520, proteinContent: 30, carbohydrateContent: 60, fatContent: 15 },
      },
    });
    expect(result.method).toBe('SOURCE_VERIFIED');
    expect(result.sourceUrl).toBe('https://www.dienmayxanh.com/vao-bep/bun-bo-hue');
    expect(result.confidence).toBeGreaterThanOrEqual(85);
    expect(result.perServing.calories).toBe(520);
    expect(result.wholeRecipe.calories).toBe(2080);
    expect(result.provenance.sourceVerified).toBe(true);
    expect(result.provenance.references.some((r) => r.provider === 'RECIPE_SOURCE')).toBe(true);
  });

  it('uses AI per-ingredient fallback for unmatched items and still calculates', async () => {
    const registry = registryWith({
      'thịt bò': [match('Thịt bò', VFCT_URI, { caloriesKcal: 118 })],
    });
    const service = new NutritionCalculatorService(registry);
    const aiIngredientFallback = jest.fn(async (items: Array<{ name: string; grams: number }>) =>
      items.map((item) => ({ name: item.name, per100g: { caloriesKcal: 100 } })),
    );
    const result = await service.calculate({
      dishName: 'Bò xào rau lạ',
      servings: 1,
      ingredients: [
        ingredient({ name: 'thịt bò', quantity: 100, unitCode: 'G' }),
        ingredient({ name: 'rau lạ', quantity: 100, unitCode: 'G' }),
      ],
      aiIngredientFallback,
    });
    expect(aiIngredientFallback).toHaveBeenCalledWith([{ name: 'rau lạ', grams: 100 }]);
    expect(result.method).toBe('INGREDIENT_CALCULATED');
    expect(result.provenance.perIngredient[1]).toMatchObject({ matched: true, provider: 'AI_ESTIMATE' });
    expect(result.perServing.calories).toBe(218);
    // AI-covered mass lowers confidence relative to pure DB coverage.
    expect(result.confidence).toBeLessThan(95);
  });

  it('falls back to AI_ESTIMATED when coverage < 70% and keeps reference notes', async () => {
    const registry = registryWith({
      'thịt bò': [match('Thịt bò', VFCT_URI, { caloriesKcal: 118 })],
    });
    const service = new NutritionCalculatorService(registry);
    const aiDishFallback = jest.fn(async () => ({
      calories: 450,
      proteinG: 25,
      carbsG: 50,
      fatG: 15,
      fiberG: 3,
      sodiumMg: 900,
      servingName: '1 tô (450g)',
      servingG: 450,
      reference: 'VFCT 2007 + USDA FDC',
    }));
    const result = await service.calculate({
      dishName: 'Món lạ',
      servings: 2,
      ingredients: [
        ingredient({ name: 'thịt bò', quantity: 50, unitCode: 'G' }),
        ingredient({ name: 'nguyên liệu lạ A', quantity: 300, unitCode: 'G' }),
        ingredient({ name: 'nguyên liệu lạ B', quantity: 300, unitCode: 'G' }),
      ],
      aiDishFallback,
    });
    expect(aiDishFallback).toHaveBeenCalled();
    expect(result.method).toBe('AI_ESTIMATED');
    expect(result.sourceUrl).toBeNull();
    expect(result.perServing.calories).toBe(450);
    expect(result.wholeRecipe.calories).toBe(900);
    expect(result.servingName).toBe('1 tô (450g)');
    expect(result.servingG).toBe(450);
    expect(result.confidence).toBeLessThanOrEqual(60);
    expect(result.provenance.notes?.some((n) => n.includes('VFCT 2007 + USDA FDC'))).toBe(true);
    expect(result.provenance.uncovered).toEqual(['nguyên liệu lạ A', 'nguyên liệu lạ B']);
  });

  it('is fail-soft without registry and without AI fallbacks', async () => {
    const service = new NutritionCalculatorService();
    const result = await service.calculate({
      dishName: 'Món',
      servings: 1,
      ingredients: [ingredient({ name: 'thịt bò', quantity: 100, unitCode: 'G' })],
    });
    expect(result.method).toBe('AI_ESTIMATED');
    expect(result.perServing.calories).toBe(0);
    expect(result.provenance.coveragePct).toBe(0);
  });

  it('ignores negligible ingredients like nước when computing coverage', async () => {
    const registry = registryWith({
      'thịt bò': [match('Thịt bò', VFCT_URI, { caloriesKcal: 118 })],
    });
    const service = new NutritionCalculatorService(registry);
    const result = await service.calculate({
      dishName: 'Bò',
      servings: 1,
      ingredients: [
        ingredient({ name: 'thịt bò', quantity: 100, unitCode: 'G' }),
        ingredient({ name: 'nước', quantity: 2, unitCode: 'L' }),
      ],
    });
    expect(result.provenance.coveragePct).toBe(100);
    expect(result.method).toBe('INGREDIENT_CALCULATED');
  });
});
