import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DishMatcherService, type DishCatalogMatcher } from './dish-matcher.service';
import { GooglePlacesClient, mapGooglePlace } from './google-places.client';
import { GeoapifyClient } from './geoapify.client';
import { keywordToCuisineRegex, keywordToStrictOsmRegex, OsmClient } from './osm.client';
import { PlaceIngestService } from './place-ingest.service';
import type { PlaceInput } from './place-input';

/** Không gọi lại nguồn ngoài cho cùng (từ khóa, ô lưới ~1km, bán kính) trong khoảng này. */
const CELL_TTL_MS = 12 * 60 * 60 * 1000;
/** Lỗi mạng/nguồn quá tải → chờ ngắn rồi mới thử lại. */
const ERROR_TTL_MS = 2 * 60 * 1000;
const CATALOG_TTL_MS = 30 * 60 * 1000;
/** Số quán tối đa lấy ảnh mỗi lần (Google Place Photos tính phí riêng). */
const MAX_PHOTOS_PER_FETCH = 10;
/** Warm-up theo khu vực (random theo vị trí): cache ô lưới 12h, lỗi thì 2 phút. */
const AREA_TTL_MS = 12 * 60 * 60 * 1000;
const AREA_ERROR_TTL_MS = 2 * 60 * 1000;
/** Thời gian tối đa chờ warm-up trong lúc random (ms). Hết giờ → tiếp tục với dữ liệu DB, job vẫn chạy nền. */
const AREA_WAIT_MS = Number(process.env.PLACES_AREA_WARMUP_WAIT_MS) || 6_000;
/** Từ khóa chung để Google Text Search trả về quán ăn quanh điểm (không ép theo tên món). */
const AREA_GOOGLE_QUERY = 'quán ăn';

export type LiveSource = 'GOOGLE' | 'GEOAPIFY' | 'OSM';

export interface AreaCoverageResult {
  /** 'HIT' = cache còn hạn, 'FETCHED' = vừa gọi nguồn ngoài xong, 'TIMEOUT' = đang chạy nền, 'SKIPPED' = không có nguồn/lỗi */
  status: 'HIT' | 'FETCHED' | 'TIMEOUT' | 'SKIPPED';
  source: LiveSource | null;
  placeCount: number;
  linkCount: number;
}

/** Khóa ô lưới ~1.1km (2 chữ số thập phân) + bán kính km. */
export function areaCellKey(lat: number, lng: number, radiusM: number): string {
  return `${lat.toFixed(2)}|${lng.toFixed(2)}|${Math.max(1, Math.round(radiusM / 1000))}`;
}

/**
 * Lấy quán trực tiếp từ nguồn ngoài khi DB chưa có đủ quán quanh người dùng, rồi lưu vào
 * `places` + `place_dishes` để lần sau đọc từ DB.
 * - Có GOOGLE_MAPS_API_KEY → Google Places (có sao, ảnh, giờ mở).
 * - Có GEOAPIFY_API_KEY → Geoapify Places (miễn phí 3.000 req/ngày, không cần thẻ tín dụng).
 * - Không có key (hoặc lỗi) → OpenStreetMap Overpass (miễn phí, không cần key).
 * Đặt PLACES_LIVE_OSM=false để tắt OSM.
 */
@Injectable()
export class GoogleLiveService {
  private readonly logger = new Logger(GoogleLiveService.name);
  private readonly google = GooglePlacesClient.fromEnv();
  private readonly geoapify = GeoapifyClient.fromEnv();
  private readonly osm =
    process.env.PLACES_LIVE_OSM === 'false'
      ? null
      : new OsmClient(process.env.OVERPASS_URL, {
          // 3 máy chủ × 10s → tối đa ~30s, dưới timeout 45s của app
          timeoutMs: Number(process.env.PLACES_LIVE_OSM_TIMEOUT_MS) || 10_000,
          retries: 0,
        });
  private readonly fetchedCells = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<{ saved: number; source: LiveSource | null }>>();
  private readonly areaInflight = new Map<string, Promise<AreaCoverageResult>>();
  private catalog: { matcher: DishCatalogMatcher; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: PlaceIngestService,
    private readonly matcherService: DishMatcherService,
  ) {
    const sources = [
      this.google && 'Google Places',
      this.geoapify && 'Geoapify (3k/day free)',
      this.osm && 'OpenStreetMap',
    ].filter(Boolean);
    this.logger.log(`Nguồn tìm quán trực tiếp: ${sources.join(' → ') || 'không có'}`);
  }

