import { apiRequest } from './client';
import type {
  HomeDashboard,
  RecommendationItem,
  RecommendationListResponse,
  SaveDishResponse,
  UnsaveDishResponse,
  NutritionToday,
  UnreadCountResponse,
  NotificationListResponse,
  NotificationItem,
  GoalCatalogResponse,
  WeatherData,
} from './types';

// ─── 1. GET /home — Dashboard BFF ─────────────────────────────────────────────
export const homeApi = {
  getDashboard: () => apiRequest<HomeDashboard>('/home'),

  // ─── 2. GET /recommendations/home ────────────────────────────────────────────
  getRecommendations: (params?: { page?: number; limit?: number; goalCode?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.goalCode) query.set('goalCode', params.goalCode);
    const qs = query.toString();
    return apiRequest<RecommendationListResponse>(`/recommendations/home${qs ? `?${qs}` : ''}`);
  },

  // ─── 3. POST /dishes/:id/save ─────────────────────────────────────────────────
  saveDish: (dishId: string) =>
    apiRequest<SaveDishResponse>(`/dishes/${dishId}/save`, { method: 'POST', body: '{}' }),

  // ─── 4. DELETE /dishes/:id/save ──────────────────────────────────────────────
  unsaveDish: (dishId: string) =>
    apiRequest<UnsaveDishResponse>(`/dishes/${dishId}/save`, { method: 'DELETE' }),

  // ─── 5. GET /nutrition/today ──────────────────────────────────────────────────
  getNutritionToday: (localDate?: string) => {
    const qs = localDate ? `?localDate=${localDate}` : '';
    return apiRequest<NutritionToday>(`/nutrition/today${qs}`);
  },

  // ─── 6. GET /notifications/unread-count ───────────────────────────────────────
  getUnreadCount: () => apiRequest<UnreadCountResponse>('/notifications/unread-count'),

  // ─── 7. GET /notifications ────────────────────────────────────────────────────
  getNotifications: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  // ─── 8. PATCH /notifications/:id/read ────────────────────────────────────────
  markNotificationRead: (notifId: string) =>
    apiRequest<NotificationItem>(`/notifications/${notifId}/read`, {
      method: 'PATCH',
      body: '{}',
    }),

  // ─── 9. GET /catalogs/goals ───────────────────────────────────────────────────
  getGoals: () => apiRequest<GoalCatalogResponse>('/catalogs/goals'),

  // ─── 10. GET /weather ─────────────────────────────────────────────────────────
  getWeather: (lat: number, lon: number) =>
    apiRequest<WeatherData>(`/weather?lat=${lat}&lon=${lon}`),
};

export type { RecommendationItem, NotificationItem, WeatherData };
