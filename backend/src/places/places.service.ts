import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { GoogleLiveService, areaCellKey, type AreaCoverageResult } from './ingest/google-live.service';
import { PlaceDishMatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminListPlacesDto,
  AdminUpdatePlaceDishDto,
  AdminUpdatePlaceDto,
  NearbyPlacesDto,
  ResolvePlaceDto,
  SearchPlacesDto,
} from './places.dto';
import {
  boundingBox,
  computeOpenStatus,
  formatPriceRange,
  haversineMeters,
  isValidCoord,
  type OpenStatus,
} from './places-geo.util';

export const DEFAULT_NEARBY_RADIUS_KM = 3;
export const MAX_NEARBY_RADIUS_KM = 20;
/** Dưới số quán này trong DB thì bổ sung từ Google Maps. */
const GOOGLE_FILL_THRESHOLD = 5;

export type NearbyDishStat = {
  placeCount: number;
  nearestMeters: number;
  /** Số quán đang mở cửa (theo opening_hours; UNKNOWN không tính). */
  openCount: number;
  /** Rating cao nhất trong các quán bán món (null nếu nguồn không có rating). */
  bestRating: number | null;
  /** Có ít nhất 1 liên kết CONFIRMED (menu khớp chắc chắn / admin xác nhận). */
  hasConfirmed: boolean;
  /** Giá ước lượng từ các quán trong bán kính (percentile 25 và 75). */
  priceMin: number | null;
  priceMax: number | null;
  /** Số quán có thông tin giá. */
  pricedPlaceCount: number;
};

/** Một cặp (món, quán) trong vùng tìm kiếm — dùng để tổng hợp theo nhiều bán kính. */
export type NearbyDishPlaceRow = {
  dishId: string;
  placeId: string;
  distanceMeters: number;
  openStatus?: OpenStatus;
  ratingAvg?: number | null;
  matchStatus?: 'CONFIRMED' | 'LIKELY';
  placePriceMin?: number | null;
  placePriceMax?: number | null;
  dishPriceVnd?: number | null;
};

/** Liên kết quán ↔ món đủ tin cậy để random: CONFIRMED, hoặc LIKELY có matchScore >= ngưỡng (null = admin thêm tay). */
export const MIN_LINK_MATCH_SCORE = 0.6;
export const trustedPlaceDishWhere: Prisma.PlaceDishWhereInput = {
  OR: [
    { matchStatus: PlaceDishMatchStatus.CONFIRMED },
    {
      matchStatus: PlaceDishMatchStatus.LIKELY,
      OR: [{ matchScore: null }, { matchScore: { gte: MIN_LINK_MATCH_SCORE } }],
    },
  ],
};

export type MenuMatchStatus = 'CONFIRMED' | 'LIKELY' | 'UNKNOWN';

