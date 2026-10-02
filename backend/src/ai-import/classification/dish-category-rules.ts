import { normalizeVietnamese } from '../ingredient.service';

export type DishTypeCode = 'WET' | 'DRY';

export interface CategoryKeywordRule {
  /** Pattern đã normalize (không dấu). */
  patterns: string[];
  categoryCode: string;
  /** Món nước / món khô mặc định khi khớp rule này. */
  dishType: DishTypeCode;
  /** Meal type mặc định nếu AI để trống. */
  defaultMealTypes: string[];
  priority: number;
}

/**
 * Rule tên món -> category. Priority cao hơn thắng khi nhiều rule khớp.
 * Lưu ý: "bánh mì" phải đứng trước "bánh" (BREAD) và "canh" không khớp "bánh canh".
 */
export const DISH_CATEGORY_RULES: CategoryKeywordRule[] = [
  { patterns: ['lau'], categoryCode: 'HOT_POT', dishType: 'WET', defaultMealTypes: ['DINNER'], priority: 100 },
  { patterns: ['banh canh', 'bun', 'pho', 'hu tieu', 'mi quang', 'cao lau', 'mien', 'bun bo', 'mi '], categoryCode: 'NOODLE', dishType: 'WET', defaultMealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'], priority: 90 },
  { patterns: ['mi xao', 'bun xao', 'pho xao', 'mien xao', 'hu tieu xao', 'mi tron', 'bun tron', 'bun thit nuong', 'bun cha', 'bun dau', 'pho cuon', 'hu tieu kho', 'mi kho', 'pho tron'], categoryCode: 'NOODLE', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 95 },
  { patterns: ['canh', 'sup', 'chao', 'rieu'], categoryCode: 'SOUP', dishType: 'WET', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 80 },
  { patterns: ['banh mi'], categoryCode: 'BREAD', dishType: 'DRY', defaultMealTypes: ['BREAKFAST', 'SNACK'], priority: 92 },
  { patterns: ['com', 'xoi'], categoryCode: 'RICE', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 82 },
  { patterns: ['nuong', 'quay'], categoryCode: 'GRILL', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 75 },
  { patterns: ['xao'], categoryCode: 'STIR_FRY', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 72 },
  { patterns: ['hap', 'luoc'], categoryCode: 'STEAM', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 70 },
  { patterns: ['goi', 'nom', 'salad'], categoryCode: 'SALAD', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 78 },
  { patterns: ['che', 'kem', 'banh ngot', 'banh flan', 'banh bong lan', 'pudding', 'sua chua', 'rau cau', 'tao pho', 'tau hu'], categoryCode: 'DESSERT', dishType: 'DRY', defaultMealTypes: ['SNACK'], priority: 85 },
  { patterns: ['tra sua', 'sinh to', 'nuoc ep', 'ca phe', 'tra dao', 'tra chanh', 'tra tac', 'nuoc mia', 'soda', 'da chanh', 'nuoc chanh', 'sua dau nanh', 'nuoc sam'], categoryCode: 'DRINK', dishType: 'WET', defaultMealTypes: ['SNACK'], priority: 88 },
  { patterns: ['banh trang tron', 'banh trang nuong', 'kho ga', 'kho bo', 'snack', 'khoai tay chien', 'bap xao', 'ca vien', 'bo bia', 'ha cao', 'xien', 'ca vien chien'], categoryCode: 'SNACK', dishType: 'DRY', defaultMealTypes: ['SNACK'], priority: 86 },
  { patterns: ['banh'], categoryCode: 'BREAD', dishType: 'DRY', defaultMealTypes: ['BREAKFAST', 'SNACK'], priority: 60 },
  { patterns: ['kho', 'ram', 'chien', 'rim', 'roti', 'ran', 'sot', 'hon', 'xa xiu', 'cuon', 'tron', 'nem', 'cha', 'cha gio'], categoryCode: 'OTHER', dishType: 'DRY', defaultMealTypes: ['LUNCH', 'DINNER'], priority: 40 },
];

/** Từ khóa mạnh về "món nước" dù category không thuộc nhóm WET. */
const WET_KEYWORDS = ['nuoc', 'canh', 'chao', 'lau', 'sup', 'bun', 'pho', 'hu tieu', 'banh canh', 'mi quang', 'mien'];
const DRY_OVERRIDE_KEYWORDS = ['xao', 'tron', 'kho ', 'cuon', 'nuong', 'chien'];

export const WET_CATEGORIES = new Set(['NOODLE', 'SOUP', 'HOT_POT']);

/**
 * Mã category chuẩn của rule -> các mã tương đương có thể tồn tại trong taxonomy thật
 * (seed dùng NOODLE/RICE/..., DB production dùng PHO/COM/LẨU/TRANG_MIENG...).
 * So khớp sau khi normalize (bỏ dấu, uppercase) nên "LẨU" == "LAU".
 */
export const CATEGORY_CODE_ALIASES: Record<string, string[]> = {
  NOODLE: ['NOODLE', 'PHO', 'BUN', 'MI', 'PHO_BUN', 'BUN_PHO', 'BUN_PHO_MI', 'MON_NUOC'],
  SOUP: ['SOUP', 'CANH', 'SUP', 'CANH_SUP', 'CHAO', 'MON_NUOC'],
  HOT_POT: ['HOT_POT', 'LAU', 'HOTPOT'],
  RICE: ['RICE', 'COM', 'COM_XOI'],
  GRILL: ['GRILL', 'NUONG', 'MON_NUONG', 'THIT'],
  STIR_FRY: ['STIR_FRY', 'XAO', 'MON_XAO'],
  STEAM: ['STEAM', 'HAP', 'HAP_LUOC'],
  SALAD: ['SALAD', 'GOI', 'GOI_NOM', 'NOM'],
  BREAD: ['BREAD', 'BANH_MI', 'BANH'],
  DESSERT: ['DESSERT', 'TRANG_MIENG', 'CHE', 'BANH_NGOT'],
  DRINK: ['DRINK', 'DO_UONG', 'NUOC_UONG', 'BEVERAGE'],
  SNACK: ['SNACK', 'AN_VAT', 'STREET_FOOD'],
  OTHER: ['OTHER', 'KHAC', 'MON_KHAC'],
};

export function normalizeCategoryCode(code: string): string {
  return normalizeVietnamese(code).replace(/\s+/g, '_').toUpperCase();
}

/**
 * Tìm mã category thật trong `allowed` tương ứng với mã chuẩn của rule.
 * Trả về chính mã trong taxonomy (giữ nguyên ký tự gốc) hoặc null nếu không có mã tương đương.
 */
export function resolveCategoryCode(canonical: string, allowed: Iterable<string> | null | undefined): string | null {
  if (!allowed) return canonical;
  const byNormalized = new Map<string, string>();
  for (const code of allowed) byNormalized.set(normalizeCategoryCode(code), code);
  const candidates = [canonical, ...(CATEGORY_CODE_ALIASES[canonical] ?? [])];
  for (const candidate of candidates) {
    const hit = byNormalized.get(normalizeCategoryCode(candidate));
    if (hit) return hit;
  }
  return null;
}

/** Kiểm tra một mã taxonomy (bất kỳ dạng nào) có thuộc nhóm category chuẩn không. */
export function isCategoryOf(code: string, canonical: string): boolean {
  const normalized = normalizeCategoryCode(code);
  return [canonical, ...(CATEGORY_CODE_ALIASES[canonical] ?? [])]
    .some((alias) => normalizeCategoryCode(alias) === normalized);
}

export interface CategoryRuleMatch {
  categoryCode: string;
  dishType: DishTypeCode;
  defaultMealTypes: string[];
  matchedPattern: string;
  priority: number;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.trim();
  if (!p) return false;
  // So khớp theo ranh giới từ để "mi" không khớp "mien", "canh" không khớp "banh canh" (rule riêng).
  return ` ${haystack} `.includes(` ${p} `);
}

/** Tìm rule category khớp tốt nhất cho tên món. */
export function matchDishCategory(dishName: string): CategoryRuleMatch | null {
  const normalized = normalizeVietnamese(dishName);
  if (!normalized) return null;
  let best: CategoryRuleMatch | null = null;
  for (const rule of DISH_CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (!containsPhrase(normalized, pattern)) continue;
      // Ưu tiên: priority cao hơn; cùng priority -> pattern dài hơn.
      if (
        !best ||
        rule.priority > best.priority ||
        (rule.priority === best.priority && pattern.length > best.matchedPattern.length)
      ) {
        best = {
          categoryCode: rule.categoryCode,
          dishType: rule.dishType,
          defaultMealTypes: rule.defaultMealTypes,
          matchedPattern: pattern,
          priority: rule.priority,
        };
      }
    }
  }
  return best;
}

/** Suy ra món nước/khô từ tên + category cuối cùng. */
export function inferDishType(
  dishName: string,
  categoryCodes: string[],
  ruleMatch?: CategoryRuleMatch | null,
): DishTypeCode {
  const normalized = ` ${normalizeVietnamese(dishName)} `;
  const hasDryOverride = DRY_OVERRIDE_KEYWORDS.some((k) => normalized.includes(` ${k.trim()} `));
  if (ruleMatch) {
    // "Bún xào", "Phở trộn" -> rule DRY ở priority 95 đã bắt. Giữ rule.
    if (ruleMatch.dishType === 'WET' && hasDryOverride) return 'DRY';
    return ruleMatch.dishType;
  }
  const isWetCategory = categoryCodes.some((code) =>
    [...WET_CATEGORIES].some((canonical) => isCategoryOf(code, canonical)),
  );
  if (isWetCategory && !hasDryOverride) return 'WET';
  if (WET_KEYWORDS.some((k) => normalized.includes(` ${k} `)) && !hasDryOverride) return 'WET';
  return 'DRY';
}
