import api from './client'

export type PlaceOpenStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN'
export type PlaceDishMatchStatus = 'CONFIRMED' | 'LIKELY' | 'REJECTED'

export interface AdminPlaceItem {
  id: string
  provider: string
  providerPlaceId: string | null
  name: string
  addressShort: string | null
  lat: number | null
  lng: number | null
  thumbnailUrl: string | null
  ratingAvg: number | null
  ratingCount: number | null
  priceMin: number | null
  priceMax: number | null
  priceRange: string | null
  openStatus: PlaceOpenStatus
  sourceUrl: string | null
  isVerified: boolean
  isActive: boolean
  postCount: number
  dishCount: number
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminPlacesResponse {
  items: AdminPlaceItem[]
  total: number
  hasMore: boolean
}

export interface AdminPlacesQuery {
  q?: string
  provider?: string
  isVerified?: 'true' | 'false'
  hasDishes?: 'true' | 'false'
  limit?: number
  offset?: number
}

export interface AdminUpdatePlaceDto {
  name?: string
  addressShort?: string
  lat?: number
  lng?: number
  thumbnailUrl?: string
  isVerified?: boolean
  isActive?: boolean
}

export interface AdminPlaceDishItem {
  id: string
  dishId: string
  dishName: string
  dishSlug: string
  matchStatus: PlaceDishMatchStatus
  matchScore: number | null
  priceVnd: number | null
  sourceItemName: string | null
}

export interface AdminUpdatePlaceDishDto {
  dishId: string
  matchStatus?: PlaceDishMatchStatus
  priceVnd?: number
  remove?: boolean
}

export const adminPlacesApi = {
  list: (params?: AdminPlacesQuery) =>
    api.get<AdminPlacesResponse>('/admin/places', { params }).then((r) => r.data),

  update: (id: string, dto: AdminUpdatePlaceDto) =>
    api.patch<AdminPlaceItem>(`/admin/places/${id}`, dto).then((r) => r.data),

  delete: (id: string, force?: boolean) =>
    api.delete<{ success: boolean; id: string }>(`/admin/places/${id}`, { params: { force } }).then((r) => r.data),

  listDishes: (id: string) =>
    api.get<{ items: AdminPlaceDishItem[] }>(`/admin/places/${id}/dishes`).then((r) => r.data),

  updateDish: (id: string, dto: AdminUpdatePlaceDishDto) =>
    api.patch<{ success: boolean }>(`/admin/places/${id}/dishes`, dto).then((r) => r.data),
}