  get enabled(): boolean {
    return this.google != null || this.geoapify != null || this.osm != null;
  }

  private cellKey(query: string, lat: number, lng: number, radiusM: number) {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return `${q}|${lat.toFixed(2)}|${lng.toFixed(2)}|${Math.round(radiusM / 1000)}`;
  }

  private async getMatcher(): Promise<DishCatalogMatcher | undefined> {
    if (this.catalog && Date.now() - this.catalog.at < CATALOG_TTL_MS) return this.catalog.matcher;
    try {
      const matcher = await this.matcherService.loadCatalog();
      this.catalog = { matcher, at: Date.now() };
      return matcher;
    } catch (e) {
      this.logger.warn(`Không tải được catalog món: ${(e as Error).message}`);
      return undefined;
    }
  }

  /**
   * Tìm "<tên món>" quanh (lat,lng), lưu DB. Trả về số quán đã lưu + nguồn.
   * Không bao giờ throw — lỗi nguồn ngoài không được làm hỏng API nearby.
   */
  async fetchAndStore(opts: {
    query: string;
    dishId?: string | null;
    lat: number;
    lng: number;
    radiusM: number;
  }): Promise<{ saved: number; source: LiveSource | null }> {
    const none = { saved: 0, source: null };
    if (!this.enabled || !opts.query.trim()) return none;
    const key = this.cellKey(opts.query, opts.lat, opts.lng, opts.radiusM);
    const until = this.fetchedCells.get(key);
    if (until && Date.now() < until) return none;
    const running = this.inflight.get(key);
    if (running) return running;

    const job = this.run(opts)
      .then((r) => {
        this.fetchedCells.set(key, Date.now() + (r.failed ? ERROR_TTL_MS : CELL_TTL_MS));
        return { saved: r.saved, source: r.source };
      })
      .catch((e) => {
        this.logger.warn(`Tìm quán trực tiếp lỗi cho "${opts.query}": ${(e as Error).message}`);
        this.fetchedCells.set(key, Date.now() + ERROR_TTL_MS);
        return none;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Warm-up theo khu vực — dùng cho random theo vị trí (ràng buộc cứng bán kính)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Đảm bảo DB đã có quán quanh (lat,lng) trong bán kính: nếu ô lưới chưa được làm nóng
   * (hoặc đã hết hạn) thì gọi nguồn ngoài theo *category* (restaurant/fast_food/cafe),
   * match tên quán → món qua DishMatcherService và lưu `places` + `place_dishes`.
   *
   * - Chờ tối đa `waitMs` (mặc định 6s). Hết giờ → trả `TIMEOUT`, job tiếp tục chạy nền để lần sau có dữ liệu.
   * - Không bao giờ throw.
   */
  async ensureAreaCoverage(opts: {
    lat: number;
    lng: number;
    radiusM: number;
    waitMs?: number;
  }): Promise<AreaCoverageResult> {
    const skipped: AreaCoverageResult = { status: 'SKIPPED', source: null, placeCount: 0, linkCount: 0 };
    if (!this.enabled) return skipped;
    const key = areaCellKey(opts.lat, opts.lng, opts.radiusM);

    try {
      const cached = await this.prisma.db.placeAreaCell.findUnique({ where: { cellKey: key } });
      if (cached && cached.expiresAt.getTime() > Date.now()) {
        return {
          status: 'HIT',
          source: (cached.source as LiveSource | null) ?? null,
          placeCount: cached.placeCount,
          linkCount: cached.linkCount,
        };
      }
    } catch (e) {
      this.logger.warn(`Đọc cache ô lưới lỗi (${key}): ${(e as Error).message}`);
    }

    let job = this.areaInflight.get(key);
    if (!job) {
      job = this.runArea(key, opts)
        .catch((e) => {
          this.logger.warn(`Warm-up khu vực lỗi (${key}): ${(e as Error).message}`);
          return skipped;
        })
        .finally(() => this.areaInflight.delete(key));
      this.areaInflight.set(key, job);
    }

    const waitMs = opts.waitMs ?? AREA_WAIT_MS;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<AreaCoverageResult>((resolve) => {
      timer = setTimeout(() => resolve({ status: 'TIMEOUT', source: null, placeCount: 0, linkCount: 0 }), waitMs);
      timer.unref?.();
    });
    try {
      return await Promise.race([job, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async runArea(key: string, opts: { lat: number; lng: number; radiusM: number }): Promise<AreaCoverageResult> {
    const started = Date.now();
    let inputs: PlaceInput[] = [];
    let source: LiveSource | null = null;
    let failed = false;

    // Thứ tự: Geoapify (rẻ, có category) → OSM (free) → Google (đắt, chỉ khi 2 nguồn trên không có gì)
    if (this.geoapify) {
      try {
        inputs = await this.geoapify.search({ lat: opts.lat, lng: opts.lng, radiusM: opts.radiusM, limit: 100 });
        if (inputs.length > 0) source = 'GEOAPIFY';
      } catch (e) {
        failed = true;
        this.logger.warn(`Warm-up Geoapify lỗi: ${(e as Error).message?.slice(0, 160)}`);
      }
    }
    if (!source && this.osm) {
      try {
        inputs = await this.osm.search({ lat: opts.lat, lng: opts.lng, radiusM: opts.radiusM, limit: 300 });
        if (inputs.length > 0) source = 'OSM';
        failed = false;
      } catch (e) {
        failed = true;
        this.logger.warn(`Warm-up OSM lỗi: ${(e as Error).message?.slice(0, 160)}`);
      }
    }
    if (!source && this.google) {
      try {
        inputs = await this.fromGoogle({ query: AREA_GOOGLE_QUERY, lat: opts.lat, lng: opts.lng, radiusM: opts.radiusM });
        if (inputs.length > 0) source = 'GOOGLE';
        failed = false;
      } catch (e) {
        failed = true;
        this.logger.warn(`Warm-up Google lỗi: ${(e as Error).message?.slice(0, 160)}`);
      }
    }

    let placeCount = 0;
    let linkCount = 0;
    if (inputs.length > 0) {
      const matcher = await this.getMatcher();
      if (matcher) {
        // Chỉ lưu link do matcher tìm được — KHÔNG ép link theo từ khóa để tránh gán sai món cho quán
        const report = await this.ingest.ingest(inputs, matcher);
        placeCount = report.placesCreated + report.placesUpdated;
        linkCount = report.dishLinksUpserted;
      }
    }

    const ttl = failed && !source ? AREA_ERROR_TTL_MS : AREA_TTL_MS;
    try {
      await this.prisma.db.placeAreaCell.upsert({
        where: { cellKey: key },
        create: {
          cellKey: key,
          lat: opts.lat,
          lng: opts.lng,
          radiusM: Math.round(opts.radiusM),
          source,
          placeCount,
          linkCount,
          expiresAt: new Date(Date.now() + ttl),
        },
        update: { source, placeCount, linkCount, expiresAt: new Date(Date.now() + ttl), fetchedAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`Ghi cache ô lưới lỗi (${key}): ${(e as Error).message}`);
    }

    this.logger.log(
      `Warm-up ${source ?? 'NONE'} @${opts.lat.toFixed(3)},${opts.lng.toFixed(3)} r=${Math.round(opts.radiusM)}m: ` +
        `tìm ${inputs.length}, lưu ${placeCount} quán, ${linkCount} liên kết món (${Date.now() - started}ms)`,
    );
    return { status: 'FETCHED', source, placeCount, linkCount };
  }

  private async run(opts: { query: string; dishId?: string | null; lat: number; lng: number; radiusM: number }) {
    let failed = false;
    if (this.google) {
      try {
        const inputs = await this.fromGoogle(opts);
        if (inputs.length > 0) return { ...(await this.store(inputs, opts, 'GOOGLE')), failed };
      } catch (e) {
        failed = true;
        this.logger.warn(`Google Places lỗi, chuyển sang Geoapify/OSM: ${(e as Error).message}`);
      }
    }
    if (this.geoapify) {
      try {
        const inputs = await this.fromGeoapify(opts);
        if (inputs.length > 0) return { ...(await this.store(inputs, opts, 'GEOAPIFY')), failed: false };
      } catch (e) {
        failed = true;
        this.logger.warn(`Geoapify Places lỗi, chuyển sang OSM: ${(e as Error).message}`);
      }
    }
    if (this.osm) {
      try {
        const inputs = await this.fromOsm(opts);
        failed = false;
        return { ...(await this.store(inputs, opts, 'OSM')), failed };
      } catch (e) {
        failed = true;
        this.logger.warn(`OpenStreetMap lỗi: ${(e as Error).message?.slice(0, 160)}`);
      }
    }
    return { saved: 0, source: null as LiveSource | null, failed };
  }

  private async fromGeoapify(opts: { query: string; lat: number; lng: number; radiusM: number }): Promise<PlaceInput[]> {
    return this.geoapify!.search({
      query: opts.query,
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM,
      limit: 50,
    });
  }

  private async store(inputs: PlaceInput[], opts: { query: string; dishId?: string | null; lat: number; lng: number }, source: LiveSource) {
    const matcher = await this.getMatcher();
    const saved = await this.ingest.ingestForDish(inputs, opts.dishId ?? null, matcher);
    this.logger.log(
      `${source} "${opts.query}" @${opts.lat.toFixed(3)},${opts.lng.toFixed(3)}: tìm ${inputs.length}, lưu ${saved.length} quán`,
    );
    return { saved: saved.length, source };
  }

  private async fromOsm(opts: { query: string; lat: number; lng: number; radiusM: number }): Promise<PlaceInput[]> {
    return this.osm!.search({
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM,
      nameRegex: keywordToStrictOsmRegex(opts.query),
      cuisineRegex: keywordToCuisineRegex(opts.query),
      limit: 80,
    });
  }

  private async fromGoogle(opts: { query: string; lat: number; lng: number; radiusM: number }): Promise<PlaceInput[]> {
    const client = this.google!;
    const raw = await client.searchText({
      query: opts.query,
      lat: opts.lat,
      lng: opts.lng,
      radiusM: opts.radiusM,
      maxResults: 20,
    });

    // Chỉ lấy ảnh cho quán chưa có thumbnail trong DB
    const ids = raw.map((p) => p.id).filter(Boolean);
    const existing = await this.prisma.db.place.findMany({
      where: { provider: 'GOOGLE', providerPlaceId: { in: ids } },
      select: { providerPlaceId: true, thumbnailUrl: true },
    });
    const thumbs = new Map(existing.map((e) => [e.providerPlaceId, e.thumbnailUrl]));

    const inputs: PlaceInput[] = [];
    let photoBudget = MAX_PHOTOS_PER_FETCH;
    for (const p of raw) {
      let thumb = thumbs.get(p.id) ?? null;
      const photoName = p.photos?.[0]?.name;
      if (!thumb && photoName && photoBudget > 0) {
        photoBudget--;
        thumb = await client.photoUrl(photoName);
      }
      const mapped = mapGooglePlace(p, thumb);
      if (mapped) inputs.push(mapped);
    }
    return inputs;
  }
}
