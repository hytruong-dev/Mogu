import { apiRequest } from './client';

export const profileApi = {
  me: <T = Record<string, unknown>>() => apiRequest<T>('/profile/me'),
  updateBasic: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/basic', {
      method: 'PATCH',
      headers: { 'x-profile-version': String(version) },
      body: JSON.stringify(data),
    }),
  updateHealth: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/health', {
      method: 'PATCH',
      headers: { 'x-profile-version': String(version) },
      body: JSON.stringify(data),
    }),
  updatePreferences: <T = Record<string, unknown>>(data: unknown, version: number) =>
    apiRequest<T>('/profile/preferences', {
      method: 'PATCH',
      headers: { 'x-profile-version': String(version) },
      body: JSON.stringify(data),
    }),
};
