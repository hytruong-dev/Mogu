import { WikiLeadImageProvider } from './wiki-lead-image.provider';
import type { ResolvedIngredientEntity } from '../ingredient-entity/ingredient-entity-resolver.service';

describe('WikiLeadImageProvider', () => {
  let provider: WikiLeadImageProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new WikiLeadImageProvider();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('queries Wikimedia Commons imageinfo for lead image and P18 files', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            100: {
              pageid: 100,
              title: 'File:Ot Da Lat 1.jpg',
              imageinfo: [
                {
                  url: 'https://upload/Ot_Da_Lat_1.jpg',
                  thumburl: 'https://thumb/Ot_Da_Lat_1.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Ot_Da_Lat_1.jpg',
                  width: 3504,
                  height: 2336,
                  mime: 'image/jpeg',
                  user: 'Dalat',
                  extmetadata: {
                    LicenseShortName: { value: 'CC BY 1.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by/1.0' },
                    Artist: { value: '<b>Mai Le</b>' },
                    ImageDescription: { value: 'Chili pepper in Da Lat' },
                  },
                },
              ],
            },
          },
        },
      }),
    });

    const entity: ResolvedIngredientEntity = {
      leadImage: { source: 'https://thumb/Ot_Da_Lat_1.jpg/300px-Ot_Da_Lat_1.jpg' },
      p18Files: ['Madame Jeanette and other chillies.jpg'],
      aliasesVi: [],
      sources: [],
    };

    const hits = await provider.searchByEntity(entity);
    expect(hits.length).toBe(1);
    expect(hits[0].tier).toBe('A');
    expect(hits[0].entityMatch).toBe(true);
    expect(hits[0].licenseCode).toBe('CC BY 1.0');
    expect(hits[0].author).toBe('Mai Le');
    expect(hits[0].provider).toBe('wikipedia_lead');
  });

  describe('extractFileNameFromUrl', () => {
    it('extracts filename from a Commons direct upload URL', () => {
      expect(
        provider.extractFileNameFromUrl(
          'https://upload.wikimedia.org/wikipedia/commons/6/60/Standing-rib-roast.jpg?utm_source=vi.wikipedia.org',
        ),
      ).toBe('Standing-rib-roast.jpg');
    });

    it('extracts filename from a Commons thumb URL', () => {
      expect(
        provider.extractFileNameFromUrl(
          'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ot_Da_Lat_1.jpg/330px-Ot_Da_Lat_1.jpg',
        ),
      ).toBe('Ot_Da_Lat_1.jpg');
    });

    it('returns null for non-Commons (local wiki) uploads', () => {
      expect(
        provider.extractFileNameFromUrl(
          'https://upload.wikimedia.org/wikipedia/vi/1/1a/Local_only.jpg',
        ),
      ).toBeNull();
    });
  });

  it('returns empty array when entity has no images', async () => {
    const hits = await provider.searchByEntity({
      p18Files: [],
      aliasesVi: [],
      sources: [],
    });
    expect(hits).toEqual([]);
  });
});
