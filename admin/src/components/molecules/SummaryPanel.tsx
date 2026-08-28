import { CheckCircle2, Circle } from 'lucide-react'
import { FilterChip } from '../atoms/FilterChip'
import type { ClassificationState } from './ClassificationPanel'

interface SummaryPanelProps {
  state: ClassificationState
  categories: { id: string; name: string }[]
  mealTypes: { id: string; name: string }[]
  goals: { id: string; name: string }[]
  dietTypes: { id: string; name: string }[]
}

const SUGGESTIONS = [
  { title: 'Onboarding', desc: 'Hiển thị ở bước giới thiệu món ăn trong onboarding', fit: true },
  { title: 'Random món', desc: 'Có thể được xuất hiện cùng với gợi ý món ngẫu nhiên', fit: true },
  { title: 'Kế hoạch tuần', desc: 'Được gán vào các kế hoạch ăn uống cá nhân hoá', fit: false },
]

/**
 * Panel bên phải của bước Phân loại:
 * - Xem trước phân loại (danh mục, bữa ăn, mục tiêu, chế độ, khẩu vị, loại, giá)
 * - Phạm vi gợi ý (onboarding / random / kế hoạch tuần)
 * - Thanh tiến độ hoàn thiện
 */
export function SummaryPanel({ state, categories, mealTypes, goals, dietTypes }: SummaryPanelProps) {
  const catNames = categories.filter((c) => state.categoryIds.includes(c.id)).map((c) => c.name)
  const mealNames = mealTypes.filter((m) => state.mealTypeIds.includes(m.id)).map((m) => m.name)
  const goalNames = goals.filter((g) => state.goalIds.includes(g.id)).map((g) => g.name)
  const dietName = dietTypes.find((d) => state.dietTypeIds[0] === d.id)?.name ?? 'Không yêu cầu'
  const dishTypeLabel =
    state.dishType === 'monNuoc' ? 'Món nước' : state.dishType === 'monKho' ? 'Món khô' : 'Bất kỳ'

  const groups = [
    { label: 'Danh mục', tags: catNames },
    { label: 'Loại bữa ăn', tags: mealNames },
    { label: 'Mục tiêu', tags: goalNames },
    { label: 'Chế độ ăn', tags: dietName ? [dietName] : [] },
    { label: 'Khẩu vị', tags: state.flavors },
    { label: 'Loại món', tags: [dishTypeLabel] },
  ]

  const completed = groups.filter((g) => g.tags.length > 0).length + (state.priceFrom && state.priceTo ? 1 : 0)
  const total = groups.length + 1
  const progressPct = Math.round((completed / total) * 100)

  return (
    <div className="space-y-6">
      {/* Xem trước phân loại */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">Xem trước phân loại</h3>
        <div className="mt-4 divide-y divide-border">
          {groups.map((g) => (
            <div key={g.label} className="flex items-start gap-4 py-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{g.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {g.tags.length ? (
                  g.tags.map((t) => <FilterChip key={t} label={t} variant="yellow" />)
                ) : (
                  <span className="text-xs text-muted-foreground/60">—</span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 py-3 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Khoảng giá</span>
            <span className="font-medium">
              {state.priceFrom || '0'} đ – {state.priceTo || '0'} đ
            </span>
          </div>
        </div>
      </div>

      {/* Phạm vi gợi ý */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold">Phạm vi gợi ý</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Món ăn của bạn sẽ xuất hiện tại các khu vực gợi ý phù hợp
        </p>
        <div className="mt-4 space-y-4">
          {SUGGESTIONS.map((s) => (
            <div key={s.title} className="flex items-start gap-3">
              {s.fit ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              <span
                className={
                  s.fit
                    ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700'
                    : 'rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground'
                }
              >
                {s.fit ? 'Phù hợp' : 'Không'}
              </span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Hoàn thiện phân loại</span>
            <span className="font-semibold">
              {completed} / {total}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
