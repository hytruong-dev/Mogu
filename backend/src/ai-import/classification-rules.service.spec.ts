import { ClassificationRulesService } from './classification-rules.service';
import { inferDishType, matchDishCategory } from './classification/dish-category-rules';
import { DishClassificationCandidate } from './ai-import.types';

const candidate = (overrides: Partial<DishClassificationCandidate> = {}): DishClassificationCandidate => ({
  categoryCodes: [],
  mealTypeCodes: [],
  goalCodes: [],
  dietTypeCodes: [],
  flavorCodes: [],
  confidenceByField: {},
  ...overrides,
});

describe('dish-category-rules', () => {
  it('matches noodle dishes to NOODLE / WET', () => {
    const match = matchDishCategory('Bún bò Huế');
    expect(match?.categoryCode).toBe('NOODLE');
    expect(match?.dishType).toBe('WET');
  });

  it('matches "Phở xào" as NOODLE / DRY (stir-fried noodles)', () => {
    const match = matchDishCategory('Phở xào bò');
    expect(match?.categoryCode).toBe('NOODLE');
    expect(match?.dishType).toBe('DRY');
  });

  it('matches "Bánh mì" to BREAD before generic "bánh"', () => {
    expect(matchDishCategory('Bánh mì thịt nướng')?.categoryCode).toBe('BREAD');
  });

  it('matches "Canh chua cá lóc" to SOUP but not "Bánh canh" to SOUP', () => {
    expect(matchDishCategory('Canh chua cá lóc')?.categoryCode).toBe('SOUP');
    expect(matchDishCategory('Bánh canh cua')?.categoryCode).toBe('NOODLE');
  });

  it('matches "Cơm tấm" to RICE / DRY and "Lẩu thái" to HOT_POT / WET', () => {
    expect(matchDishCategory('Cơm tấm sườn bì chả')?.categoryCode).toBe('RICE');
    expect(matchDishCategory('Lẩu thái hải sản')?.categoryCode).toBe('HOT_POT');
    expect(inferDishType('Lẩu thái hải sản', ['HOT_POT'], matchDishCategory('Lẩu thái hải sản'))).toBe('WET');
  });

  it('infers WET from keywords when no rule matches', () => {
    expect(inferDishType('Món nước đặc biệt', [], null)).toBe('WET');
    expect(inferDishType('Thịt kho tàu', [], null)).toBe('DRY');
  });
});

describe('ClassificationRulesService', () => {
  let service: ClassificationRulesService;

  beforeEach(() => {
    service = new ClassificationRulesService();
  });

  it('assigns NOODLE + WET for "Bún bò Huế" when AI returns empty', () => {
    const result = service.evaluate({
      candidate: candidate(),
      ingredients: [],
      dictionary: [],
      dishName: 'Bún bò Huế',
      allowedCategoryCodes: ['NOODLE', 'SOUP', 'RICE', 'OTHER'],
      allowedMealTypeCodes: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
    });
    expect(result.categoryCodes).toEqual(['NOODLE']);
    expect(result.dishType).toBe('WET');
    expect(result.mealTypeCodes).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);
  });

  it('overrides AI "OTHER" with the rule and emits a warning', () => {
    const result = service.evaluate({
      candidate: candidate({ categoryCodes: ['OTHER'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Phở gà',
      allowedCategoryCodes: ['NOODLE', 'OTHER'],
    });
    expect(result.categoryCodes).toEqual(['NOODLE']);
    expect(result.warnings.some((w) => w.code === 'AI_IMPORT_CATEGORY_RULE_OVERRIDE')).toBe(true);
  });

  it('puts rule category first when AI contradicts it, keeping 1 AI code', () => {
    const result = service.evaluate({
      candidate: candidate({ categoryCodes: ['RICE', 'SOUP'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Bún chả Hà Nội',
      allowedCategoryCodes: ['NOODLE', 'RICE', 'SOUP'],
    });
    expect(result.categoryCodes[0]).toBe('NOODLE');
    expect(result.categoryCodes).toHaveLength(2);
    expect(result.dishType).toBe('DRY');
  });

  it('does not assign category codes outside the allowed taxonomy', () => {
    const result = service.evaluate({
      candidate: candidate({ categoryCodes: ['NOODLE'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Phở bò',
      allowedCategoryCodes: ['OTHER'],
    });
    expect(result.categoryCodes).toEqual([]);
  });

  it('maps canonical rule codes onto the live taxonomy aliases (NOODLE -> PHO, HOT_POT -> LẨU)', () => {
    const live = ['AN_VAN', 'BANH', 'CHAY', 'COM', 'DO_UONG', 'HAI_SAN', 'LẨU', 'PHO', 'THIT', 'TRANG_MIENG'];
    const noodle = service.evaluate({
      candidate: candidate({ categoryCodes: ['NOODLE'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Bún bò Huế',
      allowedCategoryCodes: live,
      allowedMealTypeCodes: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'],
    });
    expect(noodle.categoryCodes).toEqual(['PHO']);
    expect(noodle.dishType).toBe('WET');
    expect(noodle.mealTypeCodes).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);

    const hotpot = service.evaluate({
      candidate: candidate({ categoryCodes: [] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Lẩu thái hải sản',
      allowedCategoryCodes: live,
    });
    expect(hotpot.categoryCodes).toEqual(['LẨU']);
    expect(hotpot.dishType).toBe('WET');

    const rice = service.evaluate({
      candidate: candidate({ categoryCodes: ['RICE'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Cơm tấm sườn bì',
      allowedCategoryCodes: live,
    });
    expect(rice.categoryCodes).toEqual(['COM']);
    expect(rice.dishType).toBe('DRY');
  });

  it('keeps AI meal types when provided', () => {
    const result = service.evaluate({
      candidate: candidate({ mealTypeCodes: ['DINNER'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Phở bò',
    });
    expect(result.mealTypeCodes).toEqual(['DINNER']);
  });

  it('defaults dessert to SNACK meal type', () => {
    const result = service.evaluate({
      candidate: candidate(),
      ingredients: [],
      dictionary: [],
      dishName: 'Chè ba màu',
    });
    expect(result.categoryCodes).toEqual(['DESSERT']);
    expect(result.mealTypeCodes).toEqual(['SNACK']);
  });

  it('drops BUDGET goal when price evidence is unreliable and adds EXPLORE for specialties', () => {
    const result = service.evaluate({
      candidate: candidate({ goalCodes: ['BUDGET'] }),
      ingredients: [],
      dictionary: [],
      dishName: 'Bún bò Huế',
      priceEvidenceReliable: false,
      isRegionalSpecialty: true,
    });
    expect(result.goalCodes).not.toContain('BUDGET');
    expect(result.goalCodes).toContain('EXPLORE');
  });
});
