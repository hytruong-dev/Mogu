import { GeoapifyClient, mapGeoapifyPlace, type GeoapifyFeature } from './geoapify.client';

describe('Geoapify Places API Client', () => {
  describe('mapGeoapifyPlace', () => {
    it('maps Geoapify feature to PlaceInput correctly', () => {
      const sampleFeature: GeoapifyFeature = {
        type: 'Feature',
        properties: {
          place_id: 'geo_place_123',
          name: 'Phở Lệ',
          formatted: '415 Nguyễn Trãi, Phường 7, Quận 5, Thành phố Hồ Chí Minh',
          categories: ['catering.restaurant', 'catering.restaurant.vietnamese'],
          opening_hours: 'Mo-Su 06:00-01:00',
          lat: 10.75345,
          lon: 106.66789,
          website: 'https://phole.vn',
        },
        geometry: {
          type: 'Point',
          coordinates: [106.66789, 10.75345],
        },
      };

      const place = mapGeoapifyPlace(sampleFeature);
      expect(place).not.toBeNull();
      expect(place?.provider).toBe('GEOAPIFY');
      expect(place?.providerPlaceId).toBe('geo_place_123');
      expect(place?.name).toBe('Phở Lệ');
      expect(place?.addressShort).toBe('415 Nguyễn Trãi, Phường 7, Quận 5, Thành phố Hồ Chí Minh');
      expect(place?.lat).toBe(10.75345);
      expect(place?.lng).toBe(106.66789);
      expect(place?.categoryTags).toEqual(['restaurant', 'restaurant vietnamese']);
      expect(place?.openingHours).toBeDefined();
      expect(place?.openingHours?.length).toBeGreaterThan(0);
      expect(place?.sourceUrl).toBe('https://phole.vn');
    });

    it('falls back to coordinates from geometry and fallback search URL', () => {
      const feature: GeoapifyFeature = {
        type: 'Feature',
        properties: {
          place_id: 'geo_456',
          name: 'Bún Bò Huế Ba Đô',
          address_line1: '123 Cách Mạng Tháng 8',
          address_line2: 'Quận 10, TP.HCM',
        },
        geometry: {
          type: 'Point',
          coordinates: [106.68, 10.77],
        },
      };

      const place = mapGeoapifyPlace(feature);
      expect(place).not.toBeNull();
      expect(place?.lat).toBe(10.77);
      expect(place?.lng).toBe(106.68);
      expect(place?.addressShort).toBe('123 Cách Mạng Tháng 8, Quận 10, TP.HCM');
      expect(place?.sourceUrl).toContain('B%C3%BAn%20B%C3%B2%20Hu%E1%BA%BF%20Ba%20%C4%90%C3%B4');
    });

    it('returns null if required fields are missing', () => {
      expect(mapGeoapifyPlace({} as any)).toBeNull();
      expect(
        mapGeoapifyPlace({
          type: 'Feature',
          properties: { place_id: '123' },
        } as any),
      ).toBeNull();
      expect(
        mapGeoapifyPlace({
          type: 'Feature',
          properties: { place_id: '123', name: 'Test' },
        } as any),
      ).toBeNull();
    });
  });

  describe('GeoapifyClient.fromEnv', () => {
    const origKey = process.env.GEOAPIFY_API_KEY;

    afterEach(() => {
      if (origKey !== undefined) process.env.GEOAPIFY_API_KEY = origKey;
      else delete process.env.GEOAPIFY_API_KEY;
    });

    it('returns null when GEOAPIFY_API_KEY is not set', () => {
      delete process.env.GEOAPIFY_API_KEY;
      expect(GeoapifyClient.fromEnv()).toBeNull();
    });

    it('returns client instance when GEOAPIFY_API_KEY is set', () => {
      process.env.GEOAPIFY_API_KEY = 'test_geoapify_key';
      expect(GeoapifyClient.fromEnv()).toBeInstanceOf(GeoapifyClient);
    });
  });
});
