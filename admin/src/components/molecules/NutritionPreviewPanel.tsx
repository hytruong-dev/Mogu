import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import { energySplit, type NutritionState } from './NutritionForm'
import { cn } from '@/lib/utils'

interface NutritionPreviewPanelProps {
  state: NutritionState
}

export function NutritionPreviewPanel({ state }: NutritionPreviewPanelProps) {
  const kcal = Number(state.calories) || 0
  const protein = Number(state.proteinG) || 0
  const carb = Number(state.carbG) || 0
  const fat = Number(state.fatG) || 0
  const fiber = Number(state.fiberG) || 0
  const sodium = Number(state.sodiumMg) || 0
  const split = energySplit(state)

  const hasMacros = kcal > 0 || protein + carb + fat > 0
  const sodiumWarn = sodium >= 800
  const hasSource = !!state.source

  const checks = [
    { ok: hasMacros, title: 'Đủ thông tin macro', okLabel: 'Hợp lệ', warnLabel: 'Thiếu dữ liệu' },
    { ok: kcal > 0 && kcal < 1500, title: 'Năng lượng hợp lý', okLabel: 'Hợp lệ', warnLabel: 'Cần kiểm tra' },
    { ok: !sodiumWarn, title: 'Natri', okLabel: 'Hợp lệ', warnLabel: 'Cần cảnh báo' },
    { ok: hasSource, title: 'Đã gắn nguồn & phương pháp', okLabel: 'Hợp lệ', warnLabel: 'Chưa có nguồn' },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Kiểm tra dinh dưỡng</h3>
        <div className="mt-4 divide-y divide-black/5">
          {checks.map((c) => (
            <div key={c.title} className="flex items-center gap-3 py-3">
              {c.ok ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-ok-green" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-warn-orange" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{c.title}</div>
              </div>
              <span className={cn('text-sm font-medium', c.ok ? 'text-ok-green' : 'text-warn-orange')}>
                {c.ok ? c.okLabel : c.warnLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Xem trước trên ứng dụng</h3>
        <div className="mt-4">
          <div className="text-3xl font-extrabold">{kcal || '—'} kcal</div>
          <div className="mt-1 text-sm text-gray-500">/ {state.servingLabel}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-ok-green" /> Protein {protein || 0} g
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-mogu-yellow" /> Carb {carb || 0} g
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-warn-orange" /> Chất béo {fat || 0} g
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Chất xơ {fiber || 0} g
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Sai số ước tính</h3>
        <div className="mt-2 text-3xl font-extrabold">±{split.total ? 8 : 0}%</div>
        <p className="mt-1 text-sm text-gray-500">So với giá trị thực tế</p>
      </div>
    </div>
  )
}
