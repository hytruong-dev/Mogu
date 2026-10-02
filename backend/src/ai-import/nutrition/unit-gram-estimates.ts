import { normalizeVietnamese } from '../ingredient.service';

/**
 * Ước lượng khối lượng (gram) cho 1 đơn vị đếm/thể tích phổ biến trong bếp Việt.
 * Dùng khi nguyên liệu không có normalizedWeightGram. Giá trị trung bình thực tế.
 */
export const UNIT_GRAM_DEFAULTS: Record<string, number> = {
  G: 1,
  KG: 1000,
  MG: 0.001,
  ML: 1,
  L: 1000,
  TSP: 5,
  TBSP: 15,
  CUP: 240,
  'MUỖNG CÀ PHÊ': 5,
  'MUỖNG CANH': 15,
  'THÌA CÀ PHÊ': 5,
  'THÌA CANH': 15,
  CHÉN: 240,
  BÁT: 300,
  TÔ: 400,
  LY: 240,
  ĐĨA: 250,
  PHẦN: 300,
  GÓI: 50,
  MIẾNG: 30,
  LÁT: 10,
  LÁ: 2,
  NHÁNH: 5,
  TÉP: 4,
  CÂY: 15,
  CỦ: 60,
  QUẢ: 60,
  TRÁI: 60,
  CÁI: 50,
  CON: 150,
  BÓ: 100,
  NẮM: 30,
  'VỪA_ĐỦ': 5,
  'MỘT_ÍT': 3,
};

/**
 * Ghi đè theo nguyên liệu cụ thể (pattern đã normalize) cho đơn vị đếm.
 * Ví dụ: 1 quả trứng gà ~55g, 1 củ hành tím ~15g, 1 cây sả ~15g.
 */
export const INGREDIENT_UNIT_GRAMS: Array<{ pattern: string; unit: string; grams: number }> = [
  { pattern: 'trung ga', unit: 'QUẢ', grams: 55 },
  { pattern: 'trung vit', unit: 'QUẢ', grams: 70 },
  { pattern: 'trung cut', unit: 'QUẢ', grams: 10 },
  { pattern: 'trung', unit: 'QUẢ', grams: 55 },
  { pattern: 'hanh tim', unit: 'CỦ', grams: 15 },
  { pattern: 'hanh tay', unit: 'CỦ', grams: 120 },
  { pattern: 'toi', unit: 'CỦ', grams: 30 },
  { pattern: 'toi', unit: 'TÉP', grams: 4 },
  { pattern: 'gung', unit: 'CỦ', grams: 40 },
  { pattern: 'gung', unit: 'NHÁNH', grams: 20 },
  { pattern: 'nghe', unit: 'CỦ', grams: 25 },
  { pattern: 'ca rot', unit: 'CỦ', grams: 80 },
  { pattern: 'khoai tay', unit: 'CỦ', grams: 120 },
  { pattern: 'khoai lang', unit: 'CỦ', grams: 150 },
  { pattern: 'cu cai', unit: 'CỦ', grams: 250 },
  { pattern: 'sa', unit: 'CÂY', grams: 15 },
  { pattern: 'sa', unit: 'NHÁNH', grams: 15 },
  { pattern: 'hanh la', unit: 'CÂY', grams: 8 },
  { pattern: 'hanh la', unit: 'NHÁNH', grams: 8 },
  { pattern: 'ngo', unit: 'CÂY', grams: 5 },
  { pattern: 'rau mui', unit: 'CÂY', grams: 5 },
  { pattern: 'ca chua', unit: 'QUẢ', grams: 100 },
  { pattern: 'ca chua', unit: 'TRÁI', grams: 100 },
  { pattern: 'ot', unit: 'QUẢ', grams: 5 },
  { pattern: 'ot', unit: 'TRÁI', grams: 5 },
  { pattern: 'chanh', unit: 'QUẢ', grams: 40 },
  { pattern: 'chanh', unit: 'TRÁI', grams: 40 },
  { pattern: 'tac', unit: 'QUẢ', grams: 12 },
  { pattern: 'dua leo', unit: 'QUẢ', grams: 150 },
  { pattern: 'dua leo', unit: 'TRÁI', grams: 150 },
  { pattern: 'ca tim', unit: 'QUẢ', grams: 200 },
  { pattern: 'bap', unit: 'TRÁI', grams: 200 },
  { pattern: 'bap', unit: 'QUẢ', grams: 200 },
  { pattern: 'dua', unit: 'QUẢ', grams: 300 },
  { pattern: 'dua', unit: 'TRÁI', grams: 300 },
  { pattern: 'thom', unit: 'QUẢ', grams: 900 },
  { pattern: 'dua hau', unit: 'QUẢ', grams: 3000 },
  { pattern: 'chuoi', unit: 'QUẢ', grams: 100 },
  { pattern: 'tau hu', unit: 'MIẾNG', grams: 100 },
  { pattern: 'dau hu', unit: 'MIẾNG', grams: 100 },
  { pattern: 'dau phu', unit: 'MIẾNG', grams: 100 },
  { pattern: 'banh trang', unit: 'CÁI', grams: 10 },
  { pattern: 'banh mi', unit: 'Ổ', grams: 90 },
  { pattern: 'banh mi', unit: 'CÁI', grams: 90 },
  { pattern: 'ga', unit: 'CON', grams: 1500 },
  { pattern: 'vit', unit: 'CON', grams: 2000 },
  { pattern: 'ca', unit: 'CON', grams: 500 },
  { pattern: 'tom', unit: 'CON', grams: 20 },
  { pattern: 'cua', unit: 'CON', grams: 300 },
  { pattern: 'muc', unit: 'CON', grams: 150 },
  { pattern: 'xa lach', unit: 'CÂY', grams: 200 },
  { pattern: 'rau', unit: 'BÓ', grams: 150 },
  { pattern: 'rau', unit: 'NẮM', grams: 30 },
  { pattern: 'bun', unit: 'TÔ', grams: 200 },
  { pattern: 'pho', unit: 'TÔ', grams: 200 },
  { pattern: 'gao', unit: 'CHÉN', grams: 180 },
  { pattern: 'gao', unit: 'LON', grams: 300 },
  { pattern: 'gao', unit: 'CUP', grams: 180 },
  { pattern: 'nuoc', unit: 'CHÉN', grams: 240 },
  { pattern: 'nuoc', unit: 'LÍT', grams: 1000 },
  { pattern: 'dau an', unit: 'TBSP', grams: 14 },
  { pattern: 'dau an', unit: 'TSP', grams: 4.5 },
  { pattern: 'nuoc mam', unit: 'TBSP', grams: 18 },
  { pattern: 'nuoc mam', unit: 'TSP', grams: 6 },
  { pattern: 'duong', unit: 'TBSP', grams: 12 },
  { pattern: 'duong', unit: 'TSP', grams: 4 },
  { pattern: 'muoi', unit: 'TBSP', grams: 15 },
  { pattern: 'muoi', unit: 'TSP', grams: 5 },
  { pattern: 'bot ngot', unit: 'TSP', grams: 3 },
  { pattern: 'hat nem', unit: 'TSP', grams: 3 },
  { pattern: 'hat nem', unit: 'TBSP', grams: 10 },
  { pattern: 'tieu', unit: 'TSP', grams: 2 },
  { pattern: 'mam ruoc', unit: 'TBSP', grams: 18 },
  { pattern: 'mam tom', unit: 'TBSP', grams: 18 },
  { pattern: 'tuong ot', unit: 'TBSP', grams: 17 },
  { pattern: 'bot', unit: 'TBSP', grams: 8 },
  { pattern: 'bot', unit: 'TSP', grams: 3 },
  { pattern: 'bot', unit: 'CHÉN', grams: 130 },
];

