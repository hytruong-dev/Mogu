import {
  inferMealModeFromLegacy,
  resolvePlanPrice,
  roundUpBudget,
} from './dish-pricing';

describe('dish-pricing', () => {
  const dish = { priceMin: 120000, dineOutPriceMin: 35000, servings: 4 };

  it('HOME_COOK divides recipe cost by servings', () => {
    expect(resolvePlanPrice(dish, 'HOME_COOK')).toMatchObject({
      priceVnd: 30000,
      source: 'COOK',
    });
  });

  it('EAT_OUT uses dine-out price', () => {
    expect(resolvePlanPrice(dish, 'EAT_OUT')).toMatchObject({
      priceVnd: 35000,
      source: 'EAT_OUT',
    });
  });

  it('FLEXIBLE picks the cheaper source', () => {
    expect(resolvePlanPrice(dish, 'FLEXIBLE')?.source).toBe('COOK');
    expect(
      resolvePlanPrice({ priceMin: 200000, dineOutPriceMin: 40000, servings: 2 }, 'FLEXIBLE'),
    ).toMatchObject({ priceVnd: 40000, source: 'EAT_OUT' });
  });

  it('treats missing servings as 1', () => {
    expect(resolvePlanPrice({ priceMin: 50000 }, 'HOME_COOK')?.priceVnd).toBe(50000);
  });

  it('handles single available price', () => {
    expect(resolvePlanPrice({ priceMin: 60000, servings: 2 }, 'FLEXIBLE')).toMatchObject({
      priceVnd: 30000,
      source: 'COOK',
    });
    expect(resolvePlanPrice({ dineOutPriceMin: 25000 }, 'FLEXIBLE')).toMatchObject({
      priceVnd: 25000,
      source: 'EAT_OUT',
    });
    expect(resolvePlanPrice({ dineOutPriceMin: 25000 }, 'HOME_COOK')).toBeNull();
    expect(resolvePlanPrice({ priceMin: 25000 }, 'EAT_OUT')).toBeNull();
  });

  it('rounds budgets up and infers legacy mode', () => {
    expect(roundUpBudget(412345)).toBe(420000);
    expect(inferMealModeFromLegacy(true, false)).toBe('HOME_COOK');
    expect(inferMealModeFromLegacy(true, true)).toBe('FLEXIBLE');
  });
});
