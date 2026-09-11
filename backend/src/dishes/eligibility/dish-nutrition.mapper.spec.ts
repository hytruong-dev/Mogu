import { mapNutritionToPlanServing, planPriceVnd } from './dish-nutrition.mapper';

describe('dish-nutrition.mapper', () => {
  it('maps PER_SERVING proteinG fields', () => {
    const r = mapNutritionToPlanServing({
      calories: 500,
      proteinG: 20,
      carbsG: 40,
      fatG: 15,
      basis: 'PER_SERVING',
    });
    expect(r.kcal).toBe(500);
    expect(r.proteinG).toBe(20);
    expect(r.convertible).toBe(true);
  });

  it('scales PER_100G by servingG', () => {
    const r = mapNutritionToPlanServing({
      calories: 200,
      proteinG: 10,
      basis: 'PER_100G',
      servingG: 150,
    });
    expect(r.kcal).toBe(300);
    expect(r.proteinG).toBe(15);
  });

  it('scales WHOLE_RECIPE by servings', () => {
    const r = mapNutritionToPlanServing({
      calories: 1000,
      proteinG: 40,
      basis: 'WHOLE_RECIPE',
      servingsPerRecipe: 4,
    });
    expect(r.kcal).toBe(250);
    expect(r.proteinG).toBe(10);
  });

  it('does not treat null price as 0', () => {
    expect(planPriceVnd(null)).toBeNull();
    expect(planPriceVnd(undefined)).toBeNull();
    expect(planPriceVnd(35000)).toBe(35000);
  });
});
