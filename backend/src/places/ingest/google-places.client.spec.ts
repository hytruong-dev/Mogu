import { mapGoogleOpeningHours, mapGooglePlace, type GooglePlace } from './google-places.client';
import { keywordToCuisineRegex, keywordToStrictOsmRegex } from './osm.client';

describe('OSM keyword regex', () => {
  const match = (re: string, s: string) => new RegExp(re, 'i').test(s);

  it('tên món có dấu → khớp đúng dấu, không nhầm "Phố"', () => {
    const re = keywordToStrictOsmRegex('Phở');
    expect(match(re, 'Phở Hoàng')).toBe(true);
    expect(match(re, 'PHỞ BẮC HẢI')).toBe(true);
    expect(match(re, 'Xì Gòn Phố Cafe')).toBe(false);
  });

  it('tên món không dấu → khớp mọi biến thể dấu', () => {
    expect(match(keywordToStrictOsmRegex('com tam'), 'Cơm Tấm Đêm')).toBe(true);
  });

  it('cuisine regex không dấu, chấp nhận "_"', () => {
    const re = keywordToCuisineRegex('Bún bò Huế')!;
    expect(match(re, 'bun_bo_hue')).toBe(true);
    expect(keywordToCuisineRegex('Ốc')).toBeUndefined();
  });
});

const base: GooglePlace = {
  id: 'ChIJabc',
  displayName: { text: 'Bún Đậu Mắm Tôm Hẻm' },
  shortFormattedAddress: '12 Lý Thường Kiệt, Quận 10',
  location: { latitude: 10.77, longitude: 106.66 },
  rating: 4.4,
  userRatingCount: 812,
  priceRange: { startPrice: { currencyCode: 'VND', units: '40000' }, endPrice: { currencyCode: 'VND', units: '80000' } },
  googleMapsUri: 'https://maps.google.com/?cid=1',
  types: ['restaurant', 'food', 'point_of_interest'],
  businessStatus: 'OPERATIONAL',
};

describe('mapGooglePlace', () => {
  it('chuẩn hóa quán Google sang PlaceInput', () => {
    const p = mapGooglePlace(base, 'https://lh3.googleusercontent.com/x');
    expect(p).toMatchObject({
      provider: 'GOOGLE',
      providerPlaceId: 'ChIJabc',
      name: 'Bún Đậu Mắm Tôm Hẻm',
      addressShort: '12 Lý Thường Kiệt, Quận 10',
      lat: 10.77,
      lng: 106.66,
      ratingAvg: 4.4,
      ratingCount: 812,
      priceMin: 40000,
      priceMax: 80000,
      thumbnailUrl: 'https://lh3.googleusercontent.com/x',
      sourceUrl: 'https://maps.google.com/?cid=1',
    });
    expect(p?.categoryTags).toEqual(['restaurant', 'food']);
  });

  it('bỏ quán đã đóng cửa vĩnh viễn hoặc thiếu tọa độ', () => {
    expect(mapGooglePlace({ ...base, businessStatus: 'CLOSED_PERMANENTLY' })).toBeNull();
    expect(mapGooglePlace({ ...base, location: undefined })).toBeNull();
  });
});

describe('mapGoogleOpeningHours', () => {
  it('chuyển periods sang day/open/close', () => {
    expect(
      mapGoogleOpeningHours({
        periods: [{ open: { day: 1, hour: 6, minute: 30 }, close: { day: 1, hour: 21, minute: 0 } }],
      }),
    ).toEqual([{ day: 1, open: '06:30', close: '21:00' }]);
  });

  it('mở 24/7 khi chỉ có open không có close', () => {
    expect(mapGoogleOpeningHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })).toHaveLength(7);
  });

  it('không có dữ liệu → null', () => {
    expect(mapGoogleOpeningHours(undefined)).toBeNull();
  });
});
