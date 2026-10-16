import { ChefHat, CircleCheck, Info, Scale, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Progress } from '../ui/progress'
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
      <Card className="shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Tóm tắt thành phần</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="divide-y divide-border">
            {summary.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3">
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                <span className="flex-1 text-sm text-foreground">{label}</span>
                <span className="text-sm font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Kiểm tra dữ liệu</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <div className="space-y-4">
            {checks.map((c) => (
              <div key={c.title} className="flex items-start gap-3">
                {c.ok ? (
                  <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.8} />
                ) : (
                  <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.8} />
                )}
                <div>
                  <div className="text-sm font-medium text-foreground">{c.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.ok ? c.okDesc : c.warnDesc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">Mức độ hoàn thiện</span>
              <span className="font-bold text-foreground">{completion}%</span>
            </div>
            <Progress
              value={completion}
              className="mt-2.5 h-2"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
