import { apiRequest } from './client';
import type { NearbyPlace } from '../../screens/food-detail/types';
import type { ApiPlace } from './randomization';

export type SearchPlacesParams = {
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  cursor?: string;
};

export type NearbyPlacesParams = {
  dishId?: string;
  q?: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  sort?: 'distance' | 'rating';
};

export type PlaceDto = ApiPlace;

export type PlaceDetail = ApiPlace & {
  openingHours?: Array<{ day: number; open: string; close: string }> | null;
  postCount: number;
  lastSyncedAt?: string | null;
  dishes: Array<{
    dishId: string;
    name: string;
    slug: string;
    matchStatus: 'CONFIRMED' | 'LIKELY' | 'REJECTED';
    priceVnd: number | null;
    sourceItemName: string | null;
  }>;
};

function formatVndK(v: number) {
  return `${Math.round(v / 1000)}k`;
}

/** Map quán từ backend sang model hiển thị — KHÔNG bịa rating/giá/giờ mở. */
export function toNearbyPlace(p: ApiPlace): NearbyPlace {
  const hasCoords = p.lat != null && p.lng != null;
  const priceRange = p.dishPriceVnd
    ? `${formatVndK(p.dishPriceVnd)} / món`
    : p.priceRange ?? null;
  return {
    placeId: p.id,
    name: p.name,
    address: p.addressShort ?? null,
    coordinates: hasCoords ? { lat: p.lat as number, lng: p.lng as number } : null,
    distanceMeters: p.distanceMeters ?? null,
    rating: p.ratingAvg != null && p.ratingAvg > 0 ? Number(p.ratingAvg) : null,
    ratingCount: p.ratingCount ?? null,
    priceRange,
    openStatus: p.openStatus ?? 'UNKNOWN',
    imageUrl: p.thumbnailUrl ?? null,
    menuMatchStatus: p.menuMatchStatus ?? 'UNKNOWN',
    provider: p.provider,
    sourceUrl: p.sourceUrl ?? null,
    directionsDeepLink: hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
      : null,
  };
}

function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : '';
}

export const placesApi = {
  search: async (params?: SearchPlacesParams): Promise<NearbyPlace[]> => {
    try {
      const res = await apiRequest<{ data: PlaceDto[]; nextCursor: string | null; hasMore: boolean }>(
        `/places/search${qs({ ...(params ?? {}) })}`,
        { auth: true },
      );
      return (res?.data ?? []).map(toNearbyPlace);
    } catch {
      return [];
    }
  },

  /** Quán bán món trong bán kính (mặc định 3km) quanh người dùng. */
  nearby: async (
    params: NearbyPlacesParams,
  ): Promise<{
    places: NearbyPlace[];
    radiusKm: number;
    matchMode: 'LINKED' | 'NAME' | 'NONE';
    source: 'DB' | 'GOOGLE' | 'GEOAPIFY' | 'OSM';
  }> => {
    const res = await apiRequest<{
      data: PlaceDto[];
      radiusKm: number;
      matchMode: 'LINKED' | 'NAME' | 'NONE';
      source?: 'DB' | 'GOOGLE' | 'GEOAPIFY' | 'OSM';
    }>(`/places/nearby${qs({ ...params })}`, { auth: true, timeout: 45000 });
    return {
      places: (res?.data ?? []).map(toNearbyPlace),
      radiusKm: res?.radiusKm ?? params.radiusKm ?? 3,
      matchMode: res?.matchMode ?? 'NONE',
      source: res?.source ?? 'DB',
    };
  },

  getDetail: (id: string, coords?: { lat: number; lng: number } | null) =>
    apiRequest<PlaceDetail>(
      `/places/${id}${qs({ lat: coords?.lat, lng: coords?.lng })}`,
      { auth: true },
    ),
};
