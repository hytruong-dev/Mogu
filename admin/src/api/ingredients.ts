import api from './client'

export interface Ingredient {
  id: string
  code: string
  name: string
  synonyms: string[]
  unit?: string
  allergenCode?: string
  imageUrl?: string
  imageKey?: string
  isActive: boolean
  dishCount?: number
  createdAt: string
  updatedAt: string
}

export interface CreateIngredientDto {
  code: string
  name: string
  synonyms?: string[]
  unit?: string
  allergenCode?: string
  imageUrl?: string
  imageKey?: string
  isActive?: boolean
}

export interface UpdateIngredientDto {
  name?: string
  synonyms?: string[]
  unit?: string
  allergenCode?: string
  imageUrl?: string
  imageKey?: string
  isActive?: boolean
}

export interface IngredientListQuery {
  q?: string
  allergenCode?: string
  isActive?: boolean
  page?: number
  limit?: number
}

export interface IngredientListResponse {
  data: Ingredient[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const ingredientsApi = {
  // ── Public: tìm kiếm (dùng cho ingredient picker trong form) ─────────────
  search: (q: string) =>
    api
      .get<Ingredient[]>('/ingredients', { params: { q, limit: 20 } })
      .then((r) => r.data),

  // ── Admin: CRUD ───────────────────────────────────────────────────────────
  adminList: (params?: IngredientListQuery) =>
    api
      .get<IngredientListResponse>('/admin/ingredients', { params })
      .then((r) => r.data),

  create: (dto: CreateIngredientDto) =>
    api.post<Ingredient>('/admin/ingredients', dto).then((r) => r.data),

  update: (id: string, dto: UpdateIngredientDto) =>
    api.patch<Ingredient>(`/admin/ingredients/${id}`, dto).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/admin/ingredients/${id}`).then((r) => r.data),

  // ── Upload ảnh nguyên liệu ────────────────────────────────────────────────
  presignUpload: (id: string) =>
    api
      .post<{ signedUrl: string; token: string; path: string }>(
        `/admin/ingredients/${id}/presign-upload`
      )
      .then((r) => r.data),

  uploadImage: async (id: string, file: File, supabaseUrl: string): Promise<string> => {
    const presign = await ingredientsApi.presignUpload(id)
    const uploadRes = await fetch(presign.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!uploadRes.ok) throw new Error('Upload ảnh thất bại')
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/ingredient-images/${presign.path}`
    // Cập nhật ingredient với URL mới
    await ingredientsApi.update(id, { imageUrl: publicUrl, imageKey: presign.path })
    return publicUrl
  },
}
