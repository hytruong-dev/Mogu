import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getDeviceTimeZone, getTodayISO } from '../../lib/dates';
import { getDeviceModel, getInstallationId } from '../../lib/installation-id';
import { clearSession, getSession, saveSession } from './storage';
import { ApiError, type Session } from './types';

// Default LAN IP for physical mobile devices to communicate with the host PC
export const DEFAULT_LAN_API_URL = 'http://172.28.0.166:3001/v1';

function resolveApiUrl(): string {
  // Statically access process.env so Babel / Metro can inline it during bundling
  const rawEnv =
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig?.extra as any)?.apiUrl ||
    '';
  const envUrl = String(rawEnv).trim().replace(/\/$/, '');

  const isAndroidEmulator =
    Platform.OS === 'android' &&
    ((Platform.constants as any)?.Brand === 'google' ||
      (Platform.constants as any)?.Model?.toLowerCase().includes('emulator') ||
      (Platform.constants as any)?.Model?.toLowerCase().includes('sdk_gphone') ||
      (Platform.constants as any)?.Fingerprint?.includes('generic') ||
      (Platform.constants as any)?.Hardware?.includes('goldfish') ||
      (Platform.constants as any)?.Hardware?.includes('ranchu'));

  // If no env var, use fallback based on platform
  if (!envUrl) {
    if (Platform.OS === 'android') {
      return isAndroidEmulator ? 'http://10.0.2.2:3001/v1' : DEFAULT_LAN_API_URL;
    }
    return 'http://localhost:3001/v1';
  }

  // 10.0.2.2 is the Android Emulator loopback alias to host machine.
  // In a web browser or iOS simulator, connecting to 10.0.2.2 will fail.
  if (Platform.OS === 'web' || Platform.OS !== 'android') {
    if (envUrl.includes('10.0.2.2')) {
      const webHost =
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'localhost';
      return envUrl.replace('10.0.2.2', webHost);
    }
  }

  // On Android Emulator, route to 10.0.2.2 loopback so it works seamlessly and reliably
  if (Platform.OS === 'android' && isAndroidEmulator) {
    if (envUrl.includes('172.28.0.166') || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/172\.28\.0\.166|localhost|127\.0\.0\.1/, '10.0.2.2');
    }
  }

  // On physical Android devices, 10.0.2.2 does not route to host machine.
  if (Platform.OS === 'android' && !isAndroidEmulator && (envUrl.includes('10.0.2.2') || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return envUrl.replace(/10\.0\.2\.2|localhost|127\.0\.0\.1/, '172.28.0.166');
  }

  return envUrl;
}

export const API_URL = resolveApiUrl();
console.log('[API_URL resolved]', API_URL, 'Brand:', (Platform.constants as any)?.Brand, 'Model:', (Platform.constants as any)?.Model);

type Options = RequestInit & { auth?: boolean; retry?: boolean; timeout?: number };

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
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const installationId = await getInstallationId();
  const deviceModel = getDeviceModel();
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': Platform.OS,
        'X-Installation-Id': installationId,
        ...(deviceModel ? { 'X-Device-Model': deviceModel } : {}),
      },
      body: JSON.stringify({ refreshToken, installationId }),
    });
  } catch {
    clearTimeout(timeoutId);
    throw new ApiError(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeoutId);
  }
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
    } catch (error) {
      // Lỗi mạng/máy chủ tạm thời: giữ phiên để lần sau thử lại, không đăng xuất người dùng.
      if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
        return session;
      }
      await clearSession();
      return null;
    }
  }

  return session;
}

export async function apiRequest<T>(path: string, options: Options = {}): Promise<T> {
  const { auth = true, retry = true, headers, ...requestOptions } = options;
  if (options.signal?.aborted) throw new Error('Request aborted');
  const session = auth ? await getValidSession() : null;
  if (options.signal?.aborted) throw new Error('Request aborted');
  const tz = getDeviceTimeZone();
  const todayDate = getTodayISO(tz);
  const installationId = await getInstallationId();
  const deviceModel = getDeviceModel();
  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

  const method = String(requestOptions.method ?? 'GET').toUpperCase();
  // Fastify rejects empty body when Content-Type is application/json.
  // POST/PUT/PATCH without body → send "{}" so Content-Type is valid.
  const hasBody =
    requestOptions.body !== undefined && requestOptions.body !== null && requestOptions.body !== '';
  const body = !hasBody && ['POST', 'PUT', 'PATCH'].includes(method) ? '{}' : requestOptions.body;

  const controller = new AbortController();
  const timeoutMs = options.timeout ?? 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      signal: controller.signal,
      body,
      headers: {
        Accept: 'application/json',
        ...(body != null && !(typeof FormData !== 'undefined' && body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        'X-Timezone': tz,
        'X-Local-Date': todayDate,
        'X-Request-Id': requestId,
        'X-Platform': Platform.OS,
        'X-App-Version': '1.4.0',
        'X-Installation-Id': installationId,
        ...(deviceModel ? { 'X-Device-Model': deviceModel } : {}),
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...headers,
      },
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[API fetch error]', `${API_URL}${path}`, err?.message ?? err);
    const rawMsg = String(err?.message ?? '');
    if (
      err?.name === 'AbortError' ||
      rawMsg.includes('Aborted') ||
      rawMsg.includes('ConnectException') ||
      rawMsg.includes('Failed to connect') ||
      rawMsg.includes('ECONNREFUSED') ||
      rawMsg.includes('Network request failed') ||
      rawMsg.includes('fetch failed')
    ) {
      throw new ApiError(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
        0,
        'NETWORK_ERROR',
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && auth && retry && session?.refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession(session.refreshToken).finally(() => {
          refreshPromise = null;
        });
      }
      const newSession = await refreshPromise;
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
