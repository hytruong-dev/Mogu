import { apiRequest } from './client';
import type {
  Dish,
  DishListResponse,
  DishSearchParams,
  RandomDishRequest,
  RandomDishResponse,
  Review,
  ReviewListResponse,
  SaveDishResponse,
  UnsaveDishResponse,
  SavedDishesResponse,
} from './types';

// Type aliases for backward compat / screen usage
export type { Dish };
export type { Dish as DishDetail };
export type { RandomDishResponse as RandomResult };
export type { RandomDishRequest as RandomRequest };
export type { Review, ReviewListResponse };
export type { DishListResponse, DishSearchParams, RandomDishRequest, RandomDishResponse, SavedDishesResponse };

export const dishesApi = {
  // ── GET /dishes — Public search ──────────────────────────────────────────────
  search: (params?: DishSearchParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    if (params?.regionCode) query.set('regionCode', params.regionCode);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<DishListResponse>(`/dishes${qs ? `?${qs}` : ''}`);
  },

  // ── GET /dishes/:id — Dish detail ────────────────────────────────────────────
  getById: (id: string) => apiRequest<Dish>(`/dishes/${id}`),

  // ── POST /dish-randomizations — Random món ăn ───────────────────────────────
  random: (body: RandomDishRequest = {}) =>
    apiRequest<RandomDishResponse>('/dish-randomizations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Alias
  getRandom: (body: RandomDishRequest = {}) =>
    apiRequest<RandomDishResponse>('/dish-randomizations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ── GET /me/random-history — Lịch sử random ─────────────────────────────────
  getRandomHistory: (limit = 10) =>
    apiRequest<DishListResponse>(`/me/random-history?limit=${limit}`),

  // ── POST /me/saved-dishes/:dishId — Lưu món ─────────────────────────────────
  save: (dishId: string) =>
    apiRequest<SaveDishResponse>(`/me/saved-dishes/${dishId}`, {
      method: 'POST',
      body: '{}',
    }),

  // ── DELETE /me/saved-dishes/:dishId — Bỏ lưu ────────────────────────────────
  unsave: (dishId: string) =>
    apiRequest<UnsaveDishResponse>(`/me/saved-dishes/${dishId}`, {
      method: 'DELETE',
    }),

  // ── GET /me/saved-dishes — Danh sách đã lưu ─────────────────────────────────
  getSaved: (cursor?: string, limit = 20) => {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    query.set('limit', String(limit));
    return apiRequest<SavedDishesResponse>(`/me/saved-dishes?${query.toString()}`);
  },

  // ── GET /dishes/:id/reviews — Đánh giá của món ──────────────────────────────
  getReviews: (dishId: string, cursor?: string, limit = 10) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (cursor) query.set('cursor', cursor);
    return apiRequest<ReviewListResponse>(`/dishes/${dishId}/reviews?${query.toString()}`);
  },

  // ── POST /dishes/:id/reviews — Gửi đánh giá ─────────────────────────────────
  submitReview: (dishId: string, body: { rating: number; comment?: string }) =>
    apiRequest<Review>(`/dishes/${dishId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ── DELETE /dishes/:id/reviews/mine — Xóa đánh giá của mình ────────────────
  deleteMyReview: (dishId: string) =>
    apiRequest<{ deleted: boolean }>(`/dishes/${dishId}/reviews/mine`, {
      method: 'DELETE',
    }),

  // ── GET /dishes/:id/variants — Danh sách biến thể ───────────────────────────
  getVariants: (dishId: string) =>
    apiRequest<Dish[]>(`/dishes/${dishId}/variants`),
};
