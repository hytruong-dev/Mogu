import { Clock, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

export interface ReviewMetrics {
  readyCount: number
  needsWorkCount: number
  avgScore: number
}

export interface ReviewMetricsCardsProps {
  isLoading: boolean
  total: number
  metrics: ReviewMetrics
}

export function ReviewMetricsCards({
  isLoading,
  total,
  metrics,
}: ReviewMetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Card 1: Total Waiting */}
      <Card className="p-4 bg-card hover:border-amber-400/50 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Chờ duyệt trong hàng đợi</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock size={16} />
          </div>
        </div>
        <div className="mt-2 text-2xl font-extrabold text-foreground min-h-[32px] flex items-center">
          {isLoading ? <Skeleton className="h-7 w-12" /> : total}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Món ăn đang chờ rà soát
        </p>
      </Card>

      {/* Card 2: Ready to Approve */}
      <Card className="p-4 bg-card hover:border-emerald-400/50 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Đủ điều kiện xuất bản</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 min-h-[32px] flex items-center">
          {isLoading ? <Skeleton className="h-7 w-12" /> : metrics.readyCount}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Điểm tin cậy cao (≥80%)
        </p>
      </Card>

      {/* Card 3: Needs Work */}
      <Card className="p-4 bg-card hover:border-rose-400/50 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Cần hoàn thiện / Lưu ý</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={16} />
          </div>
        </div>
        <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400 min-h-[32px] flex items-center">
          {isLoading ? <Skeleton className="h-7 w-12" /> : metrics.needsWorkCount}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Thiếu ảnh hoặc calo (&lt;80%)
        </p>
      </Card>

      {/* Card 4: Average Quality */}
      <Card className="p-4 bg-card hover:border-blue-400/50 transition-colors">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Chất lượng trung bình</span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sparkles size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 min-h-[32px]">
          <span className="text-2xl font-extrabold text-foreground">
            {isLoading ? <Skeleton className="h-7 w-14" /> : `${metrics.avgScore}%`}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
          <div
            className="bg-amber-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${metrics.avgScore}%` }}
          />
        </div>
      </Card>
    </div>
  )
}
