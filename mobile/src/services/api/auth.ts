import { apiRequest } from './client';
import { clearSession, saveSession } from './storage';
import type { AuthResult, AuthUser } from './types';

export const authApi = {
  register: async (username: string, password: string) => {
    const result = await apiRequest<AuthResult>('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username: username.trim().toLowerCase(), password, consentVersion: '1.1' }),
    });
    await saveSession({
      ...result.session,
      expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000,
    });
    return result;
  },

  login: async (username: string, password: string) => {
    const result = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    await saveSession({
      ...result.session,
      expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000,
    });
    return result;
  },

  me: () => apiRequest<AuthUser>('/auth/me'),

  forgotPassword: (username: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username }),
    }),

  changeTemporaryPassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string; session: { accessToken: string; refreshToken: string; expiresIn: number } }>(
      '/auth/change-temporary-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    ),

  logout: async (scope: 'current' | 'all' = 'current') => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
    } finally {
      await clearSession();
    }
  },
};
