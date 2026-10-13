import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type UserCoords = { lat: number; lng: number };
export type LocationStatus = 'unknown' | 'granted' | 'denied';

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Chỉ cập nhật tọa độ khi người dùng di chuyển quá ngưỡng này. */
const MIN_MOVE_M = 100;

function distanceMeters(a: UserCoords, b: UserCoords): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function checkIsAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as any;
  const brand = String(c?.Brand || '').toLowerCase();
  const model = String(c?.Model || '').toLowerCase();
  const fingerprint = String(c?.Fingerprint || '').toLowerCase();
  const hardware = String(c?.Hardware || '').toLowerCase();
  return (
    brand === 'google' ||
    model.includes('emulator') ||
    model.includes('sdk_gphone') ||
    fingerprint.includes('generic') ||
    hardware.includes('goldfish') ||
    hardware.includes('ranchu')
  );
}

let cached: { coords: UserCoords; at: number } | null = null;
let inflight: Promise<UserCoords | null> | null = null;
type LocationListener = (coords: UserCoords) => void;
const listeners = new Set<LocationListener>();

function notifyLocationUpdate(coords: UserCoords) {
  for (const listener of listeners) {
    try {
      listener(coords);
    } catch {
      // ignore
    }
  }
}

/** Vị trí đã cache còn hạn (5 phút) — dùng đồng bộ, không xin quyền. */
export function getCachedUserLocation(): UserCoords | null {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.coords;
  return null;
}

/** Tinh chỉnh GPS nền */
function refineGpsInBackground() {
  void (async () => {
    try {
      const freshPos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (freshPos?.coords) {
        const freshCoords = { lat: freshPos.coords.latitude, lng: freshPos.coords.longitude };
        const prev = cached?.coords;
        cached = { coords: freshCoords, at: Date.now() };
        if (!prev || distanceMeters(prev, freshCoords) >= MIN_MOVE_M) {
          notifyLocationUpdate(freshCoords);
        }
      }
    } catch {
      // ignore background gps failure
    }
  })();
}

/**
 * Lấy vị trí hiện tại (dùng chung toàn app, cache 5 phút).
 * - Ưu tiên trả ngay vị trí lastKnown từ hệ điều hành (0-10ms) để không làm đơ UI.
 * - Chạy tinh chỉnh GPS (Balanced) ở nền để cập nhật nếu người dùng di chuyển >100m.
 * - Fallback nhiều cấp: lastKnown -> Balanced -> High -> Lowest -> Emulator HCM center.
 */
export async function fetchUserLocation(opts?: {
  request?: boolean;
  force?: boolean;
}): Promise<UserCoords | null> {
  if (!opts?.force) {
    const c = getCachedUserLocation();
    if (c) return c;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const perm = opts?.request
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return null;

      // 1. Thử lấy vị trí gần nhất từ hệ điều hành (nhanh < 10ms)
      let lastKnown: Location.LocationObject | null = null;
      try {
        lastKnown = await Location.getLastKnownPositionAsync();
      } catch {
        // ignore
      }

      if (lastKnown?.coords) {
        const coords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
        cached = { coords, at: Date.now() };
        refineGpsInBackground();
        return coords;
      }

      // 2. Chưa có lastKnown -> Thử lấy fresh GPS
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]);
      } catch {
        // ignore
      }

      if (!pos) {
        try {
          pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
          ]);
        } catch {
          // ignore
        }
      }

      if (!pos) {
        try {
          pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
        } catch {
          // ignore
        }
      }

      if (pos?.coords) {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cached = { coords, at: Date.now() };
        return coords;
      }

      // 3. Fallback cho Android Emulator trong môi trường dev/test khi emulator chưa giả lập GPS
      if (checkIsAndroidEmulator()) {
        const coords = { lat: 10.7769, lng: 106.7009 };
        cached = { coords, at: Date.now() };
        return coords;
      }

      return null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Hook React: trạng thái quyền + tọa độ người dùng, tự động theo dõi foreground/background và GPS. */
export function useUserLocation(options?: { requestOnMount?: boolean }) {
  const [coords, setCoords] = useState<UserCoords | null>(getCachedUserLocation());
  const [status, setStatus] = useState<LocationStatus>(coords ? 'granted' : 'unknown');
  const [permissionGranted, setPermissionGranted] = useState(Boolean(coords));
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [loading, setLoading] = useState(!coords);
  const mounted = useRef(true);

  const checkPermissionsAndServices = useCallback(async (request: boolean) => {
    try {
      const perm = request
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      const granted = perm.status === 'granted';
      const askAgain = perm.canAskAgain !== false;
      const srvEnabled = await Location.hasServicesEnabledAsync().catch(() => true);

      if (mounted.current) {
        setPermissionGranted(granted);
        setCanAskAgain(askAgain);
        setServicesEnabled(srvEnabled);
        setStatus(granted ? 'granted' : 'denied');
      }
      return { granted, askAgain, srvEnabled };
    } catch {
      return { granted: false, askAgain: true, srvEnabled: true };
    }
  }, []);

  const load = useCallback(
    async (request: boolean, force = false, silent = false) => {
      if (!silent) setLoading(true);
      const permCheck = await checkPermissionsAndServices(request);

      if (!permCheck.granted) {
        if (mounted.current) {
          if (!silent) setLoading(false);
        }
        return null;
      }

      const c = await fetchUserLocation({ request, force });
      if (!mounted.current) return c;

      if (c) {
        setCoords((prev) => (prev && distanceMeters(prev, c) < MIN_MOVE_M ? prev : c));
        setStatus('granted');
        setPermissionGranted(true);
      }
      if (!silent) setLoading(false);
      return c;
    },
    [checkPermissionsAndServices]
  );

  // Lắng nghe cập nhật GPS khi có thay đổi tọa độ
  useEffect(() => {
    const onLocationUpdated = (newCoords: UserCoords) => {
      if (!mounted.current) return;
      setCoords((prev) => (prev && distanceMeters(prev, newCoords) < MIN_MOVE_M ? prev : newCoords));
      setStatus('granted');
      setPermissionGranted(true);
      setLoading(false);
    };
    listeners.add(onLocationUpdated);
    return () => {
      listeners.delete(onLocationUpdated);
    };
  }, []);

  // Lắng nghe khi app trở lại foreground (sau khi người dùng vào Cài đặt để bật quyền/GPS)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void load(false, true, true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    if (!coords) {
      void load(!!options?.requestOnMount);
    } else {
      setLoading(false);
      void load(false, true, true);
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = useCallback(() => load(true, true), [load]);
  const refresh = useCallback(() => load(false, true), [load]);

  const promptEnableServices = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        void load(false, true);
        return true;
      } catch {
        // User cancelled or unsupported
      }
    }
    void Linking.openSettings();
    return false;
  }, [load]);

  return {
    coords,
    status,
    permissionGranted,
    servicesEnabled,
    canAskAgain,
    loading,
    request,
    refresh,
    promptEnableServices,
  };
}
