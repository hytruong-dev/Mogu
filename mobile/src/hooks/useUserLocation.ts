import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Lấy vị trí hiện tại (dùng chung toàn app, cache 5 phút).
 * - Ưu tiên trả ngay vị trí lastKnown từ hệ điều hành (0-10ms) để không làm đơ UI.
 * - Chạy tinh chỉnh GPS (Balanced) ở nền để cập nhật nếu người dùng di chuyển >100m.
 * - `request = false`: chỉ đọc khi quyền đã được cấp, không hiện hộp thoại xin quyền.
 * - `request = true`: hiện hộp thoại xin quyền nếu chưa có.
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
        lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
      } catch {
        // ignore
      }

      // Kích hoạt việc tinh chỉnh vị trí GPS chính xác ở nền
      const refineGpsInBackground = () => {
        void (async () => {
          try {
            const freshPos = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
            ]);
            if (freshPos) {
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
      };

      if (lastKnown) {
        const coords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
        cached = { coords, at: Date.now() };
        // Tinh chỉnh ở nền
        refineGpsInBackground();
        return coords;
      }

      // 2. Chưa có lastKnown (vừa bật máy hoặc chưa từng lấy GPS) -> chờ getCurrentPositionAsync tối đa 5s
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
      } catch {
        try {
          pos = await Location.getLastKnownPositionAsync();
        } catch {
          // ignore
        }
      }

      if (!pos) return null;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      cached = { coords, at: Date.now() };
      return coords;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Hook React: trạng thái quyền + tọa độ người dùng, kèm hàm `request()` để xin quyền thủ công. */
export function useUserLocation(options?: { requestOnMount?: boolean }) {
  const [coords, setCoords] = useState<UserCoords | null>(getCachedUserLocation());
  const [status, setStatus] = useState<LocationStatus>(coords ? 'granted' : 'unknown');
  const [loading, setLoading] = useState(!coords);
  const mounted = useRef(true);

  const load = useCallback(async (request: boolean, force = false, silent = false) => {
    if (!silent) setLoading(true);
    const c = await fetchUserLocation({ request, force });
    if (!mounted.current) return c;
    if (c) {
      // Bỏ qua dao động GPS nhỏ để không gọi lại API quán gần vô ích
      setCoords((prev) => (prev && distanceMeters(prev, c) < MIN_MOVE_M ? prev : c));
      setStatus('granted');
    } else if (!silent) {
      setStatus('denied');
    }
    if (!silent) setLoading(false);
    return c;
  }, []);

  useEffect(() => {
    const onLocationUpdated = (newCoords: UserCoords) => {
      if (!mounted.current) return;
      setCoords((prev) => (prev && distanceMeters(prev, newCoords) < MIN_MOVE_M ? prev : newCoords));
      setStatus('granted');
      setLoading(false);
    };
    listeners.add(onLocationUpdated);
    return () => {
      listeners.delete(onLocationUpdated);
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!coords) void load(!!options?.requestOnMount);
    else {
      setLoading(false);
      // Có vị trí cache → vẫn lấy lại GPS ở nền (người dùng có thể đã di chuyển)
      void load(false, true, true);
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = useCallback(() => load(true, true), [load]);
  const refresh = useCallback(() => load(false, true), [load]);

  return { coords, status, loading, request, refresh };
}
