import { JsonLdWebsiteAdapter } from './json-ld-website.adapter';

describe('JsonLdWebsiteAdapter', () => {
  const adapter = new JsonLdWebsiteAdapter();

  it('extracts Recipe claims from an @graph block', async () => {
    const body = `<html><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList"},
        {"@type":"Recipe","name":"Phở bò","description":"<b>Món ngon</b>",
         "prepTime":"PT30M","cookTime":"PT2H","recipeYield":"4 phần",
         "recipeIngredient":["500 g xương bò","200 g bánh phở"],
         "recipeInstructions":[{"@type":"HowToStep","name":"Ninh","text":"Ninh xương."}],
         "nutrition":{"calories":"480 kcal","proteinContent":"28 g","sodiumContent":"900 mg"}}
      ]}
    </script></html>`;

    const result = await adapter.extract({
      uri: 'https://example.com/pho',
      body,
      contentType: 'text/html',
      retrievedAt: '2026-08-28T00:00:00.000Z',
    });

    expect(result.warnings).toEqual([]);
    expect(result.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: 'basic.name', value: 'Phở bò' }),
        expect.objectContaining({ fieldPath: 'basic.prepMinutes', value: 30 }),
        expect.objectContaining({ fieldPath: 'basic.cookMinutes', value: 120 }),
        expect.objectContaining({ fieldPath: 'recipe.servings', value: 4 }),
        expect.objectContaining({
          fieldPath: 'nutrition.caloriesKcal',
          value: 480,
        }),
      ]),
    );
  });

  it('isolates malformed JSON-LD without throwing', async () => {
    const result = await adapter.extract({
      uri: 'https://example.com/bad',
      body: '<script type="application/ld+json">{bad}</script>',
    });

    expect(result.claims).toEqual([]);
    expect(result.warnings).toEqual([
      'INVALID_JSON_LD_BLOCK',
      'NO_RECIPE_JSON_LD',
    ]);
  });
});
