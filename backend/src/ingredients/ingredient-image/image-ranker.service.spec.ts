import { ImageRankerService } from './image-ranker.service';
import type { IngredientImageSearchHit } from './image-provider';

describe('ImageRankerService v2', () => {
  let ranker: ImageRankerService;

  beforeEach(() => {
    ranker = new ImageRankerService();
  });

  it('filters out SVG images', () => {
    const hits: IngredientImageSearchHit[] = [
      {
        provider: 'wikimedia_commons',
        providerAssetId: '1',
        sourcePageUrl: 'https://source/1',
        originalUrl: 'https://img/structure.svg',
        licenseCode: 'CC0',
        mimeType: 'image/svg+xml',
        title: 'Chemical structure of sugar',
      },
      {
        provider: 'wikipedia_lead',
        providerAssetId: '2',
        sourcePageUrl: 'https://source/2',
        originalUrl: 'https://img/sugar.jpg',
        licenseCode: 'CC BY-SA 3.0',
        mimeType: 'image/jpeg',
        title: 'Sugar 2xmacro.jpg',
      },
    ];

    const ranked = ranker.rank(hits, 'Đường', 'sugar');
    expect(ranked.length).toBe(1);
    expect(ranked[0].originalUrl).toBe('https://img/sugar.jpg');
  });

  it('ranks Tier A entity match higher than generic keyword match', () => {
    const hits: IngredientImageSearchHit[] = [
      {
        provider: 'openverse',
        providerAssetId: 'ov-1',
        sourcePageUrl: 'https://source/ov1',
        originalUrl: 'https://img/band.jpg',
        licenseCode: 'CC BY',
        title: 'Red Hot Chili Peppers band album',
        tier: 'D',
        width: 800,
        height: 600,
      },
      {
        provider: 'wikipedia_lead',
        providerAssetId: 'wiki-1',
        sourcePageUrl: 'https://source/wiki1',
        originalUrl: 'https://img/ot.jpg',
        licenseCode: 'CC BY 1.0',
        title: 'Ot Da Lat 1.jpg',
        tier: 'A',
        entityMatch: true,
        width: 1200,
        height: 800,
      },
    ];

    const ranked = ranker.rank(hits, 'Ớt', 'chili pepper');
    expect(ranked[0].provider).toBe('wikipedia_lead');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    // Openverse hit has band penalty
    expect(ranked[1].score).toBeLessThan(30);
  });

  it('rewards match with alias and tags', () => {
    const hits: IngredientImageSearchHit[] = [
      {
        provider: 'pixabay',
        providerAssetId: 'px-1',
        sourcePageUrl: 'https://pixabay/1',
        originalUrl: 'https://pixabay/chili.jpg',
        licenseCode: 'Pixabay License',
        title: 'food market',
        tags: ['ớt cay', 'gia vị', 'chili'],
        tier: 'B',
        width: 1000,
        height: 800,
      },
    ];

    const ranked = ranker.rank(hits, 'Ớt', 'chili', ['ớt cay', 'ớt hiểm']);
    expect(ranked[0].scoreBreakdown.nameExact).toBe(25);
  });
});
