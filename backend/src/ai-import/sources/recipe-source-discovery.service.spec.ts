import {
  DEFAULT_RECIPE_TRUSTED_DOMAINS,
  RecipeSourceDiscoveryService,
  titleMatchesDish,
  WebSearchProvider,
} from './recipe-source-discovery.service';
import { JsonLdWebsiteAdapter } from './json-ld-website.adapter';

function recipeHtml(opts: {
  name: string;
  steps: Array<{ name: string; images?: string[] }>;
  video?: string;
  ingredients?: string[];
}): string {
  const steps = opts.steps.map((s) => ({
    '@type': 'HowToStep',
    name: s.name,
    text: `${s.name} chi tiết`,
    ...(s.images ? { image: s.images } : {}),
  }));
  const json = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: opts.name,
    recipeIngredient: opts.ingredients ?? ['500 g bún', '1 kg giò heo'],
    recipeInstructions: steps,
    ...(opts.video ? { video: { '@type': 'VideoObject', name: opts.name, embedUrl: opts.video } } : {}),
  };
  return `<html><script type="application/ld+json">${JSON.stringify(json)}</script></html>`;
}

function build(opts: {
  enabled?: boolean;
  pages?: Record<string, string>;
  fetchError?: string[];
  trusted?: string;
}) {
  const fetcher = {
    fetch: jest.fn(async (url: string) => {
      if (opts.fetchError?.includes(url)) throw new Error('blocked');
      const body = opts.pages?.[url];
      if (body == null) throw new Error(`no page for ${url}`);
      return { finalUrl: url, contentType: 'text/html', body };
    }),
  };
  const config = { get: jest.fn((key: string) => (key === 'AI_IMPORT_RECIPE_TRUSTED_DOMAINS' ? opts.trusted : undefined)) };
  const flags = { websiteJsonLdEnabled: () => opts.enabled ?? true };
  const service = new RecipeSourceDiscoveryService(
    config as never,
    flags as never,
    fetcher as never,
    new JsonLdWebsiteAdapter(),
  );
  return { service, fetcher };
}

/** Mock Tavily: lọc kết quả theo include_domains giống hành vi thật. */
function searchProvider(table: Record<string, Array<{ url: string; title: string }>>): WebSearchProvider & { searchWeb: jest.Mock } {
  return {
    searchWeb: jest.fn(async (query: string, options?: { includeDomains?: string[] }) => {
      const key = options?.includeDomains?.includes('youtube.com') ? `yt:${query}` : query;
      const hits = table[key] ?? [];
      const domains = options?.includeDomains;
      if (!domains?.length) return hits;
      return hits.filter((hit) => {
        const host = new URL(hit.url).hostname.replace(/^www\./, '');
        return domains.some((d) => host === d || host.endsWith(`.${d}`));
      });
    }),
  };
}

describe('titleMatchesDish', () => {
  it('matches exact and partial titles ignoring diacritics', () => {
    expect(titleMatchesDish('Cách nấu BÚN BÒ HUẾ chuẩn vị', 'Bún bò Huế')).toBe(true);
    expect(titleMatchesDish('Cach nau bun bo chuan Hue', 'Bún bò Huế')).toBe(true);
    expect(titleMatchesDish('Cơm tấm sườn bì', 'Bún bò Huế')).toBe(false);
  });
});

