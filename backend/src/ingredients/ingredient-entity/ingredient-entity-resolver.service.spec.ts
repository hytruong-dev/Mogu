import { IngredientEntityResolverService } from './ingredient-entity-resolver.service';

describe('IngredientEntityResolverService', () => {
  let service: IngredientEntityResolverService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new IngredientEntityResolverService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves direct Wikipedia standard page (e.g. Ớt)', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/page/summary/')) {
        return {
          ok: true,
          json: async () => ({
            type: 'standard',
            title: 'Ớt',
            wikibase_item: 'Q165199',
            description: 'loài thực vật với quả có vị cay',
            extract: 'Ớt là một loại quả...',
            thumbnail: { source: 'https://thumb/ot.jpg', width: 300, height: 200 },
            content_urls: { desktop: { page: 'https://vi.wikipedia.org/wiki/Ớt' } },
          }),
        } as any;
      }
      if (url.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q165199: {
                labels: { en: { value: 'chili pepper' } },
                aliases: { vi: [{ value: 'ớt cay' }] },
                claims: {
                  P18: [{ mainsnak: { datavalue: { value: 'Ot_Da_Lat_1.jpg' } } }],
                  P373: [{ mainsnak: { datavalue: { value: 'Chili peppers' } } }],
                },
              },
            },
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    const res = await service.resolve('Ớt');
    expect(res.viTitle).toBe('Ớt');
    expect(res.wikidataId).toBe('Q165199');
    expect(res.enTitle).toBe('chili pepper');
    expect(res.aliasesVi).toContain('ớt cay');
    expect(res.p18Files).toContain('Ot_Da_Lat_1.jpg');
    expect(res.commonsCategory).toBe('Chili peppers');
    expect(res.leadImage?.source).toBe('https://thumb/ot.jpg');
  });

  it('handles disambiguation page by searching and falling back to Wikidata and sitelink', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      // 1. Initial summary for "Đường" is disambiguation
      if (url.includes('/page/summary/%C4%90%C6%B0%E1%BB%9Dng') || url.includes('/page/summary/Đường')) {
        return {
          ok: true,
          json: async () => ({
            type: 'disambiguation',
            title: 'Đường',
          }),
        } as any;
      }
      // 2. Wikipedia search query
      if (url.includes('action=query') && url.includes('generator=search')) {
        return {
          ok: true,
          json: async () => ({
            query: {
              pages: {
                1: {
                  title: 'Đường (thực phẩm)',
                  pageprops: { wikibase_item: 'Q11002' },
                  extract: 'Đường ăn là tên gọi chung...',
                },
              },
            },
          }),
        } as any;
      }
      // 3. Follow-up summary for "Đường (thực phẩm)"
      if (url.includes('/page/summary/') && url.includes('th%E1%BB%B1c_ph%E1%BA%A9m')) {
        return {
          ok: true,
          json: async () => ({
            type: 'standard',
            title: 'Đường (thực phẩm)',
            wikibase_item: 'Q11002',
            description: 'hợp chất hóa học ở dạng tinh thể',
            extract: 'Đường ăn là tên gọi chung...',
            thumbnail: { source: 'https://thumb/sugar.jpg', width: 300, height: 300 },
          }),
        } as any;
      }
      // 4. Wikidata details
      if (url.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q11002: {
                labels: { en: { value: 'sugar' } },
                aliases: { vi: [{ value: 'đường thực phẩm' }] },
                claims: {
                  P18: [{ mainsnak: { datavalue: { value: 'Sugar 2xmacro.jpg' } } }],
                  P373: [{ mainsnak: { datavalue: { value: 'Sugars' } } }],
                },
                sitelinks: { viwiki: { title: 'Đường (thực phẩm)' } },
              },
            },
          }),
        } as any;
      }
      return { ok: false } as any;
    });

    const res = await service.resolve('Đường');
    expect(res.viTitle).toBe('Đường (thực phẩm)');
    expect(res.wikidataId).toBe('Q11002');
    expect(res.enTitle).toBe('sugar');
    expect(res.aliasesVi).toContain('đường thực phẩm');
    expect(res.p18Files).toContain('Sugar 2xmacro.jpg');
    expect(res.commonsCategory).toBe('Sugars');
  });

  describe('buildViTitleCandidates', () => {
    it('strips Vietnamese modifiers to find a broader article', () => {
      expect(service.buildViTitleCandidates('thịt thăn bò')).toEqual(
        expect.arrayContaining(['thịt thăn bò', 'thịt bò']),
      );
      expect(service.buildViTitleCandidates('ớt chuông đỏ')).toEqual(
        expect.arrayContaining(['ớt chuông đỏ', 'ớt chuông']),
      );
      expect(service.buildViTitleCandidates('bơ lạt')).toEqual(
        expect.arrayContaining(['bơ lạt', 'bơ']),
      );
    });

    it('keeps original name first and dedupes', () => {
      const out = service.buildViTitleCandidates('muối', ['muối ăn', 'Muối']);
      expect(out[0]).toBe('muối');
      expect(out.filter((v) => v.toLowerCase() === 'muối').length).toBe(1);
      expect(out).toContain('muối ăn');
    });
  });

  it('does not accept Wikidata items whose label differs only by diacritics (xương bò vs xương bồ)', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [
              { id: 'Q674136', label: 'Xương bồ', description: 'loài thực vật', match: { text: 'Xương bồ' } },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const res = await service.resolve('xương bò');
    expect(res.wikidataId).toBeUndefined();
  });

  it('gracefully handles network errors and returns partial entity', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));
    const res = await service.resolve('Nguyên liệu lạ');
    expect(res.aliasesVi).toEqual([]);
    expect(res.p18Files).toEqual([]);
    expect(res.sources).toEqual([]);
  });
});
