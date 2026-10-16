import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import { energySplit, type NutritionState } from './NutritionForm'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'

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
      <Card className="shadow-xs">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground">Kiểm tra dinh dưỡng</h3>
          <div className="mt-4 divide-y divide-border">
            {checks.map((c) => (
              <div key={c.title} className="flex items-center gap-3 py-3">
                {c.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-foreground">{c.title}</div>
                </div>
                <Badge variant={c.ok ? 'success' : 'warning'} className="text-xs">
                  {c.ok ? c.okLabel : c.warnLabel}
                </Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground">Xem trước trên ứng dụng</h3>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-foreground">{kcal || '—'} kcal</div>
            <div className="mt-1 text-sm text-muted-foreground">/ {state.servingLabel}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Protein {protein || 0} g
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Carb {carb || 0} g
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Chất béo {fat || 0} g
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Chất xơ {fiber || 0} g
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground">Sai số ước tính</h3>
          <div className="mt-2 text-3xl font-extrabold text-foreground">±{split.total ? 8 : 0}%</div>
          <p className="mt-1 text-sm text-muted-foreground">So với giá trị thực tế</p>
        </CardContent>
      </Card>
    </div>
  )
}
