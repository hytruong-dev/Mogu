import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineMeters } from '../places-geo.util';
import type { DishCatalogMatcher, DishMatch } from './dish-matcher.service';
import type { PlaceInput, PlaceMenuItem } from './place-input';

export interface IngestReport {
  placesCreated: number;
  placesUpdated: number;
  placesSkipped: number;
  dishLinksUpserted: number;
  unmatched: { name: string; provider: string; providerPlaceId: string }[];
  dryRunPreview: { name: string; provider: string; matches: Pick<DishMatch, 'dishName' | 'status' | 'score'>[] }[];
}

export function emptyReport(): IngestReport {
  return {
    placesCreated: 0,
    placesUpdated: 0,
    placesSkipped: 0,
    dishLinksUpserted: 0,
    unmatched: [],
    dryRunPreview: [],
  };
}

/** Same name + within 80m -> considered the same physical place across providers. */
const DUPLICATE_DISTANCE_M = 80;
/** Số quán upsert song song mỗi lô (giới hạn để không chiếm hết pool kết nối Prisma). */
const INGEST_CONCURRENCY = 8;

@Injectable()
export class PlaceIngestService {
  private readonly logger = new Logger(PlaceIngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert normalized places + their dish links.
   * - Places keyed by (provider, providerPlaceId); crawled data stays `isVerified=false`.
   * - OSM places that duplicate an existing (e.g. ShopeeFood) place nearby are skipped.
   * - Existing CONFIRMED/REJECTED links set by admins are never downgraded/overwritten.
   */
  async ingest(
    inputs: PlaceInput[],
    matcher: DishCatalogMatcher,
    opts: { dryRun?: boolean; report?: IngestReport; concurrency?: number } = {},
  ): Promise<IngestReport> {
    const report = opts.report ?? emptyReport();
    const concurrency = Math.max(1, opts.concurrency ?? INGEST_CONCURRENCY);

    const processOne = async (input: PlaceInput) => {
      if (input.lat == null || input.lng == null) {
        report.placesSkipped++;
        return;
      }
      const matches = matcher.matchPlace(input.name, input.menu ?? []);
      if (matches.length === 0) {
        report.unmatched.push({ name: input.name, provider: input.provider, providerPlaceId: input.providerPlaceId });
      }

      if (opts.dryRun) {
        report.dryRunPreview.push({
          name: input.name,
          provider: input.provider,
          matches: matches.slice(0, 5).map((m) => ({ dishName: m.dishName, status: m.status, score: m.score })),
        });
        return;
      }

      if (input.provider === 'OSM' && (await this.hasNearbyDuplicate(input))) {
        report.placesSkipped++;
        return;
      }

      const { placeId, created } = await this.upsertPlace(input);
      if (created) report.placesCreated++;
      else report.placesUpdated++;
      report.dishLinksUpserted += await this.upsertDishLinks(placeId, matches);
    };

    // Ưu tiên quán có khớp món lên trước để warm-up đồng bộ (có timeout) kịp lưu link hữu ích;
    // quán không khớp món vẫn được lưu nhưng xử lý sau.
    const ordered = [...inputs].sort((a, b) => {
      const am = matcher.matchPlace(a.name, a.menu ?? []).length > 0 ? 0 : 1;
      const bm = matcher.matchPlace(b.name, b.menu ?? []).length > 0 ? 0 : 1;
      return am - bm;
    });

    // Chạy song song theo lô nhỏ: DB remote có RTT lớn, xử lý tuần tự ~100 quán mất >10s.
    for (let i = 0; i < ordered.length; i += concurrency) {
      const batch = ordered.slice(i, i + concurrency);
      await Promise.all(
        batch.map((input) =>
          processOne(input).catch((e) => {
            report.placesSkipped++;
            this.logger.warn(`Ingest quán "${input.name}" lỗi: ${(e as Error).message?.slice(0, 160)}`);
          }),
        ),
      );
    }
    return report;
  }

  /**
   * Lưu quán tìm được từ Google theo tên 1 món: upsert quán + liên kết LIKELY với món đó
   * (không hạ cấp quyết định của admin). Trả về số quán đã lưu.
   */
  async ingestForDish(inputs: PlaceInput[], dishId: string | null, matcher?: DishCatalogMatcher): Promise<string[]> {
    const saved: string[] = [];
    for (const input of inputs) {
      if (input.lat == null || input.lng == null) continue;
      const { placeId } = await this.upsertPlace(input);
      saved.push(placeId);
      const matches: DishMatch[] = matcher ? matcher.matchPlace(input.name, input.menu ?? []) : [];
      if (dishId && !matches.some((m) => m.dishId === dishId)) {
        matches.push({
          dishId,
          dishName: '',
          status: 'LIKELY',
          score: 0.7,
          sourceItemName: null,
          priceVnd: null,
        });
      }
      await this.upsertDishLinks(placeId, matches);
    }
    return saved;
  }

  private async hasNearbyDuplicate(input: PlaceInput): Promise<boolean> {
    const lat = input.lat as number;
    const lng = input.lng as number;
    const d = 0.001; // ~110m
    const rows = await this.prisma.db.place.findMany({
      where: {
        provider: { not: 'OSM' },
        lat: { gte: lat - d, lte: lat + d },
        lng: { gte: lng - d, lte: lng + d },
      },
      select: { name: true, lat: true, lng: true },
      take: 20,
    });
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const name = norm(input.name);
    return rows.some(
      (r) =>
        (norm(r.name).includes(name) || name.includes(norm(r.name))) &&
        haversineMeters(lat, lng, Number(r.lat), Number(r.lng)) <= DUPLICATE_DISTANCE_M,
    );
  }

  private async upsertPlace(input: PlaceInput): Promise<{ placeId: string; created: boolean }> {
    const data = {
      name: input.name,
      addressShort: input.addressShort ?? null,
      lat: input.lat != null ? new Prisma.Decimal(input.lat.toFixed(7)) : null,
      lng: input.lng != null ? new Prisma.Decimal(input.lng.toFixed(7)) : null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      ratingAvg: input.ratingAvg != null ? new Prisma.Decimal(input.ratingAvg.toFixed(2)) : null,
      ratingCount: input.ratingCount ?? null,
      priceMin: input.priceMin ?? null,
      priceMax: input.priceMax ?? null,
      openingHours: (input.openingHours ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      categoryTags: input.categoryTags ?? [],
      sourceUrl: input.sourceUrl ?? null,
      sourceMeta: (input.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
      isActive: true,
    };
    const existing = await this.prisma.db.place.findUnique({
      where: { provider_providerPlaceId: { provider: input.provider, providerPlaceId: input.providerPlaceId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.db.place.update({ where: { id: existing.id }, data });
      return { placeId: existing.id, created: false };
    }
    const created = await this.prisma.db.place.create({
      data: { ...data, provider: input.provider, providerPlaceId: input.providerPlaceId, isVerified: false },
      select: { id: true },
    });
    return { placeId: created.id, created: true };
  }

  /** Upsert links; never touch admin decisions (CONFIRMED stays, REJECTED stays). */
  async upsertDishLinks(placeId: string, matches: DishMatch[]): Promise<number> {
    if (matches.length === 0) return 0;
    const existing = await this.prisma.db.placeDish.findMany({
      where: { placeId, dishId: { in: matches.map((m) => m.dishId) } },
      select: { dishId: true, matchStatus: true },
    });
    const existingMap = new Map(existing.map((e) => [e.dishId, e.matchStatus]));
    let count = 0;
    for (const m of matches) {
      const prev = existingMap.get(m.dishId);
      if (prev === 'REJECTED') continue;
      const status = prev === 'CONFIRMED' ? 'CONFIRMED' : m.status;
      await this.prisma.db.placeDish.upsert({
        where: { placeId_dishId: { placeId, dishId: m.dishId } },
        create: {
          placeId,
          dishId: m.dishId,
          matchStatus: m.status,
          matchScore: new Prisma.Decimal(m.score.toFixed(3)),
          sourceItemName: m.sourceItemName,
          priceVnd: m.priceVnd,
        },
        update: {
          matchStatus: status,
          matchScore: new Prisma.Decimal(m.score.toFixed(3)),
          // Không xóa tên món/giá đã có (vd từ ShopeeFood) khi nguồn mới không có thực đơn
          ...(m.sourceItemName != null ? { sourceItemName: m.sourceItemName } : {}),
          ...(m.priceVnd != null ? { priceVnd: m.priceVnd } : {}),
        },
      });
      count++;
    }
    return count;
  }

  /** Re-run matching on stored `sourceMeta.menu` (after new dishes are added to the catalog). */
  async rematchAll(
    matcher: DishCatalogMatcher,
    opts: { provider?: string; dryRun?: boolean; batchSize?: number } = {},
  ): Promise<IngestReport> {
    const report = emptyReport();
    const batchSize = opts.batchSize ?? 200;
    let cursor: string | undefined;
    for (;;) {
      const places = await this.prisma.db.place.findMany({
        where: { isActive: true, ...(opts.provider ? { provider: opts.provider } : {}) },
        select: { id: true, name: true, provider: true, providerPlaceId: true, sourceMeta: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (places.length === 0) break;
      for (const p of places) {
        const menu = extractMenu(p.sourceMeta);
        const matches = matcher.matchPlace(p.name, menu);
        if (matches.length === 0) {
          report.unmatched.push({ name: p.name, provider: p.provider, providerPlaceId: p.providerPlaceId ?? '' });
          continue;
        }
        if (opts.dryRun) {
          report.dryRunPreview.push({
            name: p.name,
            provider: p.provider,
            matches: matches.slice(0, 5).map((m) => ({ dishName: m.dishName, status: m.status, score: m.score })),
          });
          continue;
        }
        report.dishLinksUpserted += await this.upsertDishLinks(p.id, matches);
        report.placesUpdated++;
      }
      cursor = places[places.length - 1].id;
    }
    this.logger.log(`Rematch done: ${report.dishLinksUpserted} links, ${report.unmatched.length} unmatched`);
    return report;
  }
}

function extractMenu(meta: unknown): PlaceMenuItem[] {
  const menu = (meta as any)?.menu;
  if (!Array.isArray(menu)) return [];
  return menu
    .filter((m: any) => m && typeof m.name === 'string')
    .map((m: any) => ({ name: m.name, priceVnd: typeof m.priceVnd === 'number' ? m.priceVnd : null }));
}
