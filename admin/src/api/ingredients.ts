import api from './client'

export type IngredientStatus =
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'REJECTED'
  | 'MERGED'
  | 'INACTIVE'

export type IngredientImageStatus =
  | 'NOT_REQUESTED'
  | 'QUEUED'
  | 'SEARCHING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'NOT_FOUND'
  | 'FAILED'

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
  status?: IngredientStatus
  imageStatus?: IngredientImageStatus
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
  status?: IngredientStatus
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

export interface ResolveBatchItem {
  clientRef: string
  rawName: string
  unit?: string
}

export interface ResolveBatchResultItem {
  clientRef: string
  inputKey: string
  outcome:
    | 'EXISTING_EXACT'
    | 'EXISTING_SYNONYM'
    | 'CREATED_PENDING'
    | 'AMBIGUOUS'
    | 'INVALID'
  ingredientId: string | null
  canonicalName: string | null
  isNew: boolean
  candidates: Array<{ id: string; name: string; status: IngredientStatus; score: number }>
}

export interface IngredientImageCandidate {
  id: string
  provider: string
  providerAssetId: string
  sourcePageUrl: string
  originalUrl: string
  previewUrl?: string | null
  author?: string | null
  licenseCode: string
  licenseUrl?: string | null
  score: number
  status: string
  storageKey?: string | null
  publicUrl?: string | null
}

export const ingredientsApi = {
  search: (q: string) =>
    api
      .get<Ingredient[]>('/ingredients', { params: { q, limit: 20 } })
      .then((r) => r.data),

  adminList: (params?: IngredientListQuery) =>
    api
      .get<IngredientListResponse>('/admin/ingredients', { params })
      .then((r) => r.data),

  resolveBatch: (items: ResolveBatchItem[], createMissing = true) =>
    api
      .post<{ items: ResolveBatchResultItem[]; createdIds: string[] }>(
        '/admin/ingredients/resolve-batch',
        { items, createMissing },
      )
      .then((r) => r.data),

  create: (dto: CreateIngredientDto) =>
    api.post<Ingredient>('/admin/ingredients', dto).then((r) => r.data),

  update: (id: string, dto: UpdateIngredientDto) =>
    api.patch<Ingredient>(`/admin/ingredients/${id}`, dto).then((r) => r.data),

  approve: (id: string, body?: { allergenCode?: string | null; synonyms?: string[] }) =>
    api.post<Ingredient>(`/admin/ingredients/${id}/approve`, body ?? {}).then((r) => r.data),

  reject: (id: string) =>
    api.post<Ingredient>(`/admin/ingredients/${id}/reject`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/admin/ingredients/${id}`).then((r) => r.data),

  enqueueImageSearch: (id: string) =>
    api.post(`/admin/ingredients/${id}/image-searches`).then((r) => r.data),

  listImageCandidates: (id: string) =>
    api
      .get<{
        ingredient: Ingredient
        candidates: IngredientImageCandidate[]
      }>(`/admin/ingredients/${id}/image-candidates`)
      .then((r) => r.data),

  setImage: (id: string, body: { candidateId?: string; imageUrl?: string; imageKey?: string }) =>
    api.put<Ingredient>(`/admin/ingredients/${id}/image`, body).then((r) => r.data),

  clearImage: (id: string) =>
    api.delete<Ingredient>(`/admin/ingredients/${id}/image`).then((r) => r.data),

  presignUpload: (id: string) =>
    api
      .post<{ signedUrl: string; token: string; path: string }>(
        `/admin/ingredients/${id}/presign-upload`,
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
    await ingredientsApi.setImage(id, { imageUrl: publicUrl, imageKey: presign.path })
    return publicUrl
  },
}