export interface GramEstimate {
  grams: number | null;
  /** Nguồn ước lượng để audit. */
  basis: 'NORMALIZED' | 'INGREDIENT_UNIT' | 'UNIT_DEFAULT' | 'UNKNOWN';
}

/**
 * Ước lượng gram cho một nguyên liệu. Ưu tiên normalizedWeightGram, sau đó bảng
 * ingredient+unit, cuối cùng bảng đơn vị chung.
 */
export function estimateGrams(input: {
  name: string;
  quantity?: number | null;
  quantityTo?: number | null;
  unitCode?: string | null;
  normalizedWeightGram?: number | null;
}): GramEstimate {
  if (input.normalizedWeightGram && input.normalizedWeightGram > 0) {
    return { grams: input.normalizedWeightGram, basis: 'NORMALIZED' };
  }
  const qtyFrom = input.quantity ?? null;
  const qtyTo = input.quantityTo ?? null;
  const quantity =
    qtyFrom !== null && qtyTo !== null && qtyTo > 0
      ? (qtyFrom + qtyTo) / 2
      : qtyFrom ?? 1;
  const unit = (input.unitCode ?? '').toUpperCase().trim();
  const normalizedName = normalizeVietnamese(input.name);

  if (unit) {
    const specific = INGREDIENT_UNIT_GRAMS
      .filter((row) => row.unit === unit && ` ${normalizedName} `.includes(` ${row.pattern} `))
      .sort((a, b) => b.pattern.length - a.pattern.length)[0];
    if (specific) return { grams: round(quantity * specific.grams), basis: 'INGREDIENT_UNIT' };
    const def = UNIT_GRAM_DEFAULTS[unit];
    if (def !== undefined) {
      // Đơn vị "vừa đủ/một ít" không nhân với quantity.
      const grams = unit === 'VỪA_ĐỦ' || unit === 'MỘT_ÍT' ? def : quantity * def;
      return { grams: round(grams), basis: 'UNIT_DEFAULT' };
    }
    return { grams: null, basis: 'UNKNOWN' };
  }

  // Không có đơn vị: giả định đếm "cái/quả" theo bảng nguyên liệu nếu có.
  const countRow = INGREDIENT_UNIT_GRAMS
    .filter((row) => ['QUẢ', 'CỦ', 'CÂY', 'CON', 'CÁI', 'MIẾNG'].includes(row.unit)
      && ` ${normalizedName} `.includes(` ${row.pattern} `))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
  if (countRow) return { grams: round(quantity * countRow.grams), basis: 'INGREDIENT_UNIT' };
  return { grams: null, basis: 'UNKNOWN' };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