describe('RecipeSourceDiscoveryService', () => {
  it('returns WEBSITE_JSONLD_DISABLED warning when flag is off', async () => {
    const { service } = build({ enabled: false });
    const search = searchProvider({});
    const result = await service.discover('Bún bò Huế', search);
    expect(result.warnings).toContain('WEBSITE_JSONLD_DISABLED');
    expect(search.searchWeb).not.toHaveBeenCalled();
    expect(result.best).toBeNull();
  });

  it('uses default trusted domains and allows env override', () => {
    expect(build({}).service.trustedDomains()).toEqual(DEFAULT_RECIPE_TRUSTED_DOMAINS);
    expect(build({ trusted: 'a.com, b.vn' }).service.trustedDomains()).toEqual(['a.com', 'b.vn']);
  });

  it('searches trusted domains, fetches JSON-LD and picks the best source with step images + video', async () => {
    const dmx = 'https://www.dienmayxanh.com/vao-bep/bun-bo-hue';
    const cooky = 'https://www.cooky.vn/cong-thuc/bun-bo-hue';
    const untrusted = 'https://random-blog.com/bun-bo';
    const { service, fetcher } = build({
      pages: {
        [dmx]: recipeHtml({
          name: 'Cách nấu bún bò Huế',
          steps: [
            { name: 'Sơ chế', images: ['https://cdn.tgdd.vn/1.jpg'] },
            { name: 'Hầm xương', images: ['https://cdn.tgdd.vn/2.jpg'] },
            { name: 'Nấu nước dùng', images: ['https://cdn.tgdd.vn/3.jpg'] },
            { name: 'Hoàn thành', images: ['https://cdn.tgdd.vn/4.jpg'] },
          ],
          video: 'https://www.youtube.com/embed/YCaprrMJyoc',
        }),
        [cooky]: recipeHtml({
          name: 'Bún bò Huế',
          steps: [{ name: 'Nấu' }, { name: 'Ăn' }],
        }),
      },
    });
    const search = searchProvider({
      'cách nấu Bún bò Huế': [
        { url: untrusted, title: 'Bún bò' },
        { url: dmx, title: 'Cách nấu bún bò Huế' },
        { url: cooky, title: 'Bún bò Huế' },
      ],
    });

    const result = await service.discover('Bún bò Huế', search);

    // Tìm theo từng domain ưu tiên trước (DMX đầu tiên), rồi gộp chung khi chưa đủ ứng viên.
    expect(search.searchWeb).toHaveBeenCalledWith(
      'cách nấu Bún bò Huế',
      expect.objectContaining({ includeDomains: ['dienmayxanh.com'] }),
    );
    expect(search.searchWeb).toHaveBeenCalledWith(
      'cách nấu Bún bò Huế',
      expect.objectContaining({ includeDomains: DEFAULT_RECIPE_TRUSTED_DOMAINS }),
    );
    // Untrusted domain is never fetched.
    expect(fetcher.fetch).not.toHaveBeenCalledWith(untrusted);
    expect(result.candidates.map((c) => c.url)).toEqual([dmx, cooky]);
    expect(result.sources).toHaveLength(2);
    expect(result.best?.url).toBe(dmx);
    expect(result.best?.stepsWithImages).toBe(4);
    expect(result.best?.hasVideo).toBe(true);
    expect(result.best?.titleMatches).toBe(true);
    expect(result.videoUrl).toBe('https://www.youtube.com/watch?v=YCaprrMJyoc');
    expect(result.videoSource).toBe('JSON_LD');
    expect(result.warnings).not.toContain('NO_VIDEO_FOUND');
  });

  it('falls back to Tavily youtube search when no VideoObject is present', async () => {
    const cooky = 'https://www.cooky.vn/cong-thuc/bun-bo-hue';
    const { service } = build({
      pages: { [cooky]: recipeHtml({ name: 'Bún bò Huế', steps: [{ name: 'Nấu' }] }) },
    });
    const search = searchProvider({
      'cách nấu Bún bò Huế': [{ url: cooky, title: 'Bún bò Huế' }],
      'cách làm Bún bò Huế': [],
      'yt:cách nấu Bún bò Huế': [
        { url: 'https://www.youtube.com/watch?v=abcdef123', title: 'Cơm tấm sườn' },
        { url: 'https://www.youtube.com/watch?v=xyz987654', title: 'Cách nấu BÚN BÒ HUẾ ngon' },
      ],
    });

    const result = await service.discover('Bún bò Huế', search);
    expect(result.videoUrl).toBe('https://www.youtube.com/watch?v=xyz987654');
    expect(result.videoSource).toBe('TAVILY_YOUTUBE');
    expect(result.videoTitle).toContain('BÚN BÒ HUẾ');
  });

  it('is fail-soft: fetch errors and pages without JSON-LD only produce warnings', async () => {
    const broken = 'https://www.dienmayxanh.com/broken';
    const plain = 'https://www.cooky.vn/plain';
    const { service } = build({
      pages: { [plain]: '<html><body>no json-ld</body></html>' },
      fetchError: [broken],
    });
    const search = searchProvider({
      'cách nấu Món X': [
        { url: broken, title: 'Món X' },
        { url: plain, title: 'Món X' },
      ],
      'yt:cách nấu Món X': [],
    });

    const result = await service.discover('Món X', search);
    expect(result.best).toBeNull();
    expect(result.sources).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining(['SOURCE_FETCH_FAILED:dienmayxanh.com', 'NO_JSON_LD:cooky.vn', 'NO_VIDEO_FOUND']),
    );
  });

  it('skips search hits whose title does not match the dish', async () => {
    const wrong = 'https://www.dienmayxanh.com/vao-bep/bun-rieu';
    const { service, fetcher } = build({
      pages: { [wrong]: recipeHtml({ name: 'Bún riêu', steps: [{ name: 'Nấu' }] }) },
    });
    const search = searchProvider({
      'cách nấu Bún bò Huế': [{ url: wrong, title: 'Cách nấu bún riêu cua' }],
      'cách làm Bún bò Huế': [],
      'yt:cách nấu Bún bò Huế': [],
    });
    const result = await service.discover('Bún bò Huế', search);
    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(result.candidates).toEqual([]);
    expect(result.warnings).toContain('NO_RECIPE_SOURCE_FOUND');
  });

  it('warns NO_RECIPE_SOURCE_FOUND when search yields nothing', async () => {
    const { service } = build({});
    const search = searchProvider({});
    const result = await service.discover('Món Y', search, { includeVideo: false });
    expect(result.warnings).toContain('NO_RECIPE_SOURCE_FOUND');
    expect(result.videoUrl).toBeNull();
  });
});
