import api from './client'
import type { CursorPage, Dish } from '../types'
import { mediaApi } from './media'

export interface AdminDishQuery {
  q?: string
  status?: string
  regionId?: string
  categoryCode?: string
  mealTypeCode?: string
  goalId?: string
  createdFromImportSessionId?: string
  limit?: number
  cursor?: string
  sort?: 'newest' | 'popular' | 'relevance'
}

export interface DishValidationResult {
  completionPercent: number
  sections: { key: string; status: string }[]
  blockingErrors: { code: string; message: string; section: string }[]
  warnings: { code: string; message: string }[]
  canSubmitReview: boolean
}

function toBackendBody(dto: Partial<CreateDishDto>) {
  const d = dto as any
  return {
    name: d.name,
    slug: d.slug,
    alternateNames: d.alternateNames ?? d.alternateNames,
    shortDescription: d.shortDescription,
    fullDescription: d.fullDescription,
    regionId: d.regionId,
    provinceId: d.provinceId,
    originText: d.originText,
    difficulty: d.difficulty,
    prepMinutes: d.prepMinutes ?? d.prepMinutes,
    cookMinutes: d.cookMinutes ?? d.cookMinutes,
    servings: d.servings,
    priceMin: d.priceMin ?? d.priceMin,
    priceMax: d.priceMax ?? d.priceMax,
    primaryMealSlot: d.primaryMealSlot ?? d.primaryMealSlot,
    categoryIds: d.categoryIds,
    mealTypeIds: d.mealTypeIds ?? d.mealTypeIds,
    dietTypeIds: d.dietTypeIds ?? d.dietTypeIds,
    goalIds: (d.goalIds ?? []).map((g: any) => (typeof g === 'string' ? { goalId: g } : g)),
    parentDishId: d.parentDishId ?? d.parentDishId,
    createMissingIngredients: d.createMissingIngredients,
    nutrition: d.nutrition
      ? {
          calories: d.nutrition.calories,
          proteinG: d.nutrition.proteinG ?? d.nutrition.proteinG,
          carbsG: d.nutrition.carbsG ?? d.nutrition.carbsG,
          fatG: d.nutrition.fatG ?? d.nutrition.fatG,
          fiberG: d.nutrition.fiberG ?? d.nutrition.fiberG,
          sodiumMg: d.nutrition.sodiumMg ?? d.nutrition.sodiumMg,
          servingName: d.nutrition.servingName ?? d.nutrition.servingName,
          servingG: d.nutrition.servingG ?? d.nutrition.servingG,
        }
      : undefined,
    ingredients: d.ingredients?.map((i: any) => ({
      clientRef: i.clientRef,
      canonicalNameCandidate: i.canonicalNameCandidate ?? i.rawText,
      ingredientId: i.ingredientId,
      rawText: i.rawText ?? i.rawText,
      quantity: i.quantity,
      unit: i.unit,
      preparation: i.preparation,
      isOptional: i.isOptional,
      groupLabel: i.groupLabel,
      sortOrder: i.sortOrder,
    })),
    recipeSteps: (d.recipeSteps ?? d.recipeSteps)?.map((s: any) => ({
      stepOrder: s.stepOrder ?? s.stepOrder,
      instruction: s.instruction,
      durationMin: s.durationMin ?? s.durationMin,
      imageUrl: s.imageUrl,
    })),
  }
}

function normalizeValidation(raw: any): DishValidationResult | null {
  if (!raw || typeof raw !== 'object') return null
  const blocking = raw?.blockingErrors ?? []
  return {
    completionPercent: raw?.completionPercent ?? 0,
    sections: raw?.sections ?? [],
    blockingErrors: blocking,
    warnings: raw?.warnings ?? [],
    canSubmitReview: raw?.canSubmitReview ?? blocking.length === 0,
  }
}

export interface RecipeStepPayload {
  stepOrder: number
  instruction: string
  durationMin?: number
  imageUrl?: string
}

