import { apiRequest } from './client';

export const profileApi = {
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

  getJourney: <T = Record<string, unknown>>(month?: string) => {
    const qs = month ? `?month=${month}` : '';
    return apiRequest<T>(`/me/journey${qs}`);
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
};
