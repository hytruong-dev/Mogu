export const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Cần duyệt',
  ACTIVE: 'Hoạt động',
  REJECTED: 'Từ chối',
  MERGED: 'Đã gộp',
  INACTIVE: 'Đã ẩn',
}

export const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PENDING_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  MERGED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
}

export const CREATED_VIA_LABELS: Record<string, string> = {
  MANUAL: 'Nhập tay',
  AI_IMPORT: 'AI tự động',
  ADMIN_PICKER: 'Tạo từ món',
  FILE_IMPORT: 'Từ file',
}

export const IMAGE_STATUS_LABELS: Record<string, string> = {
  NOT_REQUESTED: 'Chưa tìm',
  QUEUED: 'Đang chờ tìm',
  SEARCHING: 'Đang tìm',
  PENDING_REVIEW: 'Ảnh chờ duyệt',
  APPROVED: 'Đã duyệt',
  NOT_FOUND: 'Không tìm thấy',
  FAILED: 'Lỗi tìm',
}

export const ALLERGEN_LABELS: Record<string, string> = {
  // Main taxonomy codes
  PEANUT: 'Đậu phộng (Lạc)',
  TREE_NUT: 'Các loại hạt cây',
  MILK: 'Sữa bò & Chế phẩm',
  DAIRY: 'Sữa & Chế phẩm sữa',
  EGG: 'Trứng',
  FISH: 'Cá biển & Cá nước ngọt',
  SHELLFISH: 'Động vật giáp xác',
  MOLLUSK: 'Động vật nhuyễn thể',
  FERMENTED_PASTE: 'Mắm tôm, Mắm ruốc & Mắm cá',
  SOY: 'Đậu nành & Chế phẩm',
  SOYA: 'Đậu nành & Chế phẩm',
  LEGUMES_OTHER: 'Các loại đậu đỗ khác',
  WHEAT: 'Lúa mì',
  GLUTEN: 'Gluten',
  SESAME: 'Mè (Vừng)',
  CELERY: 'Cần tây',
  MUSTARD: 'Mù tạt (Mustard)',
  SULFITE: 'Sulfite / Chất bảo quản',
  LUPIN: 'Đậu lupin',
  BEEF_RED_MEAT: 'Thịt bò & Thịt đỏ',
  POULTRY: 'Thịt gà & Gia cầm',
  PORK: 'Thịt heo',
  CORN: 'Ngô (Bắp)',
  BUCKWHEAT: 'Kiều mạch (Mạch ba góc)',
  MSG: 'Bột ngọt / Mì chính',
  MUSHROOM: 'Nấm ăn các loại',
  ALLIUM: 'Hành, Tỏi & Hẹ',
  COCONUT: 'Dừa & Nước cốt dừa',
  CITRUS: 'Trái cây họ Cam chanh',
  TROPICAL_FRUIT: 'Trái cây nhiệt đới (Dứa, Xoài...)',
  CAPSAICIN_SPICE: 'Ớt & Gia vị cay nồng',
  COCOA: 'Cacao & Sô cô la',
  NIGHTSHADE: 'Nhóm cà & Cà chua (Nightshade)',
  ALCOHOL: 'Cồn & Rượu nấu ăn',
  ARTIFICIAL_SWEETENER: 'Chất tạo ngọt nhân tạo',
  OTHER: 'Dị ứng khác',
  SEAFOOD: 'Hải sản tổng hợp',

  // Lowercase / legacy keys
  peanut: 'Đậu phộng (Lạc)',
  tree_nut: 'Các loại hạt cây',
  nut: 'Các loại hạt',
  milk: 'Sữa bò & Chế phẩm',
  dairy: 'Sữa',
  egg: 'Trứng',
  fish: 'Cá',
  shellfish: 'Động vật giáp xác',
  mollusk: 'Động vật nhuyễn thể',
  fermented_paste: 'Mắm tôm, Mắm ruốc',
  soy: 'Đậu nành',
  soya: 'Đậu nành',
  legumes_other: 'Các loại đậu đỗ khác',
  wheat: 'Lúa mì',
  gluten: 'Gluten',
  sesame: 'Mè (Vừng)',
  celery: 'Cần tây',
  mustard: 'Mù tạt',
  sulfite: 'Sulfite',
  lupin: 'Đậu lupin',
  beef_red_meat: 'Thịt bò & Thịt đỏ',
  poultry: 'Thịt gà & Gia cầm',
  pork: 'Thịt heo',
  corn: 'Ngô (Bắp)',
  buckwheat: 'Kiều mạch',
  msg: 'Bột ngọt / Mì chính',
  mushroom: 'Nấm ăn các loại',
  allium: 'Hành, Tỏi & Hẹ',
  coconut: 'Dừa & Nước cốt dừa',
  citrus: 'Trái cây họ Cam chanh',
  tropical_fruit: 'Trái cây nhiệt đới',
  capsaicin_spice: 'Ớt & Gia vị cay nồng',
  cocoa: 'Cacao & Sô cô la',
  nightshade: 'Nhóm cà & Cà chua',
  alcohol: 'Cồn & Rượu nấu ăn',
  artificial_sweetener: 'Chất tạo ngọt nhân tạo',
  other: 'Dị ứng khác',
  seafood: 'Hải sản',
}

export const LEGACY_ALLERGEN_LABELS = ALLERGEN_LABELS

export function getAllergenDisplayName(
  code?: string | null,
  catalog?: Array<{ code: string; name: string }> | Record<string, string>
): string {
  if (!code) return ''
  const trimmed = code.trim()
  if (!trimmed) return ''

  if (catalog) {
    if (Array.isArray(catalog)) {
      const found = catalog.find(
        (c) => c.code && c.code.trim().toUpperCase() === trimmed.toUpperCase()
      )
      if (found?.name) return found.name
    } else if (typeof catalog === 'object') {
      if (catalog[trimmed]) return catalog[trimmed]
      if (catalog[trimmed.toUpperCase()]) return catalog[trimmed.toUpperCase()]
      if (catalog[trimmed.toLowerCase()]) return catalog[trimmed.toLowerCase()]
    }
  }

  if (ALLERGEN_LABELS[trimmed]) return ALLERGEN_LABELS[trimmed]
  const upper = trimmed.toUpperCase()
  if (ALLERGEN_LABELS[upper]) return ALLERGEN_LABELS[upper]
  const lower = trimmed.toLowerCase()
  if (ALLERGEN_LABELS[lower]) return ALLERGEN_LABELS[lower]

  // Fallback: Humanize SNAKE_CASE
  return trimmed
    .split(/[_\-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'

export function getIngredientImageUrl(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${SUPABASE_URL}/storage/v1/object/public/ingredients/${url}`
}
