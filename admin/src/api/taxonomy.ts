import api from './client'

// ── Public taxonomy API (không cần auth) ─────────────────────────────────────
export const taxonomyApi = {
  getRegions: () => api.get<any[]>('/taxonomy/regions').then((r) => r.data),
  getProvinces: (regionId?: string) =>
    api.get<any[]>('/taxonomy/provinces', { params: regionId ? { regionId } : {} }).then((r) => r.data),
  getCategories: () => api.get<any[]>('/taxonomy/categories').then((r) => r.data),
  getMealTypes: () => api.get<any[]>('/taxonomy/meal-types').then((r) => r.data),
  getDietTypes: () => api.get<any[]>('/taxonomy/diet-types').then((r) => r.data),
  getGoals: () => api.get<any[]>('/taxonomy/goals').then((r) => r.data),
  getAllergens: () => api.get<any[]>('/taxonomy/allergens').then((r) => r.data),
}

export interface Category {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface MealType {
  id: string
  code: string
  name: string
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface DietType {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

export interface Allergen {
  id: string
  code: string
  name: string
  description?: string
  active: boolean
  displayOrder: number
  createdAt: string
}

export interface CreateAllergenDto {
  code: string
  name: string
  description?: string
  displayOrder?: number
  active?: boolean
}

export interface UpdateAllergenDto {
  name?: string
  description?: string
  displayOrder?: number
  active?: boolean
}

export interface CreateCategoryDto {
  code: string
  name: string
  description?: string
  displayOrder?: number
  isActive?: boolean
}

export interface UpdateCategoryDto {
  name?: string
  description?: string
  displayOrder?: number
  isActive?: boolean
}

export const taxonomyAdminApi = {
  // ── DishCategory ─────────────────────────────────────────────────────────
  listCategories: () =>
    api.get<Category[]>('/admin/taxonomy/categories').then((r) => r.data),

  createCategory: (dto: CreateCategoryDto) =>
    api.post<Category>('/admin/taxonomy/categories', dto).then((r) => r.data),

  updateCategory: (id: string, dto: UpdateCategoryDto) =>
    api.patch<Category>(`/admin/taxonomy/categories/${id}`, dto).then((r) => r.data),

  deleteCategory: (id: string) =>
    api.delete(`/admin/taxonomy/categories/${id}`).then((r) => r.data),

  // ── MealTypeTag ───────────────────────────────────────────────────────────
  listMealTypes: () =>
    api.get<MealType[]>('/admin/taxonomy/meal-types').then((r) => r.data),

  createMealType: (dto: CreateCategoryDto) =>
    api.post<MealType>('/admin/taxonomy/meal-types', dto).then((r) => r.data),

  updateMealType: (id: string, dto: UpdateCategoryDto) =>
    api.patch<MealType>(`/admin/taxonomy/meal-types/${id}`, dto).then((r) => r.data),

  deleteMealType: (id: string) =>
    api.delete(`/admin/taxonomy/meal-types/${id}`).then((r) => r.data),

  // ── DietType ─────────────────────────────────────────────────────────────
  listDietTypes: () =>
    api.get<DietType[]>('/admin/taxonomy/diet-types').then((r) => r.data),

  createDietType: (dto: CreateCategoryDto) =>
    api.post<DietType>('/admin/taxonomy/diet-types', dto).then((r) => r.data),

  updateDietType: (id: string, dto: UpdateCategoryDto) =>
    api.patch<DietType>(`/admin/taxonomy/diet-types/${id}`, dto).then((r) => r.data),

  deleteDietType: (id: string) =>
    api.delete(`/admin/taxonomy/diet-types/${id}`).then((r) => r.data),

  // ── Allergen ──────────────────────────────────────────────────────────────
  listAllergens: () =>
    api.get<Allergen[]>('/admin/taxonomy/allergens').then((r) => r.data),

  createAllergen: (dto: CreateAllergenDto) =>
    api.post<Allergen>('/admin/taxonomy/allergens', dto).then((r) => r.data),

  updateAllergen: (id: string, dto: UpdateAllergenDto) =>
    api.patch<Allergen>(`/admin/taxonomy/allergens/${id}`, dto).then((r) => r.data),

  toggleAllergen: (id: string) =>
    api.patch<Allergen>(`/admin/taxonomy/allergens/${id}/toggle`).then((r) => r.data),
}
