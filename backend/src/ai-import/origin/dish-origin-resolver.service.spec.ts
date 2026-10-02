import { DishOriginResolverService } from './dish-origin-resolver.service';
import { TaxonomySnapshot } from '../ai-import.types';

const snapshot: TaxonomySnapshot = {
  version: 'test',
  createdAt: new Date().toISOString(),
  regions: [
    { id: 'r-north', code: 'NORTH', name: 'Miền Bắc' },
    { id: 'r-central', code: 'CENTRAL', name: 'Miền Trung' },
    { id: 'r-south', code: 'SOUTH', name: 'Miền Nam' },
  ],
  provinces: [
    { id: 'p-hn', code: 'HN', name: 'Hà Nội', regionId: 'r-north' },
    { id: 'p-hue', code: 'HUE', name: 'Thừa Thiên Huế', regionId: 'r-central' },
    { id: 'p-qn', code: 'QN', name: 'Quảng Nam', regionId: 'r-central' },
    { id: 'p-hcm', code: 'HCM', name: 'TP. Hồ Chí Minh', regionId: 'r-south' },
  ],
  categories: [],
  mealTypes: [],
  goals: [],
  dietTypes: [],
  flavors: [],
  dishTypes: [],
  units: [],
};

describe('DishOriginResolverService', () => {
  let service: DishOriginResolverService;

  beforeEach(() => {
    service = new DishOriginResolverService();
  });

  it('resolves "Bún bò Huế" to CENTRAL / HUE via gazetteer', () => {
    const result = service.resolve({ dishName: 'Bún bò Huế', snapshot });
    expect(result.source).toBe('GAZETTEER');
    expect(result.regionCode).toBe('CENTRAL');
    expect(result.provinceCode).toBe('HUE');
    expect(result.regionId).toBe('r-central');
    expect(result.provinceId).toBe('p-hue');
    expect(result.originText).toContain('Thừa Thiên Huế');
    expect(result.originText).toContain('Miền Trung');
    expect(result.isRegionalSpecialty).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(95);
  });

  it('resolves "Phở bò Hà Nội" to NORTH / HN', () => {
    const result = service.resolve({ dishName: 'Phở bò Hà Nội', snapshot });
    expect(result.regionCode).toBe('NORTH');
    expect(result.provinceCode).toBe('HN');
    expect(result.provinceId).toBe('p-hn');
  });

  it('resolves "Mì Quảng" to CENTRAL / QN', () => {
    const result = service.resolve({ dishName: 'Mì Quảng', snapshot });
    expect(result.regionCode).toBe('CENTRAL');
    expect(result.provinceCode).toBe('QN');
  });

  it('prefers gazetteer over AI origin when both exist', () => {
    const result = service.resolve({
      dishName: 'Bún bò Huế',
      aiOrigin: { regionCode: 'SOUTH', provinceCode: 'HCM', isRegionalSpecialty: false, confidence: 80 },
      snapshot,
    });
    expect(result.source).toBe('GAZETTEER');
    expect(result.provinceCode).toBe('HUE');
    expect(result.regionCode).toBe('CENTRAL');
  });

  it('fixes region/province mismatch from AI by deriving region from province', () => {
    const result = service.resolve({
      dishName: 'Món lạ không có trong gazetteer',
      aiOrigin: { regionCode: 'NORTH', provinceCode: 'HUE', isRegionalSpecialty: true, confidence: 70 },
      snapshot,
    });
    expect(result.source).toBe('AI');
    expect(result.provinceCode).toBe('HUE');
    expect(result.regionCode).toBe('CENTRAL');
    expect(result.regionId).toBe('r-central');
    expect(result.notes.some((n) => n.includes('không khớp'))).toBe(true);
  });

  it('falls back to regionHint when gazetteer + AI do not match', () => {
    const result = service.resolve({
      dishName: 'Món lạ không có trong gazetteer',
      regionHint: 'south',
      snapshot,
    });
    expect(result.source).toBe('HINT');
    expect(result.regionCode).toBe('SOUTH');
    expect(result.regionId).toBe('r-south');
    expect(result.provinceId).toBeNull();
    expect(result.originText).toBe('Miền Nam');
  });

  it('returns NONE when nothing can be resolved', () => {
    const result = service.resolve({ dishName: 'Món lạ không có trong gazetteer', snapshot });
    expect(result.source).toBe('NONE');
    expect(result.regionId).toBeNull();
    expect(result.provinceId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('toCandidate maps resolved origin into OriginCandidate', () => {
    const resolved = service.resolve({ dishName: 'Bún bò Huế', snapshot });
    const candidate = service.toCandidate(resolved);
    expect(candidate.regionCode).toBe('CENTRAL');
    expect(candidate.provinceCode).toBe('HUE');
    expect(candidate.isRegionalSpecialty).toBe(true);
    expect(candidate.reason).toContain('GAZETTEER');
  });
});
