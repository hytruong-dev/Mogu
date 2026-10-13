import { fetchJsonWithRetry, type PlaceInput, RateLimiter } from './place-input';
import { parseOsmOpeningHours } from './osm.client';

/**
 * Geoapify Places API v2 client.
 * Free tier: 3,000 requests/day, no credit card required.
 * Docs: https://apidocs.geoapify.com/docs/places/
 */
const BASE_URL = 'https://api.geoapify.com/v2/places';

export interface GeoapifyFeature {
  type: string;
  properties: {
    place_id: string;
    name?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    categories?: string[];
    opening_hours?: string;
    website?: string;
    lat?: number;
    lon?: number;
    distance?: number;
    datasource?: {
      sourcename?: string;
      attribution?: string;
      raw?: Record<string, unknown>;
    };
    contact?: {
      phone?: string;
      email?: string;
    };
  };
  geometry?: {
    type: string;
    coordinates?: [number, number]; // [lon, lat]
  };
}

export interface GeoapifyResponse {
  type: string;
  features?: GeoapifyFeature[];
}

export function mapGeoapifyPlace(feature: GeoapifyFeature): PlaceInput | null {
  const p = feature?.properties;
  if (!p || !p.place_id || !p.name) return null;
  const lat = p.lat ?? feature?.geometry?.coordinates?.[1];
  const lng = p.lon ?? feature?.geometry?.coordinates?.[0];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const address = p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', ') || null;
  const categories = (p.categories || [])
    .map((c: string) => c.replace(/^catering\./, '').replace(/[._]/g, ' '))
    .filter(Boolean);

  return {
    provider: 'GEOAPIFY',
    providerPlaceId: String(p.place_id),
    name: String(p.name).trim().slice(0, 200),
    addressShort: address ? address.slice(0, 300) : null,
    lat,
    lng,
    thumbnailUrl: null,
    ratingAvg: null,
    ratingCount: null,
    priceMin: null,
    priceMax: null,
    openingHours: p.opening_hours ? parseOsmOpeningHours(p.opening_hours) : null,
    categoryTags: categories.slice(0, 8),
    sourceUrl:
      p.website ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`,
    menu: [],
    raw: {
      datasource: p.datasource,
      contact: p.contact,
    },
  };
}

export class GeoapifyClient {
  // Geoapify allows up to 5 requests per second on free tier
  private readonly limiter = new RateLimiter(250);

  constructor(private readonly apiKey: string) {}

  static fromEnv(): GeoapifyClient | null {
    const key = process.env.GEOAPIFY_API_KEY?.trim();
    return key ? new GeoapifyClient(key) : null;
  }

  async search(opts: {
    query?: string;
    lat: number;
    lng: number;
    radiusM: number;
    limit?: number;
  }): Promise<PlaceInput[]> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const radiusM = Math.round(Math.min(Math.max(opts.radiusM, 100), 20_000));

    const params = new URLSearchParams({
      categories: 'catering.restaurant,catering.fast_food,catering.cafe,catering.food_court',
      filter: `circle:${opts.lng},${opts.lat},${radiusM}`,
      limit: String(limit),
      lang: 'vi',
      apiKey: this.apiKey,
    });

    if (opts.query?.trim()) {
      params.set('name', opts.query.trim());
    }

    const url = `${BASE_URL}?${params.toString()}`;

    const res = await fetchJsonWithRetry<GeoapifyResponse>(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      { limiter: this.limiter, retries: 2, baseDelayMs: 1000 },
    );

    return (res.features ?? []).map(mapGeoapifyPlace).filter((x): x is PlaceInput => !!x);
  }
}
