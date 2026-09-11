export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Device IANA timezone, fallback VN. */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Today as YYYY-MM-DD in the given or device timezone. */
export function getTodayISO(timezone?: string): string {
  const tz = timezone ?? getDeviceTimeZone();
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

/** Parse plan date string (YYYY-MM-DD) as local calendar date. */
export function parsePlanDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekdayIndex(iso: string): number {
  return parsePlanDate(iso).getDay();
}

/** Format date-only ISO for display in VN locale. */
export function formatPlanDateShort(iso: string): string {
  const d = parsePlanDate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatPlanWeekdayFull(iso: string): string {
  const idx = getWeekdayIndex(iso);
  const fulls = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return fulls[idx] ?? '';
}

export function formatPlanWeekdayShort(iso: string): string {
  const idx = getWeekdayIndex(iso);
  const shorts = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return shorts[idx] ?? '';
}

export function isTodayISO(iso: string): boolean {
  return iso === getTodayISO();
}
