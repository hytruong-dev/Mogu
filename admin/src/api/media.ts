import axios from 'axios'
import api from './client'
import type { DishMedia } from '../types'

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'

export interface PresignResponse {
  uploadUrl: string
  storageKey: string
  token: string
  expiresAt: string
}

export interface CommitMediaPayload {
  storageKey: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
  durationSec?: number
  altText?: string
  credit?: string
  isPrimary?: boolean
}

export const mediaApi = {
  /**
   * Bước 1: Lấy signed upload URL từ backend
   */
  presignUpload: (dishId: string, mimeType: AllowedMimeType) =>
    api
      .post<PresignResponse>('/admin/media/presign-upload', { dishId, mimeType })
      .then((r) => r.data),

  /**
   * Bước 2: Upload file trực tiếp lên Supabase Storage (PUT raw bytes)
   */
  uploadToStorage: (uploadUrl: string, file: File) =>
    axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: undefined, // caller có thể gán nếu cần progress
    }),

  /**
   * Bước 3: Commit metadata vào DB
   */
  commit: (dishId: string, payload: CommitMediaPayload) =>
    api
      .post<DishMedia & { publicUrl: string }>(`/admin/dishes/${dishId}/media`, payload)
      .then((r) => r.data),

  /**
   * Tiện ích: presign + upload + commit trong một lần
   */
  async uploadFull(dishId: string, file: File, extra?: Partial<CommitMediaPayload>) {
    const mimeType = (file.type === 'image/jpg' || !file.type ? 'image/jpeg' : file.type) as AllowedMimeType
    const presign: any = await mediaApi.presignUpload(dishId, mimeType)
    const uploadUrl = presign.uploadUrl ?? presign.signedUrl ?? presign.data?.uploadUrl
    const storageKey = presign.storageKey ?? presign.path ?? presign.data?.storageKey
    if (!uploadUrl || !storageKey) throw new Error('Không nhận được URL upload từ server.')
    await mediaApi.uploadToStorage(uploadUrl, file)
    const committed: any = await mediaApi.commit(dishId, {
      storageKey,
      mimeType,
      sizeBytes: file.size,
      ...extra,
    })
    return {
      ...committed,
      publicUrl: committed.publicUrl ?? committed.publicUrl,
    }
  },

  approve: (dishId: string, mediaId: string) =>
    api
      .post<DishMedia>(`/admin/dishes/${dishId}/media/${mediaId}/approve`)
      .then((r) => r.data),

  remove: (dishId: string, mediaId: string) =>
    api.delete(`/admin/dishes/${dishId}/media/${mediaId}`).then((r) => r.data),

  getSignedDownloadUrl: (storageKey: string, expiresIn = 3600) =>
    api
      .get<{ signedUrl: string }>('/admin/media/signed-url', {
        params: { storageKey, expiresIn },
      })
      .then((r) => r.data.signedUrl),
}
