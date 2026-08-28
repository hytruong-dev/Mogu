import { DishExtractionV11Schema } from './dish-extraction.schema';
import { ClassificationRulesService } from './classification-rules.service';
import { TargetedRepairService } from './targeted-repair.service';
import { RecipeValidatorService } from './validators.service';
import { DishExtractionV11 } from './ai-import.types';

const extraction = (): DishExtractionV11 => ({
  schemaVersion: '1.1',
  basic: {
    name: 'Thịt kho mắm ruốt',
    alternateNames: [],
    shortDescription: 'Món kho.',
    difficulty: 'MEDIUM',
    prepMinutes: 20,
    cookMinutes: 40,
    servings: 4,
    origin: { isRegionalSpecialty: true, confidence: 90 },
  },
  classification: {
    categoryCodes: ['MEAT'],
    mealTypeCodes: ['DINNER'],
    goalCodes: [],
    dietTypeCodes: [],
    flavorCodes: [],
    confidenceByField: {},
  },
  ingredients: [
    { rawText: '200 g thịt', name: 'Thịt', optional: false },
  ],
  recipe: {
    title: 'Cách làm Thịt kho mắm ruốt',
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 40,
    difficulty: 'MEDIUM',
    steps: [{ stepNumber: 1, title: 'Kho thịt', description: 'Kho chín.' }],
  },
});

describe('DishExtractionV11Schema', () => {
  it('validate structured output', () => {
    expect(DishExtractionV11Schema.safeParse(extraction()).success).toBe(true);
    expect(
      DishExtractionV11Schema.safeParse({ ...extraction(), schemaVersion: '1.0' })
        .success,
    ).toBe(false);
  });
});

describe('ClassificationRulesService', () => {
  it('không gắn vegan khi còn ingredient unresolved', () => {
    const result = new ClassificationRulesService().evaluate({
      candidate: { ...extraction().classification, dietTypeCodes: ['VEGAN'] },
      ingredients: [{
        rawText: 'gia vị lạ',
        parsed: { rawText: 'gia vị lạ', name: 'Gia vị lạ', optional: false },
        matchedIngredientId: null,
        matchMethod: 'NONE',
        confidence: 20,
      }],
      dictionary: [],
    });
    expect(result.dietTypeCodes).not.toContain('VEGAN');
    expect(result.warnings[0]?.code).toBe('AI_IMPORT_DIET_UNVERIFIED');
  });
});

describe('RecipeValidatorService', () => {
  it('sanitize markdown, step number và fallback title', () => {
    const dish = extraction();
    dish.recipe.title = '**Phở gà truyền thống**';
    dish.recipe.steps[0].stepNumber = 7;
    dish.recipe.steps[0].title = '**Kho thịt**';
    expect(new RecipeValidatorService().sanitize(dish.recipe, dish.basic.name))
      .toMatchObject({
        title: 'Cách làm Thịt kho mắm ruốt',
        steps: [{ stepNumber: 1, title: 'Kho thịt' }],
      });
  });
});

describe('TargetedRepairService', () => {
  it('chỉ merge path lỗi nằm trong whitelist', () => {
    const original = extraction();
    const repaired = new TargetedRepairService().merge(
      original,
      {
        basic: { name: 'Tên bị thay', servings: 99 },
        recipe: { title: 'Cách làm Thịt kho mắm ruốt chuẩn' },
      },
      [{ path: 'recipe.title', reason: 'TITLE_DISH_MISMATCH' }],
    );
    expect(repaired.recipe.title).toBe('Cách làm Thịt kho mắm ruốt chuẩn');
    expect(repaired.basic).toEqual(original.basic);
  });
});
