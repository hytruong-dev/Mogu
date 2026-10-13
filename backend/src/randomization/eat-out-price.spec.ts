import { resolveEatOutPrice } from './eat-out-price';
import type { NearbyDishStat } from '../places/places.service';

describe('resolveEatOutPrice', () => {
  const mockDish = {
    dineOutPriceMin: 25000,
    dineOutPriceMax: 40000,
    priceMin: 80000,
    priceMax: 110000,
  };

  it('Ưu tiên giá quán gần khi có >= 2 quán có giá (source: NEARBY)', () => {
    const stat: NearbyDishStat = {
      placeCount: 4,
      nearestMeters: 500,
      openCount: 2,
      bestRating: 4.8,
      hasConfirmed: true,
      priceMin: 20000,
      priceMax: 35000,
      pricedPlaceCount: 3,
    };

    const result = resolveEatOutPrice(mockDish, stat);
    expect(result).toEqual({
      min: 20000,
      max: 35000,
      source: 'NEARBY',
      sampleCount: 3,
    });
  });

  it('Fallback về giá món khi chỉ có 1 quán có giá (< 2) (source: DISH)', () => {
    const stat: NearbyDishStat = {
      placeCount: 1,
      nearestMeters: 300,
      openCount: 1,
      bestRating: 4.5,
      hasConfirmed: false,
      priceMin: 55000,
      priceMax: 55000,
      pricedPlaceCount: 1,
    };

    const result = resolveEatOutPrice(mockDish, stat);
    expect(result).toEqual({
      min: 25000,
      max: 40000,
      source: 'DISH',
    });
  });

  it('Fallback về giá món khi không có quán nào có giá', () => {
    const stat: NearbyDishStat = {
      placeCount: 2,
      nearestMeters: 1200,
      openCount: 1,
      bestRating: null,
      hasConfirmed: false,
      priceMin: null,
      priceMax: null,
      pricedPlaceCount: 0,
    };

    const result = resolveEatOutPrice(mockDish, stat);
    expect(result).toEqual({
      min: 25000,
      max: 40000,
      source: 'DISH',
    });
  });

  it('Fallback về giá món khi stat là undefined hoặc null', () => {
    const result = resolveEatOutPrice(mockDish, null);
    expect(result).toEqual({
      min: 25000,
      max: 40000,
      source: 'DISH',
    });
  });

  it('Khi món chỉ có dineOutPriceMin mà không có dineOutPriceMax thì max = min', () => {
    const result = resolveEatOutPrice({ dineOutPriceMin: 30000 });
    expect(result).toEqual({
      min: 30000,
      max: 30000,
      source: 'DISH',
    });
  });

  it('Khi cả quán và món đều không có giá ăn ngoài thì trả về null', () => {
    const result = resolveEatOutPrice({ priceMin: 80000, priceMax: 110000 });
    expect(result).toBeNull();
  });
});
