import { PixabayProvider } from './pixabay.provider';

describe('PixabayProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('skips searching when PIXABAY_API_KEY is not set', async () => {
    const config = { get: jest.fn().mockReturnValue('') };
    const provider = new PixabayProvider(config as any);
    const hits = await provider.searchMultiLanguage('ớt', 'chili');
    expect(hits).toEqual([]);
  });

  it('searches with Pixabay API when key is configured', async () => {
    const config = { get: jest.fn().mockReturnValue('mock-pixabay-key') };
    const provider = new PixabayProvider(config as any);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          {
            id: 12345,
            pageURL: 'https://pixabay.com/photos/chili-12345/',
            previewURL: 'https://cdn.pixabay.com/p_150.jpg',
            largeImageURL: 'https://cdn.pixabay.com/large.jpg',
            imageWidth: 1920,
            imageHeight: 1080,
            tags: 'chili, pepper, red',
            user: 'photographer1',
          },
        ],
      }),
    });

    const hits = await provider.searchMultiLanguage('ớt', 'chili pepper', 5);
    expect(hits.length).toBe(1);
    expect(hits[0].tier).toBe('B');
    expect(hits[0].provider).toBe('pixabay');
    expect(hits[0].licenseCode).toBe('Pixabay License');
    expect(hits[0].tags).toEqual(['chili', 'pepper', 'red']);
    expect(hits[0].author).toBe('photographer1');
  });
});
