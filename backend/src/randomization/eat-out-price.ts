import type { NearbyDishStat } from '../places/places.service';

export interface EatOutDishInput {
  dineOutPriceMin?: number | null;
  dineOutPriceMax?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export type EatOutPriceSource = 'NEARBY' | 'DISH';

export interface ResolvedEatOutPrice {
  min: number;
  max: number;
  source: EatOutPriceSource;
  /** Số quán dùng để tính giá nếu source === 'NEARBY' */
  sampleCount?: number;
}

/**
 * Ngưỡng tối thiểu số quán có giá trong bán kính để tin cậy dùng giá quán thực tế.
 * Nếu < 2 quán có giá → dùng dineOutPriceMin/dineOutPriceMax được kiểm duyệt của món.
 */
export const MIN_NEARBY_PRICE_PLACES = 2;

/**
 * Tính giá ăn ngoài thực tế (hybrid):
 * 1. Nếu có ít nhất 2 quán gần có giá: dùng khoảng giá p25..p75 từ các quán lân cận.
 * 2. Ngược lại: dùng dineOutPriceMin/dineOutPriceMax từ bảng dishes.
 * 3. Nếu món chưa có dineOutPrice: trả về null (không lọc theo budget).
 */
export function resolveEatOutPrice(
  dish: EatOutDishInput,
  stat?: NearbyDishStat | null,
): ResolvedEatOutPrice | null {
  if (
    stat &&
    stat.pricedPlaceCount >= MIN_NEARBY_PRICE_PLACES &&
    stat.priceMin != null &&
    stat.priceMin > 0
  ) {
    const min = Math.round(stat.priceMin);
    const max = Math.round(stat.priceMax != null && stat.priceMax >= min ? stat.priceMax : min);
    return {
      min,
      max,
      source: 'NEARBY',
      sampleCount: stat.pricedPlaceCount,
    };
  }

  const dMin =
    dish.dineOutPriceMin != null && dish.dineOutPriceMin > 0
      ? Math.round(dish.dineOutPriceMin)
      : null;
  const dMax =
    dish.dineOutPriceMax != null && dish.dineOutPriceMax > 0
      ? Math.round(dish.dineOutPriceMax)
      : null;

  if (dMin != null) {
    const max = dMax != null && dMax >= dMin ? dMax : dMin;
    return {
      min: dMin,
      max,
      source: 'DISH',
    };
  }

  return null;
}
