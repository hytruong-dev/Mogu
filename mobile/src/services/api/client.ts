import { Platform } from 'react-native';
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
    const error = body?.message && typeof body.message === 'object' ? body.message : body;
    const message =
      (nested && typeof nested.message === 'string' ? nested.message : null) ??
      error?.message ??
      (typeof body?.message === 'string' ? body.message : null) ??
      'Không thể kết nối đến máy chủ.';
    const code =
      (nested && typeof nested.code === 'string' ? nested.code : undefined) ??
      error?.code ??
      body?.code;
    throw new ApiError(message, response.status, code, body);
  }
  // TransformInterceptor bọc response trong { success, data, timestamp }
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
  // Lưu expiresAt để proactive refresh lần sau
  const session: Session = {
    ...result.session,
    expiresAt: Date.now() + (result.session.expiresIn - 60) * 1000, // buffer 60s
  };
  await saveSession(session);
  return session;
}

/**
 * Kiểm tra token có cần refresh không (hết hạn hoặc sắp hết hạn trong 2 phút)
 */
function isTokenExpiredOrExpiringSoon(session: Session): boolean {
  if (!session.expiresAt) return false; // không có expiresAt → assume vẫn valid
  return Date.now() >= session.expiresAt - 120_000; // 2 phút buffer
}

// Mutex để tránh nhiều request cùng lúc đều trigger refresh
let refreshPromise: Promise<Session> | null = null;

async function getValidSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  // Proactive refresh nếu token sắp hết hạn
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

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-platform': Platform.OS,
      'x-app-version': '1.0.0',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
  });

  // Reactive refresh: nếu vẫn 401 sau proactive (token bị revoke, v.v.)
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
