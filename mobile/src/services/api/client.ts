import { Platform } from 'react-native';
import { getDeviceTimeZone, getTodayISO } from '../../lib/dates';
import { clearSession, getSession, saveSession } from './storage';
import { ApiError, type Session } from './types';

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const expoEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;
export const API_URL =
  expoEnvironment?.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? `http://${fallbackHost}:3001/v1`;

type Options = RequestInit & { auth?: boolean; retry?: boolean };

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const nested = body?.error && typeof body.error === 'object' ? body.error : null;
    const errorObj = body?.message && typeof body.message === 'object' ? body.message : body;
    const message =
      (nested && typeof nested.message === 'string' ? nested.message : null) ??
      errorObj?.message ??
      (typeof body?.message === 'string' ? body.message : null) ??
      'Không thể kết nối đến máy chủ.';
    const code =
      (nested && typeof nested.code === 'string' ? nested.code : undefined) ??
      errorObj?.code ??
      body?.code;
    throw new ApiError(message, response.status, code, body);
  }
  // Standard success envelope: { success: true, data: ... }
  if (body !== null && typeof body === 'object' && 'success' in body) {
    return body.data as T;
  }
  return body as T;
}

async function refreshSession(refreshToken: string): Promise<Session> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const result = await parseResponse<{ session: Session }>(response);
  const session: Session = {
    ...result.session,
    expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000,
  };
  await saveSession(session);
  return session;
}

function isTokenExpiredOrExpiringSoon(session: Session): boolean {
  if (!session.expiresAt) return false;
  return Date.now() >= session.expiresAt - 120_000;
}

let refreshPromise: Promise<Session> | null = null;

async function getValidSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  if (isTokenExpiredOrExpiringSoon(session) && session.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshSession(session.refreshToken).finally(() => {
        refreshPromise = null;
      });
    }
    try {
      return await refreshPromise;
    } catch {
      await clearSession();
      return null;
    }
  }

  return session;
}

export async function apiRequest<T>(path: string, options: Options = {}): Promise<T> {
  const { auth = true, retry = true, headers, ...requestOptions } = options;
  const session = auth ? await getValidSession() : null;
  const tz = getDeviceTimeZone();
  const todayDate = getTodayISO(tz);
  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Timezone': tz,
      'X-Local-Date': todayDate,
      'X-Request-Id': requestId,
      'X-Platform': Platform.OS,
      'X-App-Version': '1.4.0',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401 && auth && retry && session?.refreshToken) {
    try {
      const newSession = await refreshSession(session.refreshToken);
      if (!newSession?.accessToken) {
        await clearSession();
        throw new ApiError('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.', 401);
      }
      return apiRequest<T>(path, { ...options, retry: false });
    } catch (error) {
      await clearSession();
      throw error;
    }
  }

  return parseResponse<T>(response);
}
