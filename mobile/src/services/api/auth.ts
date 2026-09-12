import { apiRequest } from './client';
import { clearSession, saveSession } from './storage';
import type { AuthResult, AuthUser } from './types';

export const authApi = {
  register: async (
    username: string,
    password: string,
    options?: {
      email?: string;
      consents?: Array<{ type: string; version: string; accepted: boolean }>;
      installationId?: string;
    },
  ) => {
    const result = await apiRequest<AuthResult>('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password,
        email: options?.email,
        consents: options?.consents ?? [
          { type: 'TERMS', version: '2026-09-01', accepted: true },
          { type: 'PRIVACY', version: '2026-09-01', accepted: true },
        ],
        installationId: options?.installationId,
      }),
    });
    await saveSession({
      ...result.session,
      expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000,
    });
    return result;
  },

  login: async (identifierOrUsername: string, password: string, installationId?: string) => {
    const trimmed = identifierOrUsername.trim();
    const isEmail = trimmed.includes('@');
    const result = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        ...(isEmail
          ? { identifier: trimmed }
          : { username: trimmed.toLowerCase(), identifier: trimmed.toLowerCase() }),
        password,
        installationId,
      }),
    });
    await saveSession({
      ...result.session,
      expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000,
    });
    return result;
  },

  me: () => apiRequest<AuthUser>('/auth/me'),

  requestPasswordReset: (identifier: string) =>
    apiRequest<{ message: string }>('/auth/password-reset-requests', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ identifier }),
    }),

  confirmPasswordReset: (tokenOrOtp: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/password-reset-confirmations', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ tokenOrOtp, newPassword }),
    }),

  verifyEmail: (tokenOrOtp: string) =>
    apiRequest<{ message: string }>('/auth/email-verifications', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ tokenOrOtp }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/password-change', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (username: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username }),
    }),

  changeTemporaryPassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{
      message: string;
      session: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/auth/change-temporary-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getSessions: () => apiRequest<{ items: Array<any> }>('/me/sessions'),

  deleteSession: (sessionId: string) =>
    apiRequest<{ success: boolean }>(`/me/sessions/${sessionId}`, { method: 'DELETE' }),

  deleteAllSessionsExceptCurrent: () =>
    apiRequest<{ success: boolean }>('/me/sessions?exceptCurrent=true', { method: 'DELETE' }),

  logout: async (scope: 'current' | 'all' = 'current') => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ scope, allDevices: scope === 'all' }),
      });
    } finally {
      await clearSession();
    }
  },
};
