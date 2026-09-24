import api from './client'

export interface AdminPlaceItem {
  id: string
  provider: string
  providerPlaceId: string | null
  name: string
  addressShort: string | null
  lat: number | null
  lng: number | null
  thumbnailUrl: string | null
  isVerified: boolean
  postCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminPlacesResponse {
  items: AdminPlaceItem[]
  total: number
  hasMore: boolean
}

export interface AdminUpdatePlaceDto {
  name?: string
  addressShort?: string
  lat?: number
  lng?: number
  thumbnailUrl?: string
  isVerified?: boolean
}

export const adminPlacesApi = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    api.get<AdminPlacesResponse>('/admin/places', { params }).then((r) => r.data),

  update: (id: string, dto: AdminUpdatePlaceDto) =>
    api.patch<AdminPlaceItem>(`/admin/places/${id}`, dto).then((r) => r.data),

  delete: (id: string, force?: boolean) =>
    api.delete<{ success: boolean; id: string }>(`/admin/places/${id}`, { params: { force } }).then((r) => r.data),
}
