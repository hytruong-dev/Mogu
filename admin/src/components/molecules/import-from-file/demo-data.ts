import type { IssueRow, MappingRow, MoguField, PreviewRow } from './types'

export const MOGU_FIELDS: MoguField[] = [
  { id: '', label: '— Bỏ qua —', aliases: [] },
  { id: 'name', label: 'Tên món ăn *', required: true, aliases: ['dish_name', 'name', 'ten_mon', 'ten_mon_an'] },
  { id: 'shortDescription', label: 'Mô tả ngắn', aliases: ['short_desc', 'short_description', 'mo_ta', 'mo_ta_ngan'] },
  { id: 'region', label: 'Vùng miền', aliases: ['region', 'vung_mien', 'mien'] },
  { id: 'mealTypes', label: 'Loại bữa', aliases: ['meal_types', 'meal_type', 'loai_bua'] },
  { id: 'categories', label: 'Danh mục', aliases: ['category', 'danh_muc'] },
  { id: 'calories', label: 'Calories', aliases: ['calories', 'kcal', 'calo'] },
  { id: 'proteinG', label: 'Protein (g)', aliases: ['protein'] },
  { id: 'carbsG', label: 'Carbs (g)', aliases: ['carbs', 'carb'] },
  { id: 'fatG', label: 'Fat (g)', aliases: ['fat'] },
  { id: 'fiberG', label: 'Fiber (g)', aliases: ['fiber'] },
  { id: 'sodiumMg', label: 'Sodium (mg)', aliases: ['sodium', 'natri'] },
  { id: 'imageUrl', label: 'URL ảnh', aliases: ['image_url', 'image', 'anh', 'hinh_anh'] },
  { id: 'ingredients', label: 'Nguyên liệu', aliases: ['ingredients', 'nguyen_lieu'] },
  { id: 'cookMinutes', label: 'Thời gian nấu', aliases: ['cook_time', 'cook_minutes'] },
  { id: 'prepMinutes', label: 'Thời gian chuẩn bị', aliases: ['prep', 'prep_minutes'] },
]

export const DEFAULT_MAPPING: MappingRow[] = [
  { id: '1', fileCol: 'dish_name', sample: 'Phở bò', moguField: 'name', status: 'mapped' },
  { id: '2', fileCol: 'short_desc', sample: 'Nước dùng đậm đà, bánh phở mềm', moguField: 'shortDesc', status: 'mapped' },
  { id: '3', fileCol: 'region', sample: 'Bắc Bộ', moguField: 'region', status: 'mapped' },
  { id: '4', fileCol: 'meal_types', sample: 'Sáng; Trưa', moguField: 'mealTypes', status: 'mapped' },
  { id: '5', fileCol: 'category', sample: 'Món nước', moguField: 'category', status: 'mapped' },
  { id: '6', fileCol: 'calories', sample: '480', moguField: 'calories', status: 'mapped' },
  { id: '7', fileCol: 'protein', sample: '28', moguField: 'protein', status: 'mapped' },
  { id: '8', fileCol: 'image_url', sample: 'https://cdn.mogu.vn/pho-bo.jpg', moguField: 'imageUrl', status: 'check' },
  { id: '9', fileCol: 'ingredients', sample: 'Bánh phở; Thịt bò; Hành', moguField: 'ingredients', status: 'mapped' },
  { id: '10', fileCol: 'unknown_col', sample: 'ghi chú nội bộ', moguField: '', status: 'skip' },
]

export const PREVIEW_HEADERS = ['dish_name', 'short_desc', 'region', 'meal_types', 'calories', 'image_url']

export const PREVIEW_ROWS: PreviewRow[] = [
  { id: 'r1', cells: ['Phở bò', 'Nước dùng đậm đà', 'Bắc Bộ', 'Sáng; Trưa', '480', 'https://cdn.mogu.vn/pho-bo.jpg'] },
  { id: 'r2', cells: ['Bún chả', 'Thịt nướng than hoa', 'Bắc Bộ', 'Trưa; Tối', '520', 'https://cdn.mogu.vn/bun-cha.jpg'] },
  { id: 'r3', cells: ['Cơm tấm', 'Sườn bì chả trứng', 'Nam Bộ', 'Trưa; Tối', '650', 'https://cdn.mogu.vn/com-tam.jpg'] },
]

