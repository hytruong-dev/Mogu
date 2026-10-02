/**
 * Gazetteer tĩnh: pattern tên món (đã normalizeVietnamese — không dấu, chữ thường)
 * -> mã tỉnh/thành theo seed `prisma/seed.ts`.
 *
 * Nguyên tắc:
 * - Chỉ liệt kê đặc sản có xuất xứ rõ ràng (được công nhận rộng rãi).
 * - Pattern dài/cụ thể hơn được ưu tiên hơn pattern ngắn (so khớp theo độ dài).
 * - Mã tỉnh phải tồn tại trong seed; nếu DB chưa có tỉnh, resolver sẽ fallback về vùng.
 */
export interface DishOriginRule {
  /** Pattern đã normalize (không dấu). Khớp theo substring có ranh giới từ. */
  pattern: string;
  provinceCode: string;
  /** Vùng miền mong đợi (để fallback nếu tỉnh chưa seed). */
  regionCode: 'NORTH' | 'CENTRAL' | 'SOUTH';
  /** Tên hiển thị dùng cho originText. */
  originText: string;
  confidence?: number;
}

export const VIETNAM_DISH_ORIGIN_RULES: DishOriginRule[] = [
  // ── Miền Trung ────────────────────────────────────────────────────────────
  { pattern: 'bun bo hue', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung', confidence: 98 },
  { pattern: 'com hen', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'bun hen', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'banh beo', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung', confidence: 85 },
  { pattern: 'banh nam', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'banh bot loc', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'banh khoai', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'nem lui', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'bun thit nuong hue', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'che hue', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'banh canh nam pho', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung' },
  { pattern: 'hue', provinceCode: 'HUE', regionCode: 'CENTRAL', originText: 'Thừa Thiên Huế, Miền Trung', confidence: 90 },

  { pattern: 'mi quang', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Quảng Nam, Miền Trung', confidence: 98 },
  { pattern: 'cao lau', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Hội An, Quảng Nam, Miền Trung', confidence: 98 },
  { pattern: 'com ga hoi an', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Hội An, Quảng Nam, Miền Trung' },
  { pattern: 'banh dap', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Quảng Nam, Miền Trung' },
  { pattern: 'be thui cau mong', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Quảng Nam, Miền Trung' },
  { pattern: 'hoi an', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Hội An, Quảng Nam, Miền Trung', confidence: 90 },
  { pattern: 'quang nam', provinceCode: 'QN', regionCode: 'CENTRAL', originText: 'Quảng Nam, Miền Trung', confidence: 90 },

  { pattern: 'banh trang cuon thit heo', provinceCode: 'DN', regionCode: 'CENTRAL', originText: 'Đà Nẵng, Miền Trung' },
  { pattern: 'bun cha ca da nang', provinceCode: 'DN', regionCode: 'CENTRAL', originText: 'Đà Nẵng, Miền Trung' },
  { pattern: 'da nang', provinceCode: 'DN', regionCode: 'CENTRAL', originText: 'Đà Nẵng, Miền Trung', confidence: 90 },

  { pattern: 'bun cha ca nha trang', provinceCode: 'KH', regionCode: 'CENTRAL', originText: 'Nha Trang, Khánh Hòa, Miền Trung' },
  { pattern: 'nem nuong nha trang', provinceCode: 'KH', regionCode: 'CENTRAL', originText: 'Nha Trang, Khánh Hòa, Miền Trung' },
  { pattern: 'bun sua', provinceCode: 'KH', regionCode: 'CENTRAL', originText: 'Nha Trang, Khánh Hòa, Miền Trung' },
  { pattern: 'nha trang', provinceCode: 'KH', regionCode: 'CENTRAL', originText: 'Nha Trang, Khánh Hòa, Miền Trung', confidence: 90 },

  { pattern: 'banh xeo binh dinh', provinceCode: 'BH', regionCode: 'CENTRAL', originText: 'Bình Định, Miền Trung' },
  { pattern: 'bun cha ca quy nhon', provinceCode: 'BH', regionCode: 'CENTRAL', originText: 'Quy Nhơn, Bình Định, Miền Trung' },
  { pattern: 'banh it la gai', provinceCode: 'BH', regionCode: 'CENTRAL', originText: 'Bình Định, Miền Trung' },
  { pattern: 'quy nhon', provinceCode: 'BH', regionCode: 'CENTRAL', originText: 'Quy Nhơn, Bình Định, Miền Trung', confidence: 90 },
  { pattern: 'binh dinh', provinceCode: 'BH', regionCode: 'CENTRAL', originText: 'Bình Định, Miền Trung', confidence: 90 },

  { pattern: 'pho kho gia lai', provinceCode: 'GL', regionCode: 'CENTRAL', originText: 'Gia Lai, Tây Nguyên' },
  { pattern: 'gia lai', provinceCode: 'GL', regionCode: 'CENTRAL', originText: 'Gia Lai, Tây Nguyên', confidence: 90 },
  { pattern: 'bun do', provinceCode: 'DL', regionCode: 'CENTRAL', originText: 'Buôn Ma Thuột, Đắk Lắk, Tây Nguyên' },
  { pattern: 'buon ma thuot', provinceCode: 'DL', regionCode: 'CENTRAL', originText: 'Buôn Ma Thuột, Đắk Lắk, Tây Nguyên', confidence: 90 },
  { pattern: 'dak lak', provinceCode: 'DL', regionCode: 'CENTRAL', originText: 'Đắk Lắk, Tây Nguyên', confidence: 90 },
  { pattern: 'kon tum', provinceCode: 'KT', regionCode: 'CENTRAL', originText: 'Kon Tum, Tây Nguyên', confidence: 90 },
  { pattern: 'banh uot thit nuong', provinceCode: 'QT', regionCode: 'CENTRAL', originText: 'Quảng Trị, Miền Trung', confidence: 80 },
  { pattern: 'quang tri', provinceCode: 'QT', regionCode: 'CENTRAL', originText: 'Quảng Trị, Miền Trung', confidence: 90 },
  { pattern: 'banh canh cha ca phan rang', provinceCode: 'NTr', regionCode: 'CENTRAL', originText: 'Phan Rang, Ninh Thuận, Miền Trung' },
  { pattern: 'phan rang', provinceCode: 'NTr', regionCode: 'CENTRAL', originText: 'Phan Rang, Ninh Thuận, Miền Trung', confidence: 90 },
  { pattern: 'ninh thuan', provinceCode: 'NTr', regionCode: 'CENTRAL', originText: 'Ninh Thuận, Miền Trung', confidence: 90 },

  // ── Miền Bắc ──────────────────────────────────────────────────────────────
  { pattern: 'pho bo ha noi', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 98 },
  { pattern: 'pho ga ha noi', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 98 },
  { pattern: 'bun cha', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 95 },
  { pattern: 'bun thang', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 95 },
  { pattern: 'cha ca la vong', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 98 },
  { pattern: 'cha ca', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 80 },
  { pattern: 'bun dau mam tom', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 92 },
  { pattern: 'bun oc', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 85 },
  { pattern: 'banh cuon thanh tri', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc' },
  { pattern: 'banh tom ho tay', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc' },
  { pattern: 'xoi xeo', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 80 },
  { pattern: 'pho cuon', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 90 },
  { pattern: 'pho', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 75 },
  { pattern: 'ha noi', provinceCode: 'HN', regionCode: 'NORTH', originText: 'Hà Nội, Miền Bắc', confidence: 90 },

  { pattern: 'banh da cua', provinceCode: 'HP', regionCode: 'NORTH', originText: 'Hải Phòng, Miền Bắc', confidence: 95 },
  { pattern: 'bun ca cay', provinceCode: 'HP', regionCode: 'NORTH', originText: 'Hải Phòng, Miền Bắc' },
  { pattern: 'banh mi cay', provinceCode: 'HP', regionCode: 'NORTH', originText: 'Hải Phòng, Miền Bắc' },
  { pattern: 'nem cua be', provinceCode: 'HP', regionCode: 'NORTH', originText: 'Hải Phòng, Miền Bắc' },
  { pattern: 'hai phong', provinceCode: 'HP', regionCode: 'NORTH', originText: 'Hải Phòng, Miền Bắc', confidence: 90 },

  { pattern: 'chao luon', provinceCode: 'NA', regionCode: 'NORTH', originText: 'Nghệ An, Bắc Trung Bộ', confidence: 80 },
  { pattern: 'sup luon', provinceCode: 'NA', regionCode: 'NORTH', originText: 'Nghệ An, Bắc Trung Bộ', confidence: 85 },
  { pattern: 'nghe an', provinceCode: 'NA', regionCode: 'NORTH', originText: 'Nghệ An, Bắc Trung Bộ', confidence: 90 },
  { pattern: 'nem chua thanh hoa', provinceCode: 'TH', regionCode: 'NORTH', originText: 'Thanh Hóa, Bắc Trung Bộ' },
  { pattern: 'cha tom thanh hoa', provinceCode: 'TH', regionCode: 'NORTH', originText: 'Thanh Hóa, Bắc Trung Bộ' },
  { pattern: 'thanh hoa', provinceCode: 'TH', regionCode: 'NORTH', originText: 'Thanh Hóa, Bắc Trung Bộ', confidence: 90 },
  { pattern: 'chao canh quang binh', provinceCode: 'QB', regionCode: 'NORTH', originText: 'Quảng Bình, Bắc Trung Bộ' },
  { pattern: 'banh khoai quang binh', provinceCode: 'QB', regionCode: 'NORTH', originText: 'Quảng Bình, Bắc Trung Bộ' },
  { pattern: 'quang binh', provinceCode: 'QB', regionCode: 'NORTH', originText: 'Quảng Bình, Bắc Trung Bộ', confidence: 90 },
  { pattern: 'thang co', provinceCode: 'HG', regionCode: 'NORTH', originText: 'Hà Giang, Tây Bắc', confidence: 85 },
  { pattern: 'chau da', provinceCode: 'HG', regionCode: 'NORTH', originText: 'Hà Giang, Tây Bắc' },
  { pattern: 'ha giang', provinceCode: 'HG', regionCode: 'NORTH', originText: 'Hà Giang, Tây Bắc', confidence: 90 },
  { pattern: 'thit trau gac bep', provinceCode: 'SL', regionCode: 'NORTH', originText: 'Sơn La, Tây Bắc', confidence: 80 },
  { pattern: 'pa pinh top', provinceCode: 'SL', regionCode: 'NORTH', originText: 'Sơn La, Tây Bắc' },
  { pattern: 'son la', provinceCode: 'SL', regionCode: 'NORTH', originText: 'Sơn La, Tây Bắc', confidence: 90 },
  { pattern: 'thang co bac ha', provinceCode: 'LC', regionCode: 'NORTH', originText: 'Bắc Hà, Lào Cai, Tây Bắc' },
  { pattern: 'ca hoi sa pa', provinceCode: 'LC', regionCode: 'NORTH', originText: 'Sa Pa, Lào Cai, Tây Bắc' },
  { pattern: 'sa pa', provinceCode: 'LC', regionCode: 'NORTH', originText: 'Sa Pa, Lào Cai, Tây Bắc', confidence: 90 },
  { pattern: 'lao cai', provinceCode: 'LC', regionCode: 'NORTH', originText: 'Lào Cai, Tây Bắc', confidence: 90 },
  { pattern: 'xoi ngu sac', provinceCode: 'YB', regionCode: 'NORTH', originText: 'Yên Bái, Tây Bắc', confidence: 70 },
  { pattern: 'yen bai', provinceCode: 'YB', regionCode: 'NORTH', originText: 'Yên Bái, Tây Bắc', confidence: 90 },
  { pattern: 'tuyen quang', provinceCode: 'TQ', regionCode: 'NORTH', originText: 'Tuyên Quang, Miền Bắc', confidence: 90 },
  { pattern: 'thit de ninh binh', provinceCode: 'NT', regionCode: 'NORTH', originText: 'Ninh Bình, Miền Bắc' },
  { pattern: 'com chay ninh binh', provinceCode: 'NT', regionCode: 'NORTH', originText: 'Ninh Bình, Miền Bắc' },
  { pattern: 'ninh binh', provinceCode: 'NT', regionCode: 'NORTH', originText: 'Ninh Bình, Miền Bắc', confidence: 90 },
  { pattern: 'banh dau xanh hai duong', provinceCode: 'HD', regionCode: 'NORTH', originText: 'Hải Dương, Miền Bắc' },
  { pattern: 'hai duong', provinceCode: 'HD', regionCode: 'NORTH', originText: 'Hải Dương, Miền Bắc', confidence: 90 },
  { pattern: 'hoa binh', provinceCode: 'HB', regionCode: 'NORTH', originText: 'Hòa Bình, Tây Bắc', confidence: 90 },
  { pattern: 'banh phu the', provinceCode: 'BN', regionCode: 'NORTH', originText: 'Bắc Ninh, Miền Bắc', confidence: 80 },
  { pattern: 'bac ninh', provinceCode: 'BN', regionCode: 'NORTH', originText: 'Bắc Ninh, Miền Bắc', confidence: 90 },
  { pattern: 'banh canh hen phu yen', provinceCode: 'PY', regionCode: 'NORTH', originText: 'Phú Yên, Miền Trung' },
  { pattern: 'ca ngu dai duong', provinceCode: 'PY', regionCode: 'NORTH', originText: 'Phú Yên, Miền Trung', confidence: 80 },
  { pattern: 'phu yen', provinceCode: 'PY', regionCode: 'NORTH', originText: 'Phú Yên, Miền Trung', confidence: 90 },

  // ── Miền Nam ──────────────────────────────────────────────────────────────
  { pattern: 'com tam', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 95 },
  { pattern: 'hu tieu nam vang', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 90 },
  { pattern: 'banh mi sai gon', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam' },
  { pattern: 'bo kho', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 70 },
  { pattern: 'pha lau', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 85 },
  { pattern: 'sai gon', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 90 },
  { pattern: 'ho chi minh', provinceCode: 'HCM', regionCode: 'SOUTH', originText: 'TP. Hồ Chí Minh, Miền Nam', confidence: 90 },

  { pattern: 'hu tieu my tho', provinceCode: 'TG', regionCode: 'SOUTH', originText: 'Mỹ Tho, Tiền Giang, Miền Nam' },
  { pattern: 'my tho', provinceCode: 'TG', regionCode: 'SOUTH', originText: 'Mỹ Tho, Tiền Giang, Miền Nam', confidence: 90 },
  { pattern: 'tien giang', provinceCode: 'TG', regionCode: 'SOUTH', originText: 'Tiền Giang, Miền Nam', confidence: 90 },
  { pattern: 'bun ca chau doc', provinceCode: 'AG', regionCode: 'SOUTH', originText: 'Châu Đốc, An Giang, Miền Nam' },
  { pattern: 'bun mam', provinceCode: 'AG', regionCode: 'SOUTH', originText: 'An Giang, Miền Tây', confidence: 75 },
  { pattern: 'lau mam', provinceCode: 'AG', regionCode: 'SOUTH', originText: 'An Giang, Miền Tây', confidence: 75 },
  { pattern: 'chau doc', provinceCode: 'AG', regionCode: 'SOUTH', originText: 'Châu Đốc, An Giang, Miền Nam', confidence: 90 },
  { pattern: 'an giang', provinceCode: 'AG', regionCode: 'SOUTH', originText: 'An Giang, Miền Nam', confidence: 90 },
  { pattern: 'banh cong', provinceCode: 'CT', regionCode: 'SOUTH', originText: 'Cần Thơ, Miền Tây', confidence: 80 },
  { pattern: 'lau ca keo', provinceCode: 'CT', regionCode: 'SOUTH', originText: 'Miền Tây Nam Bộ', confidence: 70 },
  { pattern: 'can tho', provinceCode: 'CT', regionCode: 'SOUTH', originText: 'Cần Thơ, Miền Tây', confidence: 90 },
  { pattern: 'banh khot vung tau', provinceCode: 'VT', regionCode: 'SOUTH', originText: 'Vũng Tàu, Miền Nam' },
  { pattern: 'banh khot', provinceCode: 'VT', regionCode: 'SOUTH', originText: 'Vũng Tàu, Miền Nam', confidence: 80 },
  { pattern: 'vung tau', provinceCode: 'VT', regionCode: 'SOUTH', originText: 'Vũng Tàu, Miền Nam', confidence: 90 },
  { pattern: 'binh duong', provinceCode: 'BD', regionCode: 'SOUTH', originText: 'Bình Dương, Miền Nam', confidence: 90 },
  { pattern: 'dong nai', provinceCode: 'DN2', regionCode: 'SOUTH', originText: 'Đồng Nai, Miền Nam', confidence: 90 },
  { pattern: 'lau cua dong', provinceCode: 'LA', regionCode: 'SOUTH', originText: 'Long An, Miền Nam', confidence: 60 },
  { pattern: 'long an', provinceCode: 'LA', regionCode: 'SOUTH', originText: 'Long An, Miền Nam', confidence: 90 },
  { pattern: 'keo dua ben tre', provinceCode: 'BT', regionCode: 'SOUTH', originText: 'Bến Tre, Miền Tây' },
  { pattern: 'ben tre', provinceCode: 'BT', regionCode: 'SOUTH', originText: 'Bến Tre, Miền Tây', confidence: 90 },
  { pattern: 'vinh long', provinceCode: 'VL', regionCode: 'SOUTH', originText: 'Vĩnh Long, Miền Tây', confidence: 90 },
  { pattern: 'bun quay phu quoc', provinceCode: 'KG', regionCode: 'SOUTH', originText: 'Phú Quốc, Kiên Giang, Miền Nam' },
  { pattern: 'goi ca trich', provinceCode: 'KG', regionCode: 'SOUTH', originText: 'Phú Quốc, Kiên Giang, Miền Nam', confidence: 85 },
  { pattern: 'phu quoc', provinceCode: 'KG', regionCode: 'SOUTH', originText: 'Phú Quốc, Kiên Giang, Miền Nam', confidence: 90 },
  { pattern: 'kien giang', provinceCode: 'KG', regionCode: 'SOUTH', originText: 'Kiên Giang, Miền Nam', confidence: 90 },
  { pattern: 'ba khia', provinceCode: 'CM', regionCode: 'SOUTH', originText: 'Cà Mau, Miền Tây', confidence: 85 },
  { pattern: 'cua ca mau', provinceCode: 'CM', regionCode: 'SOUTH', originText: 'Cà Mau, Miền Tây' },
  { pattern: 'ca mau', provinceCode: 'CM', regionCode: 'SOUTH', originText: 'Cà Mau, Miền Tây', confidence: 90 },

  // Món miền Tây chung (không rõ tỉnh) -> chỉ vùng SOUTH, provinceCode rỗng
  { pattern: 'mien tay', provinceCode: '', regionCode: 'SOUTH', originText: 'Miền Tây Nam Bộ', confidence: 85 },
  { pattern: 'canh chua ca loc', provinceCode: '', regionCode: 'SOUTH', originText: 'Miền Tây Nam Bộ', confidence: 80 },
  { pattern: 'ca kho to', provinceCode: '', regionCode: 'SOUTH', originText: 'Miền Nam', confidence: 70 },
  { pattern: 'banh xeo mien tay', provinceCode: '', regionCode: 'SOUTH', originText: 'Miền Tây Nam Bộ', confidence: 85 },
  { pattern: 'mien bac', provinceCode: '', regionCode: 'NORTH', originText: 'Miền Bắc', confidence: 85 },
  { pattern: 'mien trung', provinceCode: '', regionCode: 'CENTRAL', originText: 'Miền Trung', confidence: 85 },
  { pattern: 'mien nam', provinceCode: '', regionCode: 'SOUTH', originText: 'Miền Nam', confidence: 85 },
];

/** Tên tiếng Việt chuẩn cho vùng miền. */
export const REGION_DISPLAY_NAMES: Record<string, string> = {
  NORTH: 'Miền Bắc',
  CENTRAL: 'Miền Trung',
  SOUTH: 'Miền Nam',
};

/** Map hint ngắn (north/south/central hoặc tiếng Việt) -> mã vùng chuẩn. */
export function normalizeRegionCode(value?: string | null): 'NORTH' | 'CENTRAL' | 'SOUTH' | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (['north', 'bac', 'mien bac', 'miền bắc', 'bắc'].includes(v)) return 'NORTH';
  if (['central', 'trung', 'mien trung', 'miền trung'].includes(v)) return 'CENTRAL';
  if (['south', 'nam', 'mien nam', 'miền nam'].includes(v)) return 'SOUTH';
  const upper = value.trim().toUpperCase();
  if (upper === 'NORTH' || upper === 'CENTRAL' || upper === 'SOUTH') return upper;
  return null;
}
