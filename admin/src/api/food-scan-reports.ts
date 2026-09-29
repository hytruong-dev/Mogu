import api from './client'

export type FoodScanReportStatus = 'NEW' | 'IN_PROGRESS' | 'ADDED' | 'DISMISSED'

export interface FoodScanReport {
  id: string
  scanEventId: string | null
  userId: string | null
  /** Signed URL (valid ~1h) of the user's photo; null when no photo stored. */
  imageUrl: string | null
  recognizedName: string | null
  guesses: { nameVi: string; nameEn: string | null; confidence: number | null }[]
  category: string | null
  cuisine: string | null
  visibleIngredients: string[]
  suggestedDishes: { id: string; name: string; slug: string }[]
  source: 'AUTO' | 'USER'
  status: FoodScanReportStatus
  reportCount: number
  linkedDish: { id: string; name: string; slug: string } | null
  adminNote: string | null
  handledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface FoodScanReportList {
  items: FoodScanReport[]
  total: number
  limit: number
  offset: number
}

export interface FoodScanReportSummary {
  new: number
  inProgress: number
  added: number
  dismissed: number
}

export interface FoodScanReportQuery {
  status?: FoodScanReportStatus
  q?: string
  limit?: number
  offset?: number
}

export interface UpdateFoodScanReportDto {
  status?: FoodScanReportStatus
  linkedDishId?: string | null
  adminNote?: string | null
  addAlias?: boolean
}

const BASE = '/admin/food-scan/missing-dishes'

export const foodScanReportsApi = {
  list: (params?: FoodScanReportQuery) =>
    api.get<FoodScanReportList>(BASE, { params }).then((r) => r.data),
  summary: () => api.get<FoodScanReportSummary>(`${BASE}/summary`).then((r) => r.data),
  get: (id: string) => api.get<FoodScanReport>(`${BASE}/${id}`).then((r) => r.data),
  update: (id: string, dto: UpdateFoodScanReportDto) =>
    api
      .patch<FoodScanReport & { aliasAdded: boolean }>(`${BASE}/${id}`, dto)
      .then((r) => r.data),
}

export const FOOD_SCAN_CATEGORY_LABEL: Record<string, string> = {
  soup_noodle: 'Món nước',
  dry_noodle: 'Món khô / trộn',
  rice: 'Cơm',
  bread: 'Bánh mì',
  snack: 'Ăn vặt',
  dessert: 'Tráng miệng',
  drink: 'Đồ uống',
  other: 'Khác',
}