export interface PlaceDto {
  id: string;
  provider: string;
  providerPlaceId: string | null;
  name: string;
  addressShort: string | null;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  thumbnailUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceRange: string | null;
  openStatus: OpenStatus;
  sourceUrl: string | null;
  isVerified: boolean;
  categoryTags: string[];
  menuMatchStatus?: MenuMatchStatus;
  dishPriceVnd?: number | null;
  sourceItemName?: string | null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampRadiusKm(radiusKm?: number | null): number {
  const r = Number(radiusKm);
  if (!Number.isFinite(r) || r <= 0) return DEFAULT_NEARBY_RADIUS_KM;
  return Math.min(MAX_NEARBY_RADIUS_KM, Math.max(0.2, r));
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

/** Tổng hợp số quán + quán gần nhất cho mỗi món trong bán kính radiusM. */
export function aggregateNearbyDishes(
  rows: NearbyDishPlaceRow[],
  radiusM: number,
): Map<string, NearbyDishStat> {
  type Acc = {
    places: Set<string>;
    openPlaces: Set<string>;
    pricedPlaces: Set<string>;
    nearest: number;
    bestRating: number | null;
    hasConfirmed: boolean;
    mins: number[];
    maxs: number[];
  };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    if (r.distanceMeters > radiusM) continue;
    let a = acc.get(r.dishId);
    if (!a) {
      a = {
        places: new Set(),
        openPlaces: new Set(),
        pricedPlaces: new Set(),
        nearest: r.distanceMeters,
        bestRating: null,
        hasConfirmed: false,
        mins: [],
        maxs: [],
      };
      acc.set(r.dishId, a);
    }
    a.places.add(r.placeId);
    if (r.openStatus === 'OPEN') a.openPlaces.add(r.placeId);
    if (r.distanceMeters < a.nearest) a.nearest = r.distanceMeters;
    if (r.ratingAvg != null && Number.isFinite(r.ratingAvg) && (a.bestRating == null || r.ratingAvg > a.bestRating)) {
      a.bestRating = r.ratingAvg;
    }
    if (r.matchStatus === 'CONFIRMED') a.hasConfirmed = true;

    // Giá: ưu tiên dishPriceVnd (menu món cụ thể); nếu không có thì dùng placePriceMin / placePriceMax
    const pMin =
      r.dishPriceVnd && r.dishPriceVnd > 0
        ? r.dishPriceVnd
        : r.placePriceMin && r.placePriceMin > 0
          ? r.placePriceMin
          : null;
    const pMax =
      r.dishPriceVnd && r.dishPriceVnd > 0
        ? r.dishPriceVnd
        : r.placePriceMax && r.placePriceMax > 0
          ? r.placePriceMax
          : null;

    if (pMin != null || pMax != null) {
      a.pricedPlaces.add(r.placeId);
      if (pMin != null) a.mins.push(pMin);
      if (pMax != null) a.maxs.push(pMax);
    }
  }

  const out = new Map<string, NearbyDishStat>();
  for (const [dishId, a] of acc) {
    let estMin: number | null = null;
    let estMax: number | null = null;

    if (a.mins.length > 0) {
      a.mins.sort((x, y) => x - y);
      estMin = computePercentile(a.mins, 0.25);
    }
    if (a.maxs.length > 0) {
      a.maxs.sort((x, y) => x - y);
      estMax = computePercentile(a.maxs, 0.75);
    }

    if (estMin != null && estMax != null) {
      if (estMax < estMin) estMax = estMin;
    } else if (estMin != null) {
      estMax = estMin;
    } else if (estMax != null) {
      estMin = estMax;
    }

    out.set(dishId, {
      placeCount: a.places.size,
      nearestMeters: a.nearest,
      openCount: a.openPlaces.size,
      bestRating: a.bestRating,
      hasConfirmed: a.hasConfirmed,
      priceMin: estMin,
      priceMax: estMax,
      pricedPlaceCount: a.pricedPlaces.size,
    });
  }
  return out;
}

const NEARBY_CACHE_TTL_MS = 120_000; // 2 phút
const MAX_CACHE_CELLS = 200;

interface CachedNearbyLink {
  dishId: string;
  placeId: string;
  matchStatus: string;
  priceVnd: any;
  place: {
    lat: any;
    lng: any;
    openingHours: any;
    ratingAvg: any;
    priceMin: any;
    priceMax: any;
  };
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly nearbyCache = new Map<string, { links: CachedNearbyLink[]; cachedAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly googleLive?: GoogleLiveService,
  ) {}

