import { JsonLdWebsiteAdapter, normalizeYoutubeUrl } from './json-ld-website.adapter';

describe('normalizeYoutubeUrl', () => {
  it('normalizes embed / youtu.be / watch URLs to canonical watch URL', () => {
    expect(normalizeYoutubeUrl('https://www.youtube.com/embed/YCaprrMJyoc')).toBe(
      'https://www.youtube.com/watch?v=YCaprrMJyoc',
    );
    expect(normalizeYoutubeUrl('https://youtu.be/YCaprrMJyoc?t=10')).toBe(
      'https://www.youtube.com/watch?v=YCaprrMJyoc',
    );
    expect(normalizeYoutubeUrl('https://m.youtube.com/watch?v=YCaprrMJyoc&list=x')).toBe(
      'https://www.youtube.com/watch?v=YCaprrMJyoc',
    );
  });

  it('returns null for non-YouTube URLs', () => {
    expect(normalizeYoutubeUrl('https://vimeo.com/123')).toBeNull();
    expect(normalizeYoutubeUrl('not a url')).toBeNull();
    expect(normalizeYoutubeUrl(null)).toBeNull();
  });
});

describe('JsonLdWebsiteAdapter', () => {
  const adapter = new JsonLdWebsiteAdapter();

  it('extracts HowToStep images (string / array / ImageObject), VideoObject and decodes entities', async () => {
    const body = `<html><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe",
       "name":"B&uacute;n b&ograve; Hu&#7871;",
       "image":["https://cdn.tgdd.vn/cover.jpg"],
       "totalTime":"PT1H30M",
       "recipeIngredient":["500 g b&uacute;n","1 kg x&#432;&#417;ng heo"],
       "recipeInstructions":[
         {"@type":"HowToStep","name":"S&#417; ch&#7871;","text":"R&#7917;a s&#7841;ch.","image":"https://cdn.tgdd.vn/s1.jpg"},
         {"@type":"HowToStep","name":"H&#7847;m","text":"H&#7847;m x&#432;&#417;ng.","image":["https://cdn.tgdd.vn/s2a.jpg","https://cdn.tgdd.vn/s2b.jpg"]},
         {"@type":"HowToStep","name":"Ho&agrave;n th&agrave;nh","text":"Tr&igrave;nh b&agrave;y.","image":{"@type":"ImageObject","url":"https://cdn.tgdd.vn/s3.jpg"}}
       ],
       "video":{"@type":"VideoObject","name":"C&aacute;ch n&#7845;u","embedUrl":"https://www.youtube.com/embed/YCaprrMJyoc","thumbnailUrl":"https://i.ytimg.com/vi/YCaprrMJyoc/hq.jpg"}
      }
    </script></html>`;

    const extraction = await adapter.extract({ uri: 'https://www.dienmayxanh.com/vao-bep/bun-bo-hue', body });
    const evidence = adapter.toRecipeEvidence(extraction);

    expect(evidence).not.toBeNull();
    expect(evidence!.title).toBe('Bún bò Huế');
    expect(evidence!.sourceDomain).toBe('dienmayxanh.com');
    expect(evidence!.ingredients).toEqual(['500 g bún', '1 kg xương heo']);
    expect(evidence!.steps).toHaveLength(3);
    expect(evidence!.steps[0].imageUrls).toEqual(['https://cdn.tgdd.vn/s1.jpg']);
    expect(evidence!.steps[1].imageUrls).toEqual(['https://cdn.tgdd.vn/s2a.jpg', 'https://cdn.tgdd.vn/s2b.jpg']);
    expect(evidence!.steps[2].imageUrls).toEqual(['https://cdn.tgdd.vn/s3.jpg']);
    expect(evidence!.steps[0].title).toBe('Sơ chế');
    expect(evidence!.videoUrl).toBe('https://www.youtube.com/watch?v=YCaprrMJyoc');
    expect(evidence!.imageUrl).toBe('https://cdn.tgdd.vn/cover.jpg');
    expect(evidence!.totalMinutes).toBe(90);
  });

  it('returns null evidence when the page has no recipe claims', async () => {
    const extraction = await adapter.extract({
      uri: 'https://example.com/none',
      body: '<script type="application/ld+json">{"@type":"Article","headline":"x"}</script>',
    });
    expect(adapter.toRecipeEvidence(extraction)).toBeNull();
  });

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
