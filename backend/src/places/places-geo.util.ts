/**
 * Tiện ích địa lý + giờ mở cửa cho Places (không phụ thuộc PostGIS).
 */

export type OpenStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/** [{ day: 0-6 (0 = Chủ nhật), open: "HH:mm", close: "HH:mm" }] */
export type OpeningHoursEntry = { day: number; open: string; close: string };

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Hộp bao (bounding box) quanh 1 điểm — lọc thô trước khi tính haversine. */
export function boundingBox(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLng = radiusM / (111_320 * cosLat);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function isValidCoord(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** Thứ (0=CN) + phút trong ngày theo giờ Việt Nam. */
export function vietnamDayMinutes(now = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { day: Math.max(0, days.indexOf(wd)), minutes: hour * 60 + minute };
}

export function parseOpeningHours(raw: unknown): OpeningHoursEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is OpeningHoursEntry =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as any).day === 'number' &&
      typeof (e as any).open === 'string' &&
      typeof (e as any).close === 'string',
  );
}

/** Tính trạng thái mở cửa hiện tại theo giờ VN (hỗ trợ ca qua đêm, vd 18:00–02:00). */
export function computeOpenStatus(raw: unknown, now = new Date()): OpenStatus {
  const entries = parseOpeningHours(raw);
  if (entries.length === 0) return 'UNKNOWN';
  const { day, minutes } = vietnamDayMinutes(now);
  const prevDay = (day + 6) % 7;
  for (const e of entries) {
    const open = toMinutes(e.open);
    const close = toMinutes(e.close);
    if (open == null || close == null) continue;
    if (open === close) {
      if (e.day === day) return 'OPEN'; // mở 24h
      continue;
    }
    if (close > open) {
      if (e.day === day && minutes >= open && minutes < close) return 'OPEN';
    } else {
      // Qua đêm
      if (e.day === day && minutes >= open) return 'OPEN';
      if (e.day === prevDay && minutes < close) return 'OPEN';
    }
  }
  return 'CLOSED';
}

export function formatPriceRange(min?: number | null, max?: number | null): string | null {
  const fmt = (v: number) => `${Math.round(v / 1000)}k`;
  if (min && max && max !== min) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `từ ${fmt(min)}`;
  if (max) return `đến ${fmt(max)}`;
  return null;
}
