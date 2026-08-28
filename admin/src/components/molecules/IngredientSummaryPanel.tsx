import { ChefHat, CircleCheck, Info, Scale, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { DishIngredientRow } from './IngredientsTable'

interface IngredientSummaryPanelProps {
  rows: DishIngredientRow[]
  servings: number
}

export function IngredientSummaryPanel({ rows, servings }: IngredientSummaryPanelProps) {
  const required = rows.filter((r) => r.required).length
  const optional = rows.length - required
  const filled = rows.filter((r) => r.name.trim() && r.qty.trim()).length
  const duplicates = rows
    .map((r) => r.name.trim().toLowerCase())
    .filter(Boolean)
    .some((name, i, arr) => arr.indexOf(name) !== i)
  const hasGluten = rows.some((r) => /phở|bột mì|gluten|bánh mì|mì/i.test(r.name))
  const completion = Math.min(100, Math.round(((filled / Math.max(rows.length, 1)) * 0.7 + (rows.length > 0 ? 0.3 : 0)) * 100))

  const summary = [
    { icon: ChefHat, label: 'Tổng số nguyên liệu', value: String(rows.length) },
    { icon: ShieldCheck, label: 'Nguyên liệu bắt buộc', value: String(required) },
    { icon: Info, label: 'Nguyên liệu tùy chọn', value: String(optional) },
    { icon: Scale, label: 'Định lượng cho', value: `${servings} khẩu phần` },
  ]

  const checks = [
    {
      ok: !duplicates,
      title: 'Kiểm tra trùng lặp',
      okDesc: 'Không phát hiện nguyên liệu trùng lặp.',
      warnDesc: 'Có nguyên liệu trùng tên trong bảng.',
    },
    {
      ok: rows.every((r) => !r.name || r.unit),
      title: 'Đơn vị chuẩn hóa',
      okDesc: 'Tất cả đơn vị đều đã được chuẩn hóa.',
      warnDesc: 'Một số dòng chưa có đơn vị.',
    },
    {
      ok: !hasGluten,
      title: 'Bảng chứng dị ứng',
      okDesc: 'Không có cảnh báo dị ứng.',
      warnDesc: '1 nguyên liệu cần kiểm tra dị ứng (gluten).',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Tóm tắt thành phần</h3>
        <div className="mt-3 divide-y divide-black/5">
          {summary.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 py-3.5">
              <Icon className="h-[18px] w-[18px] text-gray-500" strokeWidth={1.8} />
              <span className="flex-1 text-[15px]">{label}</span>
              <span className="text-[15px] font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Kiểm tra dữ liệu</h3>
        <div className="mt-4 space-y-5">
          {checks.map((c) => (
            <div key={c.title} className="flex items-start gap-3">
              {c.ok ? (
                <CircleCheck className="h-6 w-6 shrink-0 text-ok-green" strokeWidth={1.8} />
              ) : (
                <TriangleAlert className="h-6 w-6 shrink-0 text-warn-orange" strokeWidth={1.8} />
              )}
              <div>
                <div className="text-[15px] font-semibold">{c.title}</div>
                <div className="mt-0.5 text-sm text-gray-500">{c.ok ? c.okDesc : c.warnDesc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Mức độ hoàn thiện</span>
            <span className="text-[15px] font-bold">{completion} %</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ok-green to-green-400"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