export const DEFAULT_ISSUES: IssueRow[] = [
  {
    id: 'e1', row: 14, dishName: 'Phở gà', field: 'calories',
    currentValue: 'bốn trăm tám mươi', problem: 'Sai kiểu số',
    kind: 'error', fixType: 'input', fixValue: '480',
  },
  {
    id: 'e2', row: 22, dishName: 'Bún riêu cua', field: 'image_url',
    currentValue: 'https://broken.mogu/img.png', problem: 'Không tải được ảnh',
    kind: 'error', fixType: 'select', fixValue: 'drop',
    fixOptions: [
      { value: 'drop', label: 'Bỏ ảnh' },
      { value: 'keep', label: 'Giữ URL' },
      { value: 'replace', label: 'Thay URL' },
    ],
  },
  {
    id: 'e3', row: 31, dishName: 'Cơm tấm sườn', field: 'region',
    currentValue: 'Miền Tây', problem: 'Giá trị không hợp lệ',
    kind: 'error', fixType: 'select', fixValue: 'south',
    fixOptions: [
      { value: 'north', label: 'Miền Bắc' },
      { value: 'central', label: 'Miền Trung' },
      { value: 'south', label: 'Miền Nam' },
      { value: 'skip', label: 'Bỏ qua dòng' },
    ],
  },
  {
    id: 'e4', row: 45, dishName: 'Bánh mì thịt', field: 'name',
    currentValue: 'Phở bò', problem: 'Trùng tên món đã có',
    kind: 'duplicate', fixType: 'select', fixValue: 'skip',
    fixOptions: [
      { value: 'skip', label: 'Bỏ qua' },
      { value: 'update', label: 'Cập nhật món hiện có' },
      { value: 'draft', label: 'Tạo bản nháp mới' },
    ],
  },
  {
    id: 'e5', row: 58, dishName: 'Gỏi cuốn', field: 'calories',
    currentValue: '1.200kcal', problem: 'Sai định dạng số',
    kind: 'error', fixType: 'input', fixValue: '120',
  },
  {
    id: 'e6', row: 67, dishName: 'Chả cá Lã Vọng', field: 'meal_types',
    currentValue: 'breakfast', problem: 'Không nằm trong danh mục',
    kind: 'warning', fixType: 'select', fixValue: 'sang',
    fixOptions: [
      { value: 'sang', label: 'Sáng' },
      { value: 'trua', label: 'Trưa' },
      { value: 'toi', label: 'Tối' },
      { value: 'skip', label: 'Bỏ qua' },
    ],
  },
  {
    id: 'e7', row: 89, dishName: '(trống)', field: 'name',
    currentValue: '', problem: 'Thiếu trường bắt buộc',
    kind: 'error', fixType: 'input', fixValue: '',
  },
  {
    id: 'w1', row: 18, dishName: 'Bún bò Huế', field: 'image_url',
    currentValue: 'http://old-cdn/bunbo.jpg', problem: 'URL không dùng HTTPS',
    kind: 'warning', fixType: 'select', fixValue: 'keep',
    fixOptions: [
      { value: 'keep', label: 'Giữ URL' },
      { value: 'drop', label: 'Bỏ ảnh' },
    ],
  },
  {
    id: 'w2', row: 41, dishName: 'Mì Quảng', field: 'servings',
    currentValue: '2-3', problem: 'Nên là số nguyên',
    kind: 'warning', fixType: 'input', fixValue: '2',
  },
  {
    id: 'd1', row: 102, dishName: 'Phở bò', field: 'name',
    currentValue: 'Phở bò', problem: 'Trùng với món dòng 1',
    kind: 'duplicate', fixType: 'select', fixValue: 'skip',
    fixOptions: [
      { value: 'skip', label: 'Bỏ qua' },
      { value: 'update', label: 'Cập nhật món hiện có' },
      { value: 'draft', label: 'Tạo bản nháp mới' },
    ],
  },
]

export const FILE_RULES = [
  {
    title: 'Tiêu đề cột',
    desc: 'Tên cột nên viết không dấu, không khoảng trắng (ví dụ: dish_name, calories).',
  },
  {
    title: 'Định dạng',
    desc: 'File CSV hoặc Excel (.xlsx), mã hóa UTF-8.',
  },
  {
    title: 'Mỗi món một dòng',
    desc: 'Mỗi hàng tương ứng một món ăn, không gộp nhiều món trên cùng dòng.',
  },
  {
    title: 'Nhiều giá trị',
    desc: 'Các trường nhiều giá trị (tags, nguyên liệu) phân tách bằng dấu chấm phẩy (;).',
  },
]

export const SAMPLE_CSV = `dish_name,short_desc,region,meal_types,category,calories,protein,carbs,fat,image_url,ingredients,cook_time,servings
Phở bò,Nước dùng đậm đà bánh phở mềm,Bắc Bộ,Sáng; Trưa,Món nước,480,28,45,12,https://cdn.mogu.vn/pho-bo.jpg,Bánh phở; Thịt bò; Hành,30,1
Bún chả,Thịt nướng than hoa,Bắc Bộ,Trưa; Tối,Món nước,520,26,50,18,https://cdn.mogu.vn/bun-cha.jpg,Bún; Thịt heo; Chả,25,1
Cơm tấm,Sườn bì chả trứng,Nam Bộ,Trưa; Tối,Cơm,650,30,70,22,https://cdn.mogu.vn/com-tam.jpg,Cơm tấm; Sườn; Bì,20,1
`

export function autoMapField(fileCol: string): string {
  const key = fileCol.trim().toLowerCase().replace(/\s+/g, '_')
  const found = MOGU_FIELDS.find((f) => f.id && f.aliases.includes(key))
  return found?.id ?? ''
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}



