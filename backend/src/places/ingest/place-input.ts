import type { OpeningHoursEntry } from '../places-geo.util';

/** Provider values stored in `places.provider`. */
export type PlaceProvider = 'LOCAL' | 'GOOGLE' | 'SHOPEEFOOD' | 'OSM' | 'GEOAPIFY';

export interface PlaceMenuItem {
  name: string;
  priceVnd?: number | null;
}

/**
 * Normalized place shape produced by every ingest source (ShopeeFood, OSM, ...).
 * PlaceIngestService only works with this shape.
 */
export interface PlaceInput {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  addressShort?: string | null;
  lat?: number | null;
  lng?: number | null;
  thumbnailUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  openingHours?: OpeningHoursEntry[] | null;
  categoryTags?: string[];
  sourceUrl?: string | null;
  menu?: PlaceMenuItem[];
  /** Small raw payload kept in `source_meta` for re-matching / auditing. */
  raw?: Record<string, unknown>;
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function everyDay(open: string, close: string): OpeningHoursEntry[] {
  return ALL_DAYS.map((day) => ({ day, open, close }));
}

export function toHHmm(value: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Math.min(24, Number(m[1]));
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple rate limiter: guarantees at least `minIntervalMs` between calls. */
export class RateLimiter {
  private last = 0;
  constructor(private readonly minIntervalMs: number) {}
  async wait() {
    const delta = Date.now() - this.last;
    if (delta < this.minIntervalMs) await sleep(this.minIntervalMs - delta);
    this.last = Date.now();
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch JSON with rate limiting + exponential backoff on 429/5xx/network errors. */
export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  opts: { limiter?: RateLimiter; retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await opts.limiter?.wait();
    try {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;
      const text = await res.text().catch(() => '');
      const err = new HttpError(res.status, `HTTP ${res.status} ${url}: ${text.slice(0, 200)}`);
      // 4xx (except 429) won't fix itself by retrying (403 = blocked / signature required)
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err;
    } catch (e) {
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      lastErr = e;
    }
    if (attempt < retries) await sleep(base * 2 ** attempt);
  }
  throw lastErr;
}
