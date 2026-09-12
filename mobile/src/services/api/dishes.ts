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

export type { Dish };
export type { Dish as DishDetail };
export type { RandomDishResponse as RandomResult };
export type { RandomDishRequest as RandomRequest };
export type { Review, ReviewListResponse };
export type { DishListResponse, DishSearchParams, RandomDishRequest, RandomDishResponse, SavedDishesResponse };

export const dishesApi = {
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

  getById: (id: string) => apiRequest<Dish>(`/dishes/${id}`),

  getSimilar: (dishId: string, limit = 5) =>
    apiRequest<{ items: Array<any> }>(`/dishes/${dishId}/similar?limit=${limit}`),

  foodLookup: (queryStr: string) =>
    apiRequest<{ query: string; items: Array<any> }>(`/food-lookup?q=${encodeURIComponent(queryStr)}`),

  random: (body: RandomDishRequest = {}) =>
    apiRequest<RandomDishResponse>('/dish-randomizations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getRandom: (body: RandomDishRequest = {}) =>
    apiRequest<RandomDishResponse>('/dish-randomizations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getRandomHistory: (limit = 10) =>
    apiRequest<DishListResponse>(`/me/random-history?limit=${limit}`),

  save: (dishId: string) =>
    apiRequest<SaveDishResponse>(`/me/saved-dishes/${dishId}`, {
      method: 'PUT',
      body: '{}',
    }),

  unsave: (dishId: string) =>
    apiRequest<UnsaveDishResponse>(`/me/saved-dishes/${dishId}`, {
      method: 'DELETE',
    }),

  getSaved: (cursor?: string, limit = 20) => {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    query.set('limit', String(limit));
    return apiRequest<SavedDishesResponse>(`/me/saved-dishes?${query.toString()}`);
  },

  getReviews: (dishId: string, cursor?: string, limit = 10) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (cursor) query.set('cursor', cursor);
    return apiRequest<ReviewListResponse>(`/dishes/${dishId}/reviews?${query.toString()}`);
  },

  submitReview: (dishId: string, body: { rating: number; comment?: string }) =>
    apiRequest<Review>(`/dishes/${dishId}/reviews/me`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteMyReview: (dishId: string) =>
    apiRequest<{ deleted: boolean }>(`/dishes/${dishId}/reviews/me`, {
      method: 'DELETE',
    }),

  getVariants: (dishId: string) =>
    apiRequest<Dish[]>(`/dishes/${dishId}/variants`),
};
