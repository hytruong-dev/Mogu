/**
 * OpenStreetMap Overpass client — free, legal fallback (ODbL, attribution
 * "© OpenStreetMap contributors"). No ratings/prices; good for coverage.
 */
import type { OpeningHoursEntry } from '../places-geo.util';
import { fetchJsonWithRetry, type PlaceInput, RateLimiter } from './place-input';

/** Public Overpass instances tried in order (main instance may 406 some IPs). */
const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
/** Overpass mirrors rate-limit requests without a meaningful User-Agent. */
/** Public mirrors can take minutes under load; override via OVERPASS_TIMEOUT_MS. */
const OSM_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS) || 300_000;
const USER_AGENT =
  // overpass-api.de trả 406 cho UA chứa "Crawler"
  process.env.OVERPASS_USER_AGENT || 'Mogu-Places/1.0 (contact: admin@mogu.vn)';

export const OSM_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  hcm: { lat: 10.7769, lng: 106.7009 },
  'ho-chi-minh': { lat: 10.7769, lng: 106.7009 },
  hn: { lat: 21.0285, lng: 105.8542 },
  'ha-noi': { lat: 21.0285, lng: 105.8542 },
  dn: { lat: 16.0544, lng: 108.2022 },
  'da-nang': { lat: 16.0544, lng: 108.2022 },
};

export interface OsmSearchParams {
  lat: number;
  lng: number;
  radiusM: number;
  /** Optional case-insensitive name regex filter (Overpass syntax). */
  nameRegex?: string;
  /** Optional case-insensitive `cuisine` tag regex (OR-ed with nameRegex). */
  cuisineRegex?: string;
  limit?: number;
}