export interface NutritionPayload {
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  servingName?: string
  servingG?: number
}

export interface IngredientRow {
  ingredientId?: string
  rawText: string
  quantity?: number
  unit?: string
  preparation?: string
  isOptional?: boolean
  groupLabel?: string
  sortOrder?: number
}

export interface CreateDishDto {
  name?: string
  slug?: string
  alternateNames?: string[]
  regionId?: string
  provinceId?: string
  originText?: string
  categoryIds?: string[]
  mealTypeIds?: string[]
  dietTypeIds?: string[]
  goalIds?: Array<string | { goalId: string; score?: number }>
  difficulty?: string
  prepMinutes?: number
  cookMinutes?: number
  servings?: number
  priceMin?: number
  priceMax?: number
  primaryMealSlot?: string
  shortDescription?: string
  fullDescription?: string
  parentDishId?: string
  createMissingIngredients?: boolean
  nutrition?: NutritionPayload
  ingredients?: IngredientRow[]
  recipeSteps?: RecipeStepPayload[]
  sources?: Array<{ url: string; title?: string; domain?: string; reliability?: number; sourceType?: string }>
}

export const dishesApi = {
  // ── Admin list (mọi status) ───────────────────────────────────────────────

  list: (params?: AdminDishQuery) =>
    api.get<CursorPage<Dish>>('/admin/dishes', { params }).then((r) => r.data),

  detail: (id: string) => api.get<Dish>(`/admin/dishes/${id}`).then((r) => r.data),

  validate: (id: string) =>
    api
      .get(`/admin/dishes/${id}/validation`)
      .then((r) => (r.data ? normalizeValidation(r.data) : null)),

  // ── CRUD ──────────────────────────────────────────────────────────────────

  create: (dto: CreateDishDto) => api.post<Dish>('/admin/dishes', toBackendBody(dto)).then((r) => r.data),

  update: (id: string, dto: Partial<CreateDishDto> & { version?: number }) => {
    const { version, ...body } = dto
    return api
      .patch<Dish>(`/admin/dishes/${id}`, toBackendBody(body), {
        headers: version != null ? { 'If-Match': String(version) } : {},
      })
      .then((r) => r.data)
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  submitForReview: (id: string, body?: { note?: string; reviewTeam?: string }) =>
    api.post(`/admin/dishes/${id}/submit-review`, body ?? {}).then((r) => r.data),

  saveSources: (
    id: string,
    sources: Array<{ url: string; title?: string; domain?: string; reliability?: number; sourceType?: string }>,
  ) => api.put(`/admin/dishes/${id}/sources`, { sources }).then((r) => r.data),

  unpublish: (id: string) => api.post(`/admin/dishes/${id}/unpublish`).then((r) => r.data),

  republish: (id: string) => api.post(`/admin/dishes/${id}/republish`).then((r) => r.data),

  archive: (id: string) => api.post(`/admin/dishes/${id}/archive`).then((r) => r.data),

  restore: (id: string) => api.post(`/admin/dishes/${id}/restore`).then((r) => r.data),

  // Publish không cần review (approve trực tiếp)
  publishDirect: (id: string) =>
    api.post(`/admin/dishes/${id}/approve`, {}).then((r) => r.data),

  // ── Delete (soft delete) ──────────────────────────────────────────────────
  delete: (id: string) => api.delete(`/admin/dishes/${id}`).then((r) => r.data),

  // ── Upload ảnh đại diện ───────────────────────────────────────────────────
  uploadFull: (dishId: string, file: File, extra?: { isPrimary?: boolean }) =>
    mediaApi.uploadFull(dishId, file, extra),

  deleteMedia: (dishId: string, mediaId: string) =>
    api.delete(`/admin/dishes/${dishId}/media/${mediaId}`).then((r) => r.data),

  // ── Public: variants của món cha ─────────────────────────────────────────
  getVariants: (dishId: string) =>
    api.get<Dish[]>(`/dishes/${dishId}/variants`).then((r) => r.data),
}
