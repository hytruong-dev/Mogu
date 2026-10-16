import { useNavigate } from 'react-router-dom'
import type { ImportJob } from '../../types'
import { useAdminDish } from '../../hooks/useDishes'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { parseJobSummary } from './types'
import {
  CheckCircle2,
  CookingPot,
  Clock,
  Users,
  Flame,
  ChefHat,
  AlertTriangle,
  Leaf,
  Pencil,
  ArrowLeft,
  Plus,
  Sparkles,
} from 'lucide-react'

export interface ImportSuccessViewProps {
  job: ImportJob
  onNew: () => void
}

export function ImportSuccessView({ job, onNew }: ImportSuccessViewProps) {
  const navigate = useNavigate()
  const { data: dish } = useAdminDish(job.resultDishId ?? '')
  const summary = parseJobSummary(job)
  const image = (job as any).suggestedImageUrl as string | undefined
  const nutrition = (dish as any)?.nutrition
  const ingredients = (dish as any)?.dishIngredients ?? []
  const steps = (dish as any)?.recipeSteps ?? []
  const dishName = dish?.name ?? job.query
  const reconLog = (job.logs ?? []).find((l) => l.step === 'RECONCILING')
  const logPending = Number(
    `${reconLog?.message ?? ''} ${(reconLog as any)?.detail ?? ''}`.match(/Mới:\s*(\d+)/)?.[1] ?? 0
  )
  const pendingIngredients = dish
    ? ingredients.filter((di: any) => !di.ingredient || di.ingredient.status !== 'ACTIVE').length
    : job.pendingIngredientCount ?? logPending

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 text-center">
      {/* Success Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-md ring-8 ring-emerald-50/50 mb-4 animate-in zoom-in-90 duration-300">
        <CheckCircle2 className="h-8 w-8 stroke-[2.2]" />
      </div>

      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
        Đã tạo bản nháp thành công
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        AI đã hoàn tất xử lý <strong className="text-foreground font-semibold">"{dishName}"</strong>. Hãy kiểm tra các chỉ số trước khi gửi duyệt.
      </p>

      {/* Main Card */}
      <Card className="mt-6 text-left border-border shadow-md overflow-hidden bg-card">
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CookingPot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base tracking-tight">{dishName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                  Bản nháp
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">
                  DISH-{(job.resultDishId ?? job.id).slice(0, 6).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            AI Generated
          </Badge>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
              <div className="text-xl font-extrabold text-foreground">
                {ingredients.length || summary.ingredients || 0}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground mt-0.5">nguyên liệu</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
              <div className="text-xl font-extrabold text-foreground">
                {steps.length || summary.steps || 0}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground mt-0.5">bước chế biến</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
              <div className="text-xl font-extrabold text-foreground">
                {[nutrition?.calories, nutrition?.proteinG, nutrition?.carbsG, nutrition?.fatG, nutrition?.fiberG].filter(
                  Boolean
                ).length || 0}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground mt-0.5">chỉ số dinh dưỡng</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
              <div className="text-xl font-extrabold text-foreground">
                {image ? 1 : 0}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground mt-0.5">ảnh minh họa</div>
            </div>
          </div>

          {/* AI Notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Dữ liệu do AI tạo có thể cần tinh chỉnh. Vui lòng kiểm tra kỹ nguyên liệu, định lượng, khẩu phần và dinh dưỡng trước khi phát hành.
            </span>
          </div>

          {/* Pending Ingredients Notice */}
          {pendingIngredients > 0 && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs flex-wrap">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Leaf className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Có <b className="font-bold text-foreground">{pendingIngredients}</b> nguyên liệu mới tự động tìm cần xác nhận trước khi duyệt món.
                </span>
              </div>
              {job.resultDishId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold gap-1"
                  onClick={() => navigate(`/foods/${job.resultDishId}?step=ingredients`)}
                >
                  Xử lý nguyên liệu →
                </Button>
              )}
            </div>
          )}

          {/* Dish Details Preview Card */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
              {image ? (
                <Image
                  src={image}
                  alt={dishName}
                  aspectRatio="square"
                  zoomable
                  title={dishName}
                  subtitle="Ảnh minh họa AI"
                  className="w-full h-full object-cover"
                />
              ) : (
                <CookingPot className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs flex-1">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" /> Nấu:
                </span>
                <span className="font-bold text-foreground">{dish?.cookMinutes ?? '—'} phút</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" /> Khẩu phần:
                </span>
                <span className="font-bold text-foreground">{dish?.servings ?? '—'} người</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Flame className="h-3 w-3 text-amber-500" /> Năng lượng:
                </span>
                <span className="font-bold text-foreground">{nutrition?.calories ?? summary.calories ?? '—'} kcal</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ChefHat className="h-3 w-3 text-muted-foreground" /> Độ khó:
                </span>
                <span className="font-bold text-foreground">
                  {dish?.difficulty === 'EASY' ? 'Dễ' : dish?.difficulty === 'HARD' ? 'Khó' : 'Trung bình'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            className="w-full h-10 gap-2 font-bold shadow-xs cursor-pointer"
            onClick={() => job.resultDishId && navigate(`/foods/${job.resultDishId}`)}
          >
            <Pencil className="h-4 w-4" />
            Mở để kiểm tra & chỉnh sửa món ăn
          </Button>

          {/* Secondary Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-semibold cursor-pointer"
              onClick={() => navigate('/foods')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Về kho món
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-semibold cursor-pointer"
              onClick={onNew}
            >
              <Plus className="h-3.5 w-3.5" />
              Nhập thêm món khác
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