  /** Xoá cache quán gần trong RAM (ví dụ: khi vừa ingest thêm quán từ nguồn ngoài). */
  invalidateNearbyCache(lat?: number, lng?: number, radiusM?: number) {
    if (lat != null && lng != null && radiusM != null) {
      const key = areaCellKey(lat, lng, radiusM);
      this.nearbyCache.delete(key);
    } else {
      this.nearbyCache.clear();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Mapping
  // ════════════════════════════════════════════════════════════════════════════
  map(p: any, userLat?: number, userLng?: number): PlaceDto {
    const lat = toNum(p.lat);
    const lng = toNum(p.lng);
    let distanceMeters: number | null = null;
    if (userLat != null && userLng != null && lat != null && lng != null) {
      distanceMeters = haversineMeters(userLat, userLng, lat, lng);
    }
    const priceMin = toNum(p.priceMin);
    const priceMax = toNum(p.priceMax);
    return {
      id: p.id,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId ?? null,
      name: p.name,
      addressShort: p.addressShort ?? null,
      lat,
      lng,
      distanceMeters,
      thumbnailUrl: p.thumbnailUrl ?? null,
      ratingAvg: toNum(p.ratingAvg),
      ratingCount: toNum(p.ratingCount),
      priceMin,
      priceMax,
      priceRange: formatPriceRange(priceMin, priceMax),
      openStatus: computeOpenStatus(p.openingHours),
      sourceUrl: p.sourceUrl ?? null,
      isVerified: !!p.isVerified,
      categoryTags: Array.isArray(p.categoryTags) ? p.categoryTags : [],
    };
  }

  private bboxWhere(lat: number, lng: number, radiusM: number): Prisma.PlaceWhereInput {
    const b = boundingBox(lat, lng, radiusM);
    return {
      isActive: true,
      lat: { gte: b.minLat, lte: b.maxLat },
      lng: { gte: b.minLng, lte: b.maxLng },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Location-aware queries (dùng cho random + màn bản đồ)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Làm nóng dữ liệu quán quanh người dùng trước khi random (chờ tối đa ~6s, cache 12h).
   * Không throw — lỗi nguồn ngoài không được làm hỏng random.
   */
  async ensureAreaCoverage(lat: number, lng: number, radiusM: number): Promise<AreaCoverageResult> {
    const skipped: AreaCoverageResult = { status: 'SKIPPED', source: null, placeCount: 0, linkCount: 0 };
    if (!isValidCoord(lat, lng) || !this.googleLive?.enabled) return skipped;
    try {
      return await this.googleLive.ensureAreaCoverage({ lat, lng, radiusM });
    } catch (e) {
      this.logger.warn(`ensureAreaCoverage lỗi: ${(e as Error).message}`);
      return skipped;
    }
  }

  /** Tất cả cặp (món, quán) trong bán kính tối đa — gọi 1 lần, tổng hợp nhiều bán kính ở JS. */
  async findNearbyDishPlaceRows(lat: number, lng: number, maxRadiusM: number): Promise<NearbyDishPlaceRow[]> {
    if (!isValidCoord(lat, lng)) return [];
    const cellKey = areaCellKey(lat, lng, maxRadiusM);
    const cached = this.nearbyCache.get(cellKey);
    let links: CachedNearbyLink[];

    if (cached && Date.now() - cached.cachedAt < NEARBY_CACHE_TTL_MS) {
      links = cached.links;
    } else {
      links = (await this.prisma.db.placeDish.findMany({
        where: {
          AND: [trustedPlaceDishWhere, { place: this.bboxWhere(lat, lng, maxRadiusM) }],
        },
        select: {
          dishId: true,
          placeId: true,
          matchStatus: true,
          priceVnd: true,
          place: {
            select: {
              lat: true,
              lng: true,
              openingHours: true,
              ratingAvg: true,
              priceMin: true,
              priceMax: true,
            },
          },
        },
        take: 20_000,
      })) as CachedNearbyLink[];

      if (this.nearbyCache.size >= MAX_CACHE_CELLS) {
        const oldestKey = this.nearbyCache.keys().next().value;
        if (oldestKey) this.nearbyCache.delete(oldestKey);
      }
      this.nearbyCache.set(cellKey, { links, cachedAt: Date.now() });
    }

    const now = new Date();
    const openCache = new Map<string, OpenStatus>();
    const rows: NearbyDishPlaceRow[] = [];
    for (const l of links) {
      const pLat = toNum(l.place.lat);
      const pLng = toNum(l.place.lng);
      if (pLat == null || pLng == null) continue;
      const d = haversineMeters(lat, lng, pLat, pLng);
      if (d > maxRadiusM) continue;
      let openStatus = openCache.get(l.placeId);
      if (!openStatus) {
        openStatus = computeOpenStatus(l.place.openingHours, now);
        openCache.set(l.placeId, openStatus);
      }
      rows.push({
        dishId: l.dishId,
        placeId: l.placeId,
        distanceMeters: d,
        openStatus,
        ratingAvg: toNum(l.place.ratingAvg),
        matchStatus: l.matchStatus === 'CONFIRMED' ? 'CONFIRMED' : 'LIKELY',
        placePriceMin: toNum(l.place.priceMin),
        placePriceMax: toNum(l.place.priceMax),
        dishPriceVnd: toNum(l.priceVnd),
      });
    }
    return rows;
  }

  /** Tổng số quán ăn (bất kỳ, kể cả chưa gán món) trong bán kính — để giải thích vì sao không có món. */
  async countPlacesWithin(lat: number, lng: number, radiusM: number): Promise<number> {
    if (!isValidCoord(lat, lng)) return 0;
    const places = await this.prisma.db.place.findMany({
      where: this.bboxWhere(lat, lng, radiusM),
      select: { lat: true, lng: true },
      take: 5_000,
    });
    let n = 0;
    for (const p of places) {
      const pLat = toNum(p.lat);
      const pLng = toNum(p.lng);
      if (pLat != null && pLng != null && haversineMeters(lat, lng, pLat, pLng) <= radiusM) n++;
    }
    return n;
  }

  /** Map dishId -> { placeCount, nearestMeters } cho các món có quán bán trong bán kính. */
  async findNearbyDishIds(lat: number, lng: number, radiusM: number): Promise<Map<string, NearbyDishStat>> {
    const rows = await this.findNearbyDishPlaceRows(lat, lng, radiusM);
    return aggregateNearbyDishes(rows, radiusM);
  }

  /** Quán bán 1 món cụ thể trong bán kính, sắp xếp theo khoảng cách (hoặc rating). */
  async findNearbyPlacesForDish(
    dishId: string,
    lat: number,
    lng: number,
    radiusM: number,
    limit = 20,
    sort: 'distance' | 'rating' = 'distance',
  ): Promise<PlaceDto[]> {
    if (!isValidCoord(lat, lng)) return [];
    const places = await this.prisma.db.place.findMany({
      where: {
        ...this.bboxWhere(lat, lng, radiusM),
        placeDishes: { some: { AND: [{ dishId }, trustedPlaceDishWhere] } },
      },
      include: {
        placeDishes: {
          where: { dishId },
          select: { matchStatus: true, priceVnd: true, sourceItemName: true },
          take: 1,
        },
      },
      take: 500,
    });
    const mapped = places
      .map((p) => {
        const dto = this.map(p, lat, lng);
        const link = p.placeDishes[0];
        dto.menuMatchStatus = link?.matchStatus === 'CONFIRMED' ? 'CONFIRMED' : 'LIKELY';
        dto.dishPriceVnd = link?.priceVnd ?? null;
        dto.sourceItemName = link?.sourceItemName ?? null;
        return dto;
      })
      .filter((p) => p.distanceMeters != null && p.distanceMeters <= radiusM);
    return this.sortPlaces(mapped, sort).slice(0, limit);
  }

  /** Fallback khi món chưa có liên kết PlaceDish: tìm theo tên món (bỏ dấu) trên tên quán/tags. */
  async findNearbyPlacesByName(
    keyword: string,
    lat: number,
    lng: number,
    radiusM: number,
    limit = 20,
  ): Promise<PlaceDto[]> {
    const q = keyword.trim();
    if (!q || !isValidCoord(lat, lng)) return [];
    const b = boundingBox(lat, lng, radiusM);
    const like = `%${q}%`;
    const ids = await this.prisma.db.$queryRaw<Array<{ id: string }>>`
      SELECT p.id::text AS id
      FROM places p
      WHERE p.is_active = TRUE
        AND p.lat BETWEEN ${b.minLat} AND ${b.maxLat}
        AND p.lng BETWEEN ${b.minLng} AND ${b.maxLng}
        AND (
          lower(unaccent(p.name)) LIKE lower(unaccent(${like}))
          OR EXISTS (
            SELECT 1 FROM unnest(p.category_tags) t
            WHERE lower(unaccent(t)) LIKE lower(unaccent(${like}))
          )
        )
      LIMIT 300
    `;
    if (ids.length === 0) return [];
    const places = await this.prisma.db.place.findMany({ where: { id: { in: ids.map((r) => r.id) } } });
    const mapped = places
      .map((p) => ({ ...this.map(p, lat, lng), menuMatchStatus: 'LIKELY' as MenuMatchStatus }))
      .filter((p) => p.distanceMeters != null && p.distanceMeters <= radiusM);
    return this.sortPlaces(mapped, 'distance').slice(0, limit);
  }

  private sortPlaces(list: PlaceDto[], sort: 'distance' | 'rating') {
    if (sort === 'rating') {
      return [...list].sort(
        (a, b) =>
          (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
          (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      );
    }
    return [...list].sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  }

  /** GET /places/nearby */
  async nearby(dto: NearbyPlacesDto) {
    const lat = Number(dto.lat);
    const lng = Number(dto.lng);
    if (!isValidCoord(lat, lng)) throw new BadRequestException('lat/lng không hợp lệ');
    const radiusKm = clampRadiusKm(dto.radiusKm);
    const radiusM = Math.round(radiusKm * 1000);
    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 50);
    const sort = dto.sort === 'rating' ? 'rating' : 'distance';

    let result = await this.queryNearby(dto, lat, lng, radiusM, limit, sort);

    // Ít quán trong DB → lấy trực tiếp từ Google Maps / Geoapify / OpenStreetMap, lưu lại rồi đọc DB lần nữa
    let source: 'DB' | 'GOOGLE' | 'GEOAPIFY' | 'OSM' = 'DB';
    const keyword = dto.q?.trim() || result.dishName;
    if (result.data.length < GOOGLE_FILL_THRESHOLD && keyword && this.googleLive?.enabled) {
      const live = await this.googleLive.fetchAndStore({
        query: keyword,
        dishId: dto.dishId ?? null,
        lat,
        lng,
        radiusM,
      });
      if (live.saved > 0 && live.source) {
        result = await this.queryNearby(dto, lat, lng, radiusM, limit, sort);
        source = live.source;
      }
    }

    return { data: result.data, radiusKm, matchMode: result.matchMode, total: result.data.length, source };
  }

  private async queryNearby(
    dto: NearbyPlacesDto,
    lat: number,
    lng: number,
    radiusM: number,
    limit: number,
    sort: 'distance' | 'rating',
  ) {
    let data: PlaceDto[] = [];
    let matchMode: 'LINKED' | 'NAME' | 'NONE' = 'NONE';
    let dishName: string | null = null;

    if (dto.dishId) {
      data = await this.findNearbyPlacesForDish(dto.dishId, lat, lng, radiusM, limit, sort);
      if (data.length > 0) matchMode = 'LINKED';
      const dish = await this.prisma.db.dish.findUnique({
        where: { id: dto.dishId },
        select: { name: true },
      });
      dishName = dish?.name ?? null;
    }

    const keyword = dto.q?.trim() || dishName;
    if (data.length === 0 && keyword) {
      data = this.sortPlaces(await this.findNearbyPlacesByName(keyword, lat, lng, radiusM, limit), sort);
      if (data.length > 0) matchMode = 'NAME';
    }
    return { data, matchMode, dishName };
  }

  /** GET /places/:id */
  async getDetail(id: string, userLat?: number, userLng?: number) {
    const p = await this.prisma.db.place.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
        placeDishes: {
          where: { matchStatus: { not: PlaceDishMatchStatus.REJECTED } },
          orderBy: [{ matchStatus: 'asc' }, { matchScore: 'desc' }],
          take: 30,
          select: {
            matchStatus: true,
            priceVnd: true,
            sourceItemName: true,
            dish: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Không tìm thấy địa điểm');
    const lat = userLat != null && Number.isFinite(Number(userLat)) ? Number(userLat) : undefined;
    const lng = userLng != null && Number.isFinite(Number(userLng)) ? Number(userLng) : undefined;
    return {
      ...this.map(p, lat, lng),
      openingHours: p.openingHours ?? null,
      postCount: p._count.posts,
      lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
      dishes: p.placeDishes.map((d) => ({
        dishId: d.dish.id,
        name: d.dish.name,
        slug: d.dish.slug,
        matchStatus: d.matchStatus,
        priceVnd: d.priceVnd,
        sourceItemName: d.sourceItemName,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Search / resolve (community place picker + fallback)
  // ════════════════════════════════════════════════════════════════════════════
  async search(dto: SearchPlacesDto) {
    const limit = Math.min(Number(dto.limit) || 20, 50);
    const q = dto.q?.trim();
    const userLat = dto.lat != null ? Number(dto.lat) : undefined;
    const userLng = dto.lng != null ? Number(dto.lng) : undefined;
    const textWhere: Prisma.PlaceWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { addressShort: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    // Có vị trí + bán kính → lọc thực sự trong bán kính, sắp theo khoảng cách
    if (dto.radiusKm != null && isValidCoord(userLat, userLng)) {
      const radiusM = Math.round(clampRadiusKm(dto.radiusKm) * 1000);
      const items = await this.prisma.db.place.findMany({
        where: { AND: [this.bboxWhere(userLat!, userLng!, radiusM), ...(textWhere ? [textWhere] : [])] },
        take: 500,
      });
      const mapped = this.sortPlaces(
        items
          .map((p) => this.map(p, userLat, userLng))
          .filter((p) => p.distanceMeters != null && p.distanceMeters <= radiusM),
        'distance',
      );
      return { data: mapped.slice(0, limit), nextCursor: null, hasMore: mapped.length > limit };
    }

    const items = await this.prisma.db.place.findMany({
      where: textWhere,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const mapped = data.map((p) => this.map(p, userLat, userLng));
    if (userLat != null && userLng != null) {
      mapped.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }
    return {
      data: mapped,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    };
  }

  async resolve(dto: ResolvePlaceDto) {
    if (dto.providerPlaceId) {
      const existing = await this.prisma.db.place.findUnique({
        where: {
          provider_providerPlaceId: {
            provider: dto.provider,
            providerPlaceId: dto.providerPlaceId,
          },
        },
      });
      if (existing) return this.map(existing);
    }

    const created = await this.prisma.db.place.create({
      data: {
        provider: dto.provider || 'LOCAL',
        providerPlaceId: dto.providerPlaceId ?? null,
        name: dto.name.trim(),
        addressShort: dto.addressShort ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        isVerified: Boolean(dto.providerPlaceId),
      },
    });
    return this.map(created);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Admin
  // ════════════════════════════════════════════════════════════════════════════
  private adminMap(p: any) {
    return {
      ...this.map(p),
      isVerified: p.isVerified,
      isActive: p.isActive,
      postCount: p._count?.posts ?? 0,
      dishCount: p._count?.placeDishes ?? 0,
      lastSyncedAt: p.lastSyncedAt ? new Date(p.lastSyncedAt).toISOString() : null,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    };
  }

  async adminList(dto: AdminListPlacesDto) {
    const limit = Math.min(Number(dto.limit) || 20, 100);
    const offset = Math.max(Number(dto.offset) || 0, 0);
    const q = dto.q?.trim();

    const and: Prisma.PlaceWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { addressShort: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.provider) and.push({ provider: dto.provider.toUpperCase() });
    if (dto.isVerified === 'true') and.push({ isVerified: true });
    if (dto.isVerified === 'false') and.push({ isVerified: false });
    if (dto.hasDishes === 'true') and.push({ placeDishes: { some: {} } });
    if (dto.hasDishes === 'false') and.push({ placeDishes: { none: {} } });
    const where: Prisma.PlaceWhereInput = and.length ? { AND: and } : {};

    const [items, total] = await Promise.all([
      this.prisma.db.place.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { _count: { select: { posts: true, placeDishes: true } } },
      }),
      this.prisma.db.place.count({ where }),
    ]);

    return {
      items: items.map((p) => this.adminMap(p)),
      total,
      hasMore: offset + items.length < total,
    };
  }

  async adminUpdate(id: string, dto: AdminUpdatePlaceDto) {
    const place = await this.prisma.db.place.findUnique({ where: { id } });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');

    const updated = await this.prisma.db.place.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? place.name,
        addressShort: dto.addressShort !== undefined ? dto.addressShort?.trim() || null : place.addressShort,
        lat: dto.lat !== undefined ? dto.lat : place.lat,
        lng: dto.lng !== undefined ? dto.lng : place.lng,
        thumbnailUrl: dto.thumbnailUrl !== undefined ? dto.thumbnailUrl?.trim() || null : place.thumbnailUrl,
        isVerified: dto.isVerified !== undefined ? dto.isVerified : place.isVerified,
        isActive: dto.isActive !== undefined ? dto.isActive : place.isActive,
      },
      include: { _count: { select: { posts: true, placeDishes: true } } },
    });

    return this.adminMap(updated);
  }

  async adminListDishes(id: string) {
    const place = await this.prisma.db.place.findUnique({ where: { id }, select: { id: true } });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');
    const rows = await this.prisma.db.placeDish.findMany({
      where: { placeId: id },
      orderBy: [{ matchStatus: 'asc' }, { matchScore: 'desc' }],
      include: { dish: { select: { id: true, name: true, slug: true } } },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        dishId: r.dishId,
        dishName: r.dish.name,
        dishSlug: r.dish.slug,
        matchStatus: r.matchStatus,
        matchScore: toNum(r.matchScore),
        priceVnd: r.priceVnd,
        sourceItemName: r.sourceItemName,
      })),
    };
  }

  /** Upsert / đổi trạng thái liên kết quán ↔ món (hoặc xóa khi remove=true). */
  async adminUpdateDish(id: string, dto: AdminUpdatePlaceDishDto) {
    const place = await this.prisma.db.place.findUnique({ where: { id }, select: { id: true } });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');
    if (dto.remove) {
      await this.prisma.db.placeDish.deleteMany({ where: { placeId: id, dishId: dto.dishId } });
      return { success: true };
    }
    const dish = await this.prisma.db.dish.findUnique({ where: { id: dto.dishId }, select: { id: true } });
    if (!dish) throw new NotFoundException('Không tìm thấy món ăn');
    const status = (dto.matchStatus ?? 'CONFIRMED') as PlaceDishMatchStatus;
    await this.prisma.db.placeDish.upsert({
      where: { placeId_dishId: { placeId: id, dishId: dto.dishId } },
      create: {
        placeId: id,
        dishId: dto.dishId,
        matchStatus: status,
        priceVnd: dto.priceVnd ?? null,
      },
      update: {
        matchStatus: status,
        ...(dto.priceVnd !== undefined ? { priceVnd: dto.priceVnd } : {}),
      },
    });
    return { success: true };
  }

  async adminDelete(id: string, force = false) {
    const place = await this.prisma.db.place.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');

    if (place._count.posts > 0) {
      if (!force) {
        throw new BadRequestException(
          `Địa điểm đang được gắn với ${place._count.posts} bài đăng cộng đồng. Vui lòng xác nhận xóa bắt buộc để gỡ khỏi bài đăng.`,
        );
      }
      await this.prisma.db.communityPost.updateMany({
        where: { placeId: id },
        data: { placeId: null },
      });
    }

    await this.prisma.db.place.delete({ where: { id } });
    return { success: true, id };
  }
}
