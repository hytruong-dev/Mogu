import { computeOpenStatus } from '../places-geo.util';
import { mapOsmElement, parseOsmOpeningHours } from './osm.client';
import { mapShopeeFoodInfo, parseShopeeFoodMenu } from './shopeefood.client';

describe('parseOsmOpeningHours', () => {
  it('24/7 → mở cả ngày mọi thứ', () => {
    const hours = parseOsmOpeningHours('24/7');
    expect(hours).toHaveLength(7);
    expect(computeOpenStatus(hours)).toBe('OPEN');
  });

  it('khoảng giờ không ghi thứ → áp dụng mọi ngày', () => {
    expect(parseOsmOpeningHours('06:00-22:00')).toHaveLength(7);
  });

  it('nhiều rule theo thứ + nhiều khung giờ', () => {
    const hours = parseOsmOpeningHours('Mo-Fr 07:00-10:00,16:00-21:00; Sa,Su 08:00-23:00')!;
    expect(hours.filter((h) => h.day === 1)).toEqual([
      { day: 1, open: '07:00', close: '10:00' },
      { day: 1, open: '16:00', close: '21:00' },
    ]);
    expect(hours.filter((h) => h.day === 0)).toEqual([{ day: 0, open: '08:00', close: '23:00' }]);
  });

  it('dải thứ vòng qua Chủ nhật (Fr-Mo)', () => {
    const days = new Set(parseOsmOpeningHours('Fr-Mo 10:00-20:00')!.map((h) => h.day));
    expect([...days].sort()).toEqual([0, 1, 5, 6]);
  });

  it('cú pháp không hỗ trợ → null', () => {
    expect(parseOsmOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOsmOpeningHours('')).toBeNull();
  });
});

describe('mapOsmElement', () => {
  it('map node OSM sang PlaceInput', () => {
    const p = mapOsmElement({
      type: 'node',
      id: 123,
      lat: 10.78,
      lon: 106.7,
      tags: {
        amenity: 'restaurant',
        name: 'Phở Hòa',
        cuisine: 'vietnamese;noodle_soup',
        'addr:housenumber': '260C',
        'addr:street': 'Pasteur',
        opening_hours: '06:00-22:00',
      },
    })!;
    expect(p.provider).toBe('OSM');
    expect(p.providerPlaceId).toBe('node/123');
    expect(p.addressShort).toBe('260C, Pasteur');
    expect(p.categoryTags).toEqual(['restaurant', 'vietnamese', 'noodle soup']);
    expect(p.sourceUrl).toBe('https://www.openstreetmap.org/node/123');
    expect(p.ratingAvg).toBeUndefined();
  });

  it('way dùng toạ độ center', () => {
    const p = mapOsmElement({ type: 'way', id: 9, center: { lat: 10.1, lon: 106.2 }, tags: { name: 'Quán A' } })!;
    expect([p.lat, p.lng]).toEqual([10.1, 106.2]);
  });

  it('bỏ phần tử không có tên', () => {
    expect(mapOsmElement({ type: 'node', id: 1, lat: 1, lon: 1, tags: {} })).toBeNull();
  });
});

describe('ShopeeFood mapping (payload thật từ delivery/get_infos)', () => {
  const info = {
    restaurant_id: 1274750,
    delivery_id: 430326,
    city_id: 217,
    name: 'Phở Bò Xương Không Bột Ngọt - Tuệ Tĩnh',
    address: 'Căn 001, Chung Cư Tuệ Tĩnh, Đường Tuệ Tĩnh, P. 12, Quận 11, TP. HCM',
    url: 'https://shopeefood.vn/ho-chi-minh/pho-bo-xuong-khong-bot-ngot-tue-tinh',
    rating: { total_review: 500, avg: 4.7 },
    position: { latitude: 10.76224343, longitude: 106.6546146, is_verified: false },
    operating: { status: 1, open_time: '06:00:00', close_time: '23:00:59' },
    categories: ['Quán ăn'],
    cuisines: [],
    price_range: {},
    photos: [{ width: 60, value: 'https://mms.img.susercontent.com/x@resize_ss60x60', height: 60 }],
  };

  it('map rating, toạ độ, giờ mở, nguồn', () => {
    const p = mapShopeeFoodInfo(info, [
      { name: 'Phở bò tái', priceVnd: 45000 },
      { name: 'Phở bò đặc biệt', priceVnd: 65000 },
    ])!;
    expect(p.provider).toBe('SHOPEEFOOD');
    expect(p.providerPlaceId).toBe('1274750');
    expect(p.ratingAvg).toBe(4.7);
    expect(p.ratingCount).toBe(500);
    expect(p.lat).toBeCloseTo(10.7622, 3);
    expect(p.openingHours).toHaveLength(7);
    expect(p.openingHours![0]).toMatchObject({ open: '06:00', close: '23:00' });
    expect(p.priceMin).toBe(45000); // suy ra từ menu khi price_range rỗng
    expect(p.priceMax).toBe(65000);
    expect(p.sourceUrl).toBe(info.url);
    expect((p.raw as any).deliveryId).toBe(430326);
  });

  it('mở 00:00:01-23:59:59 → coi như 24h', () => {
    const p = mapShopeeFoodInfo({
      ...info,
      operating: { open_time: '00:00:01', close_time: '23:59:59' },
    })!;
    expect(computeOpenStatus(p.openingHours)).toBe('OPEN');
  });

  it('parse menu get_delivery_dishes, ưu tiên giá giảm', () => {
    const menu = parseShopeeFoodMenu({
      menu_infos: [
        {
          dish_type_name: 'Phở',
          dishes: [
            { name: 'Phở bò tái', price: { value: 50000 }, discount_price: { value: 42000 } },
            { name: 'Trà đá', price: { value: 0 } },
          ],
        },
      ],
    });
    expect(menu).toEqual([
      { name: 'Phở bò tái', priceVnd: 42000 },
      { name: 'Trà đá', priceVnd: null },
    ]);
  });
});