function foldVi(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

/**
 * Tên món có dấu → khớp đúng dấu (không phân biệt hoa thường) để "Phở" không khớp "Phố".
 * Tên món không dấu → khớp lỏng mọi biến thể dấu.
 */
export function keywordToStrictOsmRegex(keyword: string): string {
  const k = keyword.trim().replace(/\s+/g, ' ');
  if (foldVi(k) === k.toLowerCase()) return keywordToOsmRegex(k);
  return [...k]
    .map((c) => {
      const lower = c.toLowerCase();
      const upper = c.toUpperCase();
      if (lower !== upper) return `[${lower}${upper}]`;
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}

/** Tên món → regex khớp cả chữ có dấu lẫn không dấu (tên quán OSM thường có dấu). */
export function keywordToOsmRegex(keyword: string): string {
  const groups: Record<string, string> = {
    a: 'aàáảãạăằắẳẵặâầấẩẫậ', e: 'eèéẻẽẹêềếểễệ', i: 'iìíỉĩị', o: 'oòóỏõọôồốổỗộơờớởỡợ',
    u: 'uùúủũụưừứửữự', y: 'yỳýỷỹỵ', d: 'dđ',
  };
  return [...keyword.trim().replace(/\s+/g, ' ')]
    .map((c) => {
      const base = foldVi(c);
      if (groups[base]) return `[${groups[base]}${groups[base].toUpperCase()}]`;
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}

/** Tên món → regex cho thẻ `cuisine` (giá trị OSM không dấu, dùng "_" thay khoảng trắng). */
export function keywordToCuisineRegex(keyword: string): string | undefined {
  const folded = foldVi(keyword).replace(/[^a-z0-9 ]+/g, ' ').trim();
  if (folded.length < 3) return undefined;
  return folded.split(/\s+/).join('[ _]?');
}

export class OsmClient {
  private readonly limiter = new RateLimiter(2000);
  private readonly endpoints: string[];
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly baseDelayMs: number;
  constructor(
    endpoint = process.env.OVERPASS_URL,
    opts: { timeoutMs?: number; retries?: number; baseDelayMs?: number } = {},
  ) {
    this.endpoints = endpoint ? [endpoint] : DEFAULT_ENDPOINTS;
    this.timeoutMs = opts.timeoutMs ?? OSM_TIMEOUT_MS;
    this.retries = opts.retries ?? 2;
    this.baseDelayMs = opts.baseDelayMs ?? 5000;
  }

  buildQuery(p: OsmSearchParams): string {
    const radius = Math.round(Math.min(Math.max(p.radiusM, 100), 20_000));
    const around = `(around:${radius},${p.lat},${p.lng})`;
    const base = `nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["name"]`;
    const lines: string[] = [];
    if (p.nameRegex) lines.push(`${base}["name"~"${escapeOverpass(p.nameRegex)}",i]${around};`);
    if (p.cuisineRegex) lines.push(`${base}["cuisine"~"${escapeOverpass(p.cuisineRegex)}",i]${around};`);
    if (lines.length === 0) lines.push(`${base}${around};`);
    return `[out:json][timeout:${Math.round(this.timeoutMs / 1000)}];
(
  ${lines.join('\n  ')}
);
out center ${Math.max(1, p.limit ?? 500)};`;
  }

  async search(p: OsmSearchParams): Promise<PlaceInput[]> {
    const body = `data=${encodeURIComponent(this.buildQuery(p))}`;
    let lastErr: unknown;
    for (const endpoint of this.endpoints) {
      try {
        const json = await fetchJsonWithRetry<{ elements?: any[] }>(
          endpoint,
          {
            method: 'POST',
            headers: {
              // overpass-api.de trả 406 với "application/json, */*;q=0.8"
              accept: '*/*',
              'content-type': 'application/x-www-form-urlencoded',
              'user-agent': USER_AGENT,
            },
            body,
            signal: AbortSignal.timeout(this.timeoutMs),
          },
          { limiter: this.limiter, retries: this.retries, baseDelayMs: this.baseDelayMs },
        );
        return (json.elements ?? []).map(mapOsmElement).filter((x): x is PlaceInput => !!x);
      } catch (e) {
        lastErr = e;
        console.warn(`[osm] ${endpoint} failed: ${(e as Error).message?.slice(0, 120)}`);
      }
    }
    throw lastErr;
  }
}

function escapeOverpass(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function mapOsmElement(el: any): PlaceInput | null {
  const tags = el?.tags ?? {};
  const name: string | undefined = tags['name:vi'] || tags.name;
  if (!name || !el?.type || el?.id == null) return null;
  const lat = Number(el.lat ?? el.center?.lat);
  const lng = Number(el.lon ?? el.center?.lon);
  const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:subdistrict'] ?? tags['addr:quarter'], tags['addr:district'], tags['addr:city']]
    .filter(Boolean)
    .join(', ');
  const cuisines = String(tags.cuisine ?? '')
    .split(/[;,]/)
    .map((s) => s.trim().replace(/_/g, ' '))
    .filter(Boolean);
  return {
    provider: 'OSM',
    providerPlaceId: `${el.type}/${el.id}`,
    name: String(name).slice(0, 200),
    addressShort: address ? address.slice(0, 300) : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    openingHours: parseOsmOpeningHours(tags.opening_hours),
    categoryTags: [tags.amenity, ...cuisines].filter(Boolean),
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    menu: [],
    raw: { tags },
  };
}

const OSM_DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function expandDays(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [a, b] = part.trim().split('-');
    const start = OSM_DAYS[a];
    if (start == null) continue;
    if (!b) {
      out.add(start);
      continue;
    }
    const end = OSM_DAYS[b];
    if (end == null) continue;
    for (let d = start; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === end) break;
    }
  }
  return [...out];
}

/**
 * Parse the common subset of OSM `opening_hours`:
 * "24/7", "06:00-22:00", "Mo-Fr 07:00-21:00; Sa,Su 08:00-23:00", "Mo-Su 06:00-10:00,16:00-22:00".
 * Unsupported syntax returns null (status UNKNOWN).
 */
export function parseOsmOpeningHours(raw: unknown): OpeningHoursEntry[] | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (value === '24/7') return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '00:00', close: '00:00' }));
  const entries: OpeningHoursEntry[] = [];
  for (const rule of value.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = /^(?:([A-Za-z,\- ]+?)\s+)?((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\s*,?\s*)+)$/.exec(rule);
    if (!m) {
      if (/\boff\b/i.test(rule)) continue;
      return null;
    }
    const days = m[1] ? expandDays(m[1].replace(/\s/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    if (days.length === 0) return null;
    for (const range of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      const [open, close] = range.split('-');
      const norm = (t: string) => {
        const [h, mm] = t.split(':');
        return `${String(Math.min(24, Number(h))).padStart(2, '0')}:${mm}`;
      };
      for (const day of days) entries.push({ day, open: norm(open), close: norm(close) === '24:00' ? '00:00' : norm(close) });
    }
  }
  return entries.length ? entries : null;
}
