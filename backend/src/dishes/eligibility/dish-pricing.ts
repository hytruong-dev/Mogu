/**
 * Giá dùng cho kế hoạch tuần.
 *
 * - `priceMin`        : tổng chi phí nguyên liệu cho CẢ công thức (nấu tại nhà).
 * - `dineOutPriceMin` : giá ăn ngoài cho 1 phần.
 *
 * Ngân sách kế hoạch tính theo 1 bữa / 1 phần ăn, nên giá nấu được chia cho số khẩu phần.
 */

export type PlanMealMode = 'HOME_COOK' | 'EAT_OUT' | 'FLEXIBLE';
export type PlanPriceSource = 'COOK' | 'EAT_OUT';

export interface PricingDishInput {
  priceMin?: unknown;
  dineOutPriceMin?: unknown;
  servings?: unknown;
}

export interface ResolvedPlanPrice {
  priceVnd: number;
  source: PlanPriceSource;
  /** Giá nấu / 1 khẩu phần (null nếu món không có giá nấu) */
  cookPerServing: number | null;
  /** Giá ăn ngoài / 1 phần (null nếu món không có giá ăn ngoài) */
  eatOut: number | null;
  servings: number;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMealMode(v: unknown): PlanMealMode {
  return v === 'HOME_COOK' || v === 'EAT_OUT' || v === 'FLEXIBLE' ? v : 'FLEXIBLE';
}

/** Suy ra mode từ cờ cũ khi config/snapshot chưa có mealMode. */
export function inferMealModeFromLegacy(
  preferHomeCook?: boolean | null,
  allowOutsideMeals?: boolean | null,
): PlanMealMode {
  void preferHomeCook;
  if (allowOutsideMeals === false) return 'HOME_COOK';
  return 'FLEXIBLE';
}

export function servingsOf(servings: unknown): number {
  const s = toNum(servings);
  return s != null && s >= 1 ? s : 1;
}

/** Trả null nếu món không có giá hợp lệ theo mode. */
export function resolvePlanPrice(
  dish: PricingDishInput,
  mode: PlanMealMode,
): ResolvedPlanPrice | null {
  const servings = servingsOf(dish.servings);
  const cookTotal = toNum(dish.priceMin);
  const eatOutRaw = toNum(dish.dineOutPriceMin);

  const cookPerServing =
    cookTotal != null && cookTotal > 0 ? Math.round(cookTotal / servings) : null;
  const eatOut = eatOutRaw != null && eatOutRaw > 0 ? Math.round(eatOutRaw) : null;

  const make = (priceVnd: number, source: PlanPriceSource): ResolvedPlanPrice => ({
    priceVnd,
    source,
    cookPerServing,
    eatOut,
    servings,
  });

  if (mode === 'HOME_COOK') {
    return cookPerServing != null ? make(cookPerServing, 'COOK') : null;
  }
  if (mode === 'EAT_OUT') {
    return eatOut != null ? make(eatOut, 'EAT_OUT') : null;
  }
  // FLEXIBLE: lấy giá thấp hơn trong các giá hợp lệ
  if (cookPerServing != null && eatOut != null) {
    return eatOut <= cookPerServing ? make(eatOut, 'EAT_OUT') : make(cookPerServing, 'COOK');
  }
  if (cookPerServing != null) return make(cookPerServing, 'COOK');
  if (eatOut != null) return make(eatOut, 'EAT_OUT');
  return null;
}

/** Làm tròn lên bội số `step` (mặc định 10.000đ). */
export function roundUpBudget(n: number, step = 10000): number {
  if (n <= 0) return 0;
  return Math.ceil(n / step) * step;
}
