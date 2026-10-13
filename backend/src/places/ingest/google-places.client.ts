import type { OpeningHoursEntry } from '../places-geo.util';
import { everyDay, fetchJsonWithRetry, HttpError, RateLimiter, type PlaceInput } from './place-input';

/**
 * Google Places API (New) — Text Search.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Cần bật "Places API (New)" trong Google Cloud và đặt GOOGLE_MAPS_API_KEY trong backend/.env.
 * Google KHÔNG cung cấp thực đơn — quán được tìm theo tên món (textQuery) quanh vị trí.
 */
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.shortFormattedAddress',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceRange',
  'places.regularOpeningHours',
  'places.photos',
  'places.googleMapsUri',
  'places.primaryType',
  'places.types',
  'places.businessStatus',
  'nextPageToken',
].join(',');

type Money = { currencyCode?: string; units?: string | number };
type TimePoint = { day?: number; hour?: number; minute?: number };

export interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  shortFormattedAddress?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceRange?: { startPrice?: Money; endPrice?: Money };
  regularOpeningHours?: { periods?: Array<{ open?: TimePoint; close?: TimePoint }> };
  photos?: Array<{ name?: string }>;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
}

export class GooglePlacesDisabledError extends Error {
  constructor() {
    super('GOOGLE_MAPS_API_KEY chưa được cấu hình');
  }
}

const FOOD_TYPES = new Set([
  'restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'cafe', 'bakery', 'bar',
  'coffee_shop', 'fast_food_restaurant', 'vietnamese_restaurant', 'noodle_shop' as string,
]);

function hhmm(t?: TimePoint): string | null {
  if (!t || typeof t.hour !== 'number') return null;
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute ?? 0).padStart(2, '0')}`;
}

export function mapGoogleOpeningHours(
  hours?: GooglePlace['regularOpeningHours'],
): OpeningHoursEntry[] | null {
  const periods = hours?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  // Mở 24/7: một period duy nhất, open CN 00:00, không có close
  if (periods.length === 1 && periods[0].open && !periods[0].close) return everyDay('00:00', '00:00');
  const out: OpeningHoursEntry[] = [];
  for (const p of periods) {
    const open = hhmm(p.open);
    const close = hhmm(p.close);
    if (open && close && typeof p.open?.day === 'number') out.push({ day: p.open.day, open, close });
  }
  return out.length ? out : null;
}

function moneyToVnd(m?: Money): number | null {
  if (!m || m.units == null) return null;
  const n = Number(m.units);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Google Place -> PlaceInput chuẩn hóa (provider GOOGLE). */
export function mapGooglePlace(p: GooglePlace, thumbnailUrl?: string | null): PlaceInput | null {
  const name = p.displayName?.text?.trim();
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (!p.id || !name || typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') return null;
  return {
    provider: 'GOOGLE',
    providerPlaceId: p.id,
    name: name.slice(0, 200),
    addressShort: (p.shortFormattedAddress || p.formattedAddress || '').slice(0, 300) || null,
    lat,
    lng,
    thumbnailUrl: thumbnailUrl ?? null,
    ratingAvg: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    priceMin: moneyToVnd(p.priceRange?.startPrice),
    priceMax: moneyToVnd(p.priceRange?.endPrice),
    openingHours: mapGoogleOpeningHours(p.regularOpeningHours),
    categoryTags: (p.types ?? []).filter((t) => FOOD_TYPES.has(t)).slice(0, 8),
    sourceUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    raw: { primaryType: p.primaryType ?? null, photo: p.photos?.[0]?.name ?? null },
  };
}

export class GooglePlacesClient {
  private readonly limiter = new RateLimiter(150);

  constructor(private readonly apiKey: string) {}

  static fromEnv(): GooglePlacesClient | null {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_PLACES_API_KEY?.trim();
    return key ? new GooglePlacesClient(key) : null;
  }

  /** Tìm quán theo từ khóa (tên món) quanh 1 điểm; tối đa `maxResults` (<= 60, 3 trang). */
  async searchText(opts: {
    query: string;
    lat: number;
    lng: number;
    radiusM: number;
    maxResults?: number;
  }): Promise<GooglePlace[]> {
    const max = Math.min(Math.max(opts.maxResults ?? 20, 1), 60);
    const out: GooglePlace[] = [];
    let pageToken: string | undefined;
    do {
      const body: Record<string, unknown> = {
        textQuery: opts.query,
        languageCode: 'vi',
        regionCode: 'VN',
        pageSize: Math.min(20, max - out.length),
        locationBias: {
          circle: {
            center: { latitude: opts.lat, longitude: opts.lng },
            radius: Math.min(50_000, Math.max(100, opts.radiusM)),
          },
        },
      };
      if (pageToken) body.pageToken = pageToken;
      const res = await fetchJsonWithRetry<{ places?: GooglePlace[]; nextPageToken?: string }>(
        SEARCH_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
        },
        { limiter: this.limiter, retries: 2, baseDelayMs: 800 },
      );
      out.push(...(res.places ?? []));
      pageToken = res.nextPageToken;
    } while (pageToken && out.length < max);
    return out.slice(0, max);
  }

  /** Lấy URL ảnh công khai (googleusercontent) cho 1 photo resource — không lộ API key cho client. */
  async photoUrl(photoName: string, maxWidthPx = 480): Promise<string | null> {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;
    try {
      const res = await fetchJsonWithRetry<{ photoUri?: string }>(
        url,
        { headers: { 'X-Goog-Api-Key': this.apiKey } },
        { limiter: this.limiter, retries: 1 },
      );
      return res.photoUri ?? null;
    } catch (e) {
      if (e instanceof HttpError) return null;
      return null;
    }
  }
}
