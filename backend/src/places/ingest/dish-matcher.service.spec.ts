import {
  cleanMenuName,
  DishCatalogMatcher,
  MATCH_THRESHOLD_LIKELY,
  trigramSimilarity,
  trigrams,
} from './dish-matcher.service';

const catalog = new DishCatalogMatcher([
  { id: 'pho-bo', name: 'Phở bò', names: ['Phở bò', 'Pho bo'] },
  { id: 'pho', name: 'Phở', names: ['Phở'] },
  { id: 'bun-bo-hue', name: 'Bún bò Huế', names: ['Bún bò Huế', 'bun bo'] },
  { id: 'com-tam', name: 'Cơm tấm', names: ['Cơm tấm', 'Cơm tấm sườn bì chả'] },
  { id: 'banh-xeo', name: 'Bánh xèo', names: ['Bánh xèo'] },
]);

describe('trigrams / trigramSimilarity (tương thích pg_trgm)', () => {
  it('padding giống pg_trgm', () => {
    expect([...trigrams('cat')].sort()).toEqual(['  c', ' ca', 'at ', 'cat'].sort());
  });

  it('có dấu và không dấu cho cùng điểm 1.0', () => {
    expect(trigramSimilarity('Bún bò Huế', 'bun bo hue')).toBe(1);
    expect(trigramSimilarity('Đậu hũ', 'dau hu')).toBe(1);
  });

  it('chuỗi khác hẳn có điểm thấp', () => {
    expect(trigramSimilarity('Bánh xèo', 'Trà sữa')).toBeLessThan(0.2);
  });
});

describe('cleanMenuName', () => {
  it('bỏ dấu, số lượng/size và từ nhiễu', () => {
    expect(cleanMenuName('Phở Bò Tái (Size Lớn) 500ml')).toBe('pho bo tai');
    expect(cleanMenuName('Combo 2 Cơm Tấm Đặc Biệt')).toBe('com tam');
  });
});

describe('DishCatalogMatcher.matchPlace', () => {
  it('menu chứa nguyên tên món → CONFIRMED kèm giá và tên gốc', () => {
    const res = catalog.matchPlace('Quán Cô Ba', [{ name: 'Bún Bò Huế Đặc Biệt', priceVnd: 55000 }]);
    const m = res.find((r) => r.dishId === 'bun-bo-hue');
    expect(m?.status).toBe('CONFIRMED');
    expect(m?.priceVnd).toBe(55000);
    expect(m?.sourceItemName).toBe('Bún Bò Huế Đặc Biệt');
  });

  it('khớp được tên không dấu', () => {
    const res = catalog.matchPlace('Quan an', [{ name: 'banh xeo tom thit', priceVnd: 40000 }]);
    expect(res.map((r) => r.dishId)).toContain('banh-xeo');
  });

  it('ưu tiên tên món cụ thể nhất khi nhiều tên cùng được chứa ("phở bò" thay vì "phở")', () => {
    const res = catalog.matchPlace('Quán X', [{ name: 'Phở bò tái nạm', priceVnd: 60000 }]);
    expect(res.map((r) => r.dishId)).toContain('pho-bo');
    expect(res.map((r) => r.dishId)).not.toContain('pho');
  });

  it('match chỉ dựa trên tên quán bị giới hạn ở LIKELY', () => {
    const res = catalog.matchPlace('Cơm Tấm Ba Ghiền', []);
    const m = res.find((r) => r.dishId === 'com-tam');
    expect(m?.status).toBe('LIKELY');
    expect(m?.sourceItemName).toBeNull();
  });

  it('menu CONFIRMED thắng tên quán LIKELY và giữ giá thấp nhất', () => {
    const res = catalog.matchPlace('Bún Bò Huế O Xuân', [
      { name: 'Bún bò huế giò', priceVnd: 65000 },
      { name: 'Bún bò huế thường', priceVnd: 45000 },
    ]);
    const m = res.find((r) => r.dishId === 'bun-bo-hue');
    expect(m?.status).toBe('CONFIRMED');
    expect(m?.priceVnd).toBe(45000);
  });

  it('không match món không liên quan', () => {
    const res = catalog.matchPlace('The Coffee House', [
      { name: 'Trà sữa trân châu', priceVnd: 35000 },
      { name: 'Cà phê sữa đá', priceVnd: 29000 },
    ]);
    expect(res).toEqual([]);
  });

  it('mọi kết quả đều đạt ngưỡng LIKELY', () => {
    const res = catalog.matchPlace('Bánh Xèo Mười Xiềm', [{ name: 'Bánh xèo miền Tây' }]);
    for (const r of res) expect(r.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD_LIKELY);
  });
});
