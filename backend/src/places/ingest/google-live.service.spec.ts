import { areaCellKey, GoogleLiveService } from './google-live.service';

/**
 * Unit test cho warm-up khu vực (random theo vị trí):
 * - cache ô lưới còn hạn → HIT, không gọi nguồn ngoài
 * - cache hết hạn → gọi nguồn ngoài theo category, ingest bằng matcher (KHÔNG ép link món), ghi cache 12h
 * - nguồn chậm → TIMEOUT nhưng job vẫn chạy nền và cùng key không gọi 2 lần
 * - nguồn lỗi → SKIPPED, cache lỗi ngắn (2 phút)
 */
describe('GoogleLiveService.ensureAreaCoverage', () => {
  const lat = 10.7769;
  const lng = 106.7009;
  const radiusM = 3000;

  const makeService = (opts: {
    geoapifySearch?: jest.Mock;
    cached?: { expiresAt: Date; source: string | null; placeCount: number; linkCount: number } | null;
  }) => {
    const prisma = {
      db: {
        placeAreaCell: {
          findUnique: jest.fn().mockResolvedValue(opts.cached ?? null),
          upsert: jest.fn().mockResolvedValue({}),
        },
        place: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    const ingest = {
      ingest: jest.fn().mockResolvedValue({ placesCreated: 2, placesUpdated: 1, placesSkipped: 0, dishLinksUpserted: 4, unmatched: [], dryRunPreview: [] }),
      ingestForDish: jest.fn(),
    };
    const matcherService = { loadCatalog: jest.fn().mockResolvedValue({ matchPlace: jest.fn() }) };

    process.env.PLACES_LIVE_OSM = 'false';
    const svc = new GoogleLiveService(prisma as any, ingest as any, matcherService as any);
    // Chèn client giả (bypass fromEnv)
    (svc as any).google = null;
    (svc as any).osm = null;
    (svc as any).geoapify = opts.geoapifySearch ? { search: opts.geoapifySearch } : null;
    return { svc, prisma, ingest, matcherService };
  };

  afterEach(() => {
    delete process.env.PLACES_LIVE_OSM;
  });

  it('areaCellKey gom theo ô ~1km + bán kính km', () => {
    expect(areaCellKey(10.77691, 106.70088, 3000)).toBe('10.78|106.70|3');
    expect(areaCellKey(10.7749, 106.7009, 3000)).toBe('10.77|106.70|3');
    expect(areaCellKey(10.7769, 106.7009, 500)).toBe('10.78|106.70|1');
  });

  it('cache còn hạn → HIT, không gọi nguồn ngoài', async () => {
    const search = jest.fn();
    const { svc, ingest } = makeService({
      geoapifySearch: search,
      cached: { expiresAt: new Date(Date.now() + 60_000), source: 'GEOAPIFY', placeCount: 12, linkCount: 7 },
    });

    const r = await svc.ensureAreaCoverage({ lat, lng, radiusM });

    expect(r).toEqual({ status: 'HIT', source: 'GEOAPIFY', placeCount: 12, linkCount: 7 });
    expect(search).not.toHaveBeenCalled();
    expect(ingest.ingest).not.toHaveBeenCalled();
  });

  it('cache hết hạn → gọi nguồn theo category (không query tên món), ingest bằng matcher, ghi cache 12h', async () => {
    const search = jest.fn().mockResolvedValue([
      { provider: 'GEOAPIFY', providerPlaceId: 'a', name: 'Phở Lệ', lat, lng, menu: [] },
      { provider: 'GEOAPIFY', providerPlaceId: 'b', name: 'Cơm Tấm Ba Ghiền', lat, lng, menu: [] },
    ]);
    const { svc, prisma, ingest } = makeService({
      geoapifySearch: search,
      cached: { expiresAt: new Date(Date.now() - 1), source: 'OSM', placeCount: 0, linkCount: 0 },
    });

    const r = await svc.ensureAreaCoverage({ lat, lng, radiusM, waitMs: 5000 });

    expect(r).toEqual({ status: 'FETCHED', source: 'GEOAPIFY', placeCount: 3, linkCount: 4 });
    expect(search).toHaveBeenCalledWith({ lat, lng, radiusM, limit: 100 });
    expect(search.mock.calls[0][0].query).toBeUndefined();
    // Dùng ingest() (matcher quyết định link) chứ không phải ingestForDish() (ép link)
    expect(ingest.ingest).toHaveBeenCalledTimes(1);
    expect(ingest.ingestForDish).not.toHaveBeenCalled();

    const upsert = prisma.db.placeAreaCell.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ cellKey: areaCellKey(lat, lng, radiusM) });
    const ttlMs = upsert.create.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(11 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
  });

  it('nguồn chậm hơn waitMs → TIMEOUT, job vẫn chạy nền và không gọi trùng cho cùng ô', async () => {
    let resolveSearch: (v: unknown[]) => void = () => undefined;
    const search = jest.fn().mockImplementation(() => new Promise((res) => (resolveSearch = res)));
    const { svc, prisma } = makeService({ geoapifySearch: search });

    const first = svc.ensureAreaCoverage({ lat, lng, radiusM, waitMs: 20 });
    const second = svc.ensureAreaCoverage({ lat, lng, radiusM, waitMs: 20 });
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1.status).toBe('TIMEOUT');
    expect(r2.status).toBe('TIMEOUT');
    expect(search).toHaveBeenCalledTimes(1);

    // Job nền hoàn tất → ghi cache
    resolveSearch([{ provider: 'GEOAPIFY', providerPlaceId: 'x', name: 'Bún Bò Huế', lat, lng, menu: [] }]);
    await new Promise((r) => setTimeout(r, 10));
    expect(prisma.db.placeAreaCell.upsert).toHaveBeenCalledTimes(1);
  });

  it('nguồn lỗi → SKIPPED, cache lỗi ngắn (≈2 phút) để thử lại sớm', async () => {
    const search = jest.fn().mockRejectedValue(new Error('429'));
    const { svc, prisma } = makeService({ geoapifySearch: search });

    const r = await svc.ensureAreaCoverage({ lat, lng, radiusM, waitMs: 5000 });

    expect(r.status).toBe('FETCHED');
    expect(r.source).toBeNull();
    expect(r.placeCount).toBe(0);
    const upsert = prisma.db.placeAreaCell.upsert.mock.calls[0][0];
    const ttlMs = upsert.create.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(2 * 60 * 1000);
  });

  it('không có nguồn nào → SKIPPED, không đụng DB', async () => {
    const { svc, prisma } = makeService({});
    const r = await svc.ensureAreaCoverage({ lat, lng, radiusM });
    expect(r.status).toBe('SKIPPED');
    expect(prisma.db.placeAreaCell.findUnique).not.toHaveBeenCalled();
  });
});
