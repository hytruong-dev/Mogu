import { apiRequest } from './client';

export type ProfileDashboard = {
  profile: {
    displayName: string | null;
    username: string | null;
    avatar: { url: string | null; blurHash: string | null; status: string };
    primaryGoal: { id: string; code: string; name: string } | null;
  };
  socialStats: {
    publishedPostCount: number;
    savedDishCount: number;
    followerCount: number;
  };
  journeyPreview: {
    currentStreakDays: number;
    mealsLoggedThisMonth: number;
    newDishesThisMonth: number;
    recentDays: Array<{ localDate: string; status: string }>;
    definitionVersion: string;
  };
  shortcuts: {
    savedDishes: number;
    randomRuns: number;
    mealLogsThisMonth: number;
    myPublishedPosts: number;
    myDraftPosts: number;
  };
  notificationUnreadCount: number;
  generatedAt: string;
};

export const profileApi = {
  dashboard: (params?: { localDate?: string; timezone?: string; weekStartsOn?: string }) => {
    const qs = new URLSearchParams();
    if (params?.localDate) qs.set('localDate', params.localDate);
    if (params?.timezone) qs.set('timezone', params.timezone);
    if (params?.weekStartsOn) qs.set('weekStartsOn', params.weekStartsOn);
    const q = qs.toString();
    return apiRequest<ProfileDashboard>(`/me/profile-dashboard${q ? `?${q}` : ''}`);
  },

  me: <T = Record<string, unknown>>() => apiRequest<T>('/profile/me'),

  updateBasic: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/basic', {
      method: 'PATCH',
      headers: {
        'If-Match': `"${version}"`,
        'x-profile-version': String(version),
      },
      body: JSON.stringify(data),
    }),

  updateHealth: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/health', {
      method: 'PATCH',
      headers: {
        'If-Match': `"${version}"`,
        'x-profile-version': String(version),
      },
      body: JSON.stringify(data),
    }),

  updatePreferences: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/preferences', {
      method: 'PATCH',
      headers: {
        'If-Match': `"${version}"`,
        'x-profile-version': String(version),
      },
      body: JSON.stringify(data),
    }),

  putAvoidances: <T = Record<string, unknown>>(data: unknown) =>
    apiRequest<T>('/me/avoidances', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getHealthProfile: <T = Record<string, unknown>>() => apiRequest<T>('/me/health-profile'),

  createAvatarIntent: <T = Record<string, unknown>>(data: unknown) =>
    apiRequest<T>('/me/avatar-upload-intents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  finalizeAvatar: <T = Record<string, unknown>>(mediaId: string) =>
    apiRequest<T>(`/me/avatar-upload-intents/${mediaId}/finalize`, { method: 'POST' }),

  getAvatar: <T = Record<string, unknown>>() => apiRequest<T>('/me/avatar'),

  deleteAvatar: <T = Record<string, unknown>>(version: number) =>
    apiRequest<T>('/me/avatar', {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
    }),

  getJourney: <T = Record<string, unknown>>(month?: string, timezone?: string) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', month);
    if (timezone) qs.set('timezone', timezone);
    const q = qs.toString();
    return apiRequest<T>(`/me/journey${q ? `?${q}` : ''}`);
  },

  getSettings: <T = Record<string, unknown>>() => apiRequest<T>('/me/settings'),

  updateSettings: <T = Record<string, unknown>>(data: unknown, version: number = 1) =>
    apiRequest<T>('/me/settings', {
      method: 'PATCH',
      headers: {
        'If-Match': `"${version}"`,
      },
      body: JSON.stringify(data),
    }),

  requestDataExport: () =>
    apiRequest<{ jobId: string; status: string }>('/me/data-exports', { method: 'POST' }),

  getDataExport: (jobId: string) => apiRequest(`/me/data-exports/${jobId}`),

  requestAccountDeletion: () =>
    apiRequest('/me/account-deletion-requests', { method: 'POST' }),

  getAccountDeletion: () => apiRequest('/me/account-deletion-request'),

  cancelAccountDeletion: () =>
    apiRequest('/me/account-deletion-request', { method: 'DELETE' }),

  clearHistory: () => apiRequest('/me/random-history', { method: 'DELETE' }),

  clearHealth: () => apiRequest('/me/health-data', { method: 'DELETE' }),

  getRegions: (q?: string, limit = 40) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    qs.set('limit', String(limit));
    return apiRequest<{ items: Array<{ id: string; code: string; name: string }> }>(
      `/catalogs/regions?${qs.toString()}`,
    );
  },
};
