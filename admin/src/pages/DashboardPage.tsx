import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  FileCheck2,
  Flame,
  Heart,
  HeartPulse,
  Layers,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Utensils,
  XCircle,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '../components/ui/chart'
import { useImportJobs } from '../hooks/useImportJobs'
import {
  useDashboardActivities,
  useDashboardGrowth,
  useDashboardSummary,
  useTrendingDishes,
} from '../hooks/useDashboard'
import type { ActivityItem, GrowthPoint, TrendingDishItem } from '../api/dashboard'
import type { ImportJob } from '../types'

// ─── Stat Card Component ───────────────────────────────────────────────────────

interface StatCardProps {
  icon: typeof BookOpen
  value: string | number
  label: string
  tone?: 'emerald' | 'amber' | 'blue' | 'rose' | 'purple'
  note?: string
  trend?: string | null
  onClick?: () => void
  loading?: boolean
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone = 'amber',
  note,
  trend,
  onClick,
  loading,
}: StatCardProps) {
  const toneMap = {
    emerald: {
      bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40',
      border: 'hover:border-emerald-400/50',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40',
      border: 'hover:border-amber-400/50',
    },
    blue: {
      bg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200/50 dark:border-sky-800/40',
      border: 'hover:border-sky-400/50',
    },
    rose: {
      bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/40',
      border: 'hover:border-rose-400/50',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/40',
      border: 'hover:border-purple-400/50',
    },
  }

  const { bg, border } = toneMap[tone]

  return (
    <Card
      onClick={onClick}
      className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md ${border} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block truncate">
              {label}
            </span>
            {loading ? (
              <Skeleton className="h-8 w-24 my-1" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                {value}
              </div>
            )}
            {!loading && (note || trend) && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {trend && (
                  <Badge
                    variant={trend.startsWith('-') ? 'destructive' : 'success'}
                    className="text-[11px] font-semibold py-0 px-1.5 h-5 flex items-center gap-1 shrink-0"
                  >
                    <TrendingUp size={11} />
                    {trend}
                  </Badge>
                )}
                {note && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[140px] sm:max-w-none">
                    {note}
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105 ${bg}`}
          >
            <Icon size={22} strokeWidth={2.2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Pipeline Widget ──────────────────────────────────────────────────────────

function PipelineWidget({ jobs, onNavigate }: { jobs: ImportJob[]; onNavigate: () => void }) {
  const active = jobs.filter((j) =>
    ['PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING', 'DRAFTING'].includes(
      j.status
    )
  )

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap size={17} className="text-amber-500" />
              Pipeline tự động
            </CardTitle>
            <CardDescription className="text-xs">Tiến trình AI thu thập & chuẩn hóa</CardDescription>
          </div>
          <Badge
            variant={active.length > 0 ? 'warning' : 'outline'}
            className="text-[11px] font-semibold h-5"
          >
            {active.length > 0 ? `${active.length} đang chạy` : 'Tất cả đã xong'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-1 flex-1 space-y-3">
        {active.length === 0 && (
          <div className="py-7 text-center text-muted-foreground">
            <Layers className="mx-auto h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">Không có tiến trình nào đang chạy</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Hệ thống đã hoàn tất các mẻ nhập dữ liệu
            </p>
          </div>
        )}
        {active.slice(0, 3).map((job) => {
          const pct = job.progress ?? 0
          return (
            <div
              key={job.id}
              className="space-y-2 rounded-lg border border-border/70 p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-semibold text-foreground truncate">{job.query}</span>
                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  {pct}%
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="capitalize font-medium text-foreground/80">
                  {job.status.toLowerCase()}
                </span>
                <span className="truncate max-w-[120px]">
                  {(job.sourceTypes ?? []).slice(0, 2).join(', ')}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
      <CardFooter className="p-4 pt-0 border-t border-border/60 bg-muted/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs font-semibold text-muted-foreground hover:text-foreground h-9"
          onClick={onNavigate}
        >
          <span>Xem tất cả pipeline ({jobs.length})</span>
          <ChevronRight size={14} />
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Popular / Trending Dishes Widget ─────────────────────────────────────────

function PopularFoodsWidget({
  items,
  fallback,
  loading,
  onSelectDish,
  onNavigateAll,
}: {
  items: TrendingDishItem[]
  fallback: boolean
  loading?: boolean
  onSelectDish: (dish: TrendingDishItem) => void
  onNavigateAll: () => void
}) {
  const rankStyles = [
    'bg-amber-400 text-zinc-950 font-extrabold ring-1 ring-amber-500/30',
    'bg-slate-200 text-slate-900 font-bold dark:bg-slate-700 dark:text-slate-100',
    'bg-amber-700 text-white font-bold ring-1 ring-amber-800/30',
  ]

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Flame size={17} className="text-rose-500" />
              Món thịnh hành
            </CardTitle>
            <CardDescription className="text-xs">
              {fallback ? 'Món được lưu nhiều nhất (dự phòng)' : 'Món được xem & tương tác nhiều (7 ngày)'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold h-5">
            Top 5
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-1 flex-1 space-y-1.5">
        {loading && (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4, 5].map((k) => (
              <div key={k} className="flex items-center gap-3 p-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-7 text-center text-muted-foreground">
            <Utensils className="mx-auto h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">Chưa có dữ liệu thống kê món</p>
          </div>
        )}
        {!loading &&
          items.map((dish, i) => {
            const rankBadgeClass = rankStyles[i] ?? 'bg-muted text-muted-foreground font-semibold'

            return (
              <div
                key={dish.dishId}
                onClick={() => onSelectDish(dish)}
                className="group flex items-center gap-3 p-2 rounded-lg transition-all duration-150 hover:bg-accent/80 cursor-pointer border border-transparent hover:border-border/60"
                title="Nhấn để xem chi tiết món ăn"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${rankBadgeClass}`}
                >
                  {dish.rank}
                </span>
                {dish.imageUrl ? (
                  <img
                    src={dish.imageUrl}
                    alt={dish.name}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover border border-border/80 shadow-2xs"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/70">
                    <Utensils size={14} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate block group-hover:text-amber-600 transition-colors">
                    {dish.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate block">
                    {dish.categoryName ?? 'Món Việt'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground shrink-0">
                  <span
                    className="flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded text-[11px]"
                    title={`${dish.metrics.views} lượt xem`}
                  >
                    <Eye size={12} className="text-muted-foreground" />
                    {dish.metrics.views.toLocaleString()}
                  </span>
                  {dish.metrics.saves > 0 && (
                    <span
                      className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded"
                      title={`${dish.metrics.saves} lượt lưu`}
                    >
                      <Bookmark size={11} fill="currentColor" />
                      {dish.metrics.saves}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
      </CardContent>
      <CardFooter className="p-4 pt-0 border-t border-border/60 bg-muted/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs font-semibold text-muted-foreground hover:text-foreground h-9"
          onClick={onNavigateAll}
        >
          <span>Quản lý kho món ăn</span>
          <ChevronRight size={14} />
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Activity Icon & Widget ───────────────────────────────────────────────────

function activityIcon(type: string, status: string) {
  if (type === 'IMPORT_JOB') {
    if (status === 'DONE') return <CheckCircle2 size={15} className="text-emerald-500" />
    if (status === 'FAILED') return <XCircle size={15} className="text-rose-500" />
    return <RotateCw size={14} className="text-amber-500 animate-spin" />
  }
  if (type === 'DISH_REVIEW') return <ShieldCheck size={15} className="text-amber-600" />
  if (type === 'MODERATION') return <Heart size={15} className="text-rose-500" />
  if (type === 'ADMIN_ACTION') return <Users size={15} className="text-blue-500" />
  return <Clock3 size={15} className="text-muted-foreground" />
}

function ActivityWidget({
  items,
  loading,
  onNavigateItem,
  onNavigateAll,
}: {
  items: ActivityItem[]
  loading?: boolean
  onNavigateItem: (route: string) => void
  onNavigateAll: () => void
}) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock3 size={17} className="text-blue-500" />
              Hoạt động gần đây
            </CardTitle>
            <CardDescription className="text-xs">Nhật ký xử lý hệ thống theo thời gian thực</CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold h-5 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-1 flex-1 space-y-2.5">
        {loading && (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-7 text-center text-muted-foreground">
            <RotateCw className="mx-auto h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium">Chưa có hoạt động nào được ghi lại</p>
          </div>
        )}
        {!loading &&
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigateItem(item.route)}
              className="flex items-start gap-2.5 text-xs w-full text-left hover:bg-accent/70 rounded-lg p-2 transition-colors border-0 bg-transparent cursor-pointer"
            >
              <div className="pt-0.5 shrink-0">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-muted">
                    {item.actor?.displayName?.[0] ?? 'A'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0">{activityIcon(item.type, item.status)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
              </div>
              <time className="text-[10px] text-muted-foreground whitespace-nowrap font-mono shrink-0 pt-0.5">
                {new Date(item.occurredAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </button>
          ))}
      </CardContent>
      <CardFooter className="p-4 pt-0 border-t border-border/60 bg-muted/10">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs font-semibold text-muted-foreground hover:text-foreground h-9"
          onClick={onNavigateAll}
        >
          <span>Xem tất cả nhật ký</span>
          <ChevronRight size={14} />
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Tasks Widget ─────────────────────────────────────────────────────────────

const TASK_META: Record<
  string,
  { label: string; note: string; priorityLabel: string; tone: 'amber' | 'muted' | 'rose' }
> = {
  PENDING_REVIEW: {
    label: 'Món ưu tiên kiểm duyệt',
    note: 'Cần phản hồi và duyệt sớm',
    priorityLabel: 'Ưu tiên cao',
    tone: 'amber',
  },
  LOW_CONFIDENCE: {
    label: 'Món cần đối chiếu dữ liệu',
    note: 'Độ tin cậy nguồn thông tin thấp',
    priorityLabel: 'Cần xác minh',
    tone: 'muted',
  },
  OPEN_REPORTS: {
    label: 'Báo cáo vi phạm đang mở',
    note: 'Cần xử lý trong hàng đợi cộng đồng',
    priorityLabel: 'Khẩn cấp',
    tone: 'rose',
  },
  UNLINKED_INGREDIENTS: {
    label: 'Nguyên liệu chưa liên kết',
    note: 'Cần map với kho nguyên liệu chuẩn',
    priorityLabel: 'Chuẩn hóa',
    tone: 'muted',
  },
  FAILED_JOBS: {
    label: 'Job nhập lỗi gần đây',
    note: 'Cần kiểm tra pipeline AI',
    priorityLabel: 'Lỗi',
    tone: 'muted',
  },
}

function TasksWidget({
  tasks,
  loading,
  onNavigate,
}: {
  tasks: Array<{ key: string; count: number; route: string; priority: string }>
  loading?: boolean
  onNavigate: (route: string) => void
}) {
  const visible = tasks
    .filter((t) => t.count > 0 || ['PENDING_REVIEW', 'LOW_CONFIDENCE'].includes(t.key))
    .slice(0, 4)

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileCheck2 size={17} className="text-amber-500" />
              Nhiệm vụ cần giải quyết
            </CardTitle>
            <CardDescription className="text-xs">Hàng đợi công việc cần xử lý hôm nay</CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold h-5">
            {visible.reduce((acc, t) => acc + t.count, 0)} việc
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-1 flex-1 space-y-2.5">
        {loading && (
          <div className="space-y-2.5 py-1">
            {[1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/60 mb-2" />
            <p className="text-xs font-semibold text-foreground">Tuyệt vời! Không còn việc tồn đọng</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hệ thống đang ở trạng thái tối ưu
            </p>
          </div>
        )}
        {!loading &&
          visible.map((task) => {
            const meta = TASK_META[task.key] ?? {
              label: task.key,
              note: '',
              priorityLabel: 'Thông tin',
              tone: 'muted' as const,
            }
            const isAmber = meta.tone === 'amber' || task.priority === 'high'
            const isRose = meta.tone === 'rose'

            return (
              <div
                key={task.key}
                onClick={() => onNavigate(task.route.split('?')[0])}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-150 cursor-pointer group ${
                  isRose
                    ? 'border-rose-200/80 bg-rose-50/40 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:border-rose-800/40'
                    : isAmber
                    ? 'border-amber-200/80 bg-amber-50/40 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:border-amber-800/40'
                    : 'border-border bg-card hover:bg-accent/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs shadow-2xs ${
                      isRose
                        ? 'bg-rose-500 text-white'
                        : isAmber
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {task.count}
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-foreground block group-hover:text-amber-600 transition-colors truncate">
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate">{meta.note}</span>
                  </div>
                </div>
                <ChevronRight
                  size={15}
                  className="text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                />
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}

// ─── Activity & Growth Chart Component ─────────────────────────────────────────

const chartConfig = {
  newDishes: {
    label: 'Mới trích xuất',
    color: '#F59E0B',
  },
  publishedDishes: {
    label: 'Đã duyệt xuất bản',
    color: '#10B981',
  },
} satisfies ChartConfig

function ChartCustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  const newCount = data.newDishes ?? 0
  const pubCount = data.publishedDishes ?? 0
  const rate = newCount > 0 ? Math.round((pubCount / newCount) * 100) : 100

  return (
    <div className="rounded-xl border border-border/80 bg-background/95 p-3 shadow-xl backdrop-blur-md text-xs min-w-[180px] space-y-2.5">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-medium text-foreground">
        <span>Ngày {data.fullDate || data.formattedDate}</span>
        {newCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            {rate}% duyệt
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
            <span>Mới trích xuất:</span>
          </div>
          <span className="font-mono font-bold text-foreground">{newCount}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Đã xuất bản:</span>
          </div>
          <span className="font-mono font-bold text-foreground">{pubCount}</span>
        </div>
      </div>
    </div>
  )
}

function ActivityChart({
  series,
  days,
  onDaysChange,
  loading,
}: {
  series: GrowthPoint[]
  days: number
  onDaysChange: (d: number) => void
  loading?: boolean
}) {
  const [activeSeries, setActiveSeries] = useState<'all' | 'newDishes' | 'publishedDishes'>('all')

  const totalNew = useMemo(() => series.reduce((acc, p) => acc + p.newDishes, 0), [series])
  const totalPub = useMemo(() => series.reduce((acc, p) => acc + p.publishedDishes, 0), [series])
  const approvalRate = totalNew > 0 ? Math.round((totalPub / totalNew) * 100) : 100

  const chartData = useMemo(() => {
    return series.map((p) => {
      const parts = p.date.split('-')
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : p.date
      const fullDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : p.date
      return {
        date: p.date,
        formattedDate,
        fullDate,
        newDishes: p.newDishes,
        publishedDishes: p.publishedDishes,
      }
    })
  }, [series])

  const maxVal = Math.max(1, ...series.flatMap((p) => [p.newDishes, p.publishedDishes]))
  const yDomain = [0, Math.ceil(maxVal * 1.25)]

  return (
    <Card className="flex flex-col h-full overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={16} />
              </span>
              <span>Biểu đồ tăng trưởng món ăn</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Tương quan món mới trích xuất vs đã duyệt xuất bản qua các ngày
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Interactive Legend Pills */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setActiveSeries((prev) => (prev === 'newDishes' ? 'all' : 'newDishes'))
                }
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none text-xs font-medium',
                  activeSeries === 'newDishes'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-400/20 font-semibold'
                    : activeSeries === 'all'
                      ? 'bg-background border-border/70 hover:bg-muted/50 text-foreground'
                      : 'opacity-40 border-transparent hover:opacity-75 text-muted-foreground'
                )}
                title="Bấm để lọc xem riêng món mới"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span>Mới:</span>
                <strong className="font-semibold font-mono">{totalNew}</strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveSeries((prev) => (prev === 'publishedDishes' ? 'all' : 'publishedDishes'))
                }
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none text-xs font-medium',
                  activeSeries === 'publishedDishes'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400/20 font-semibold'
                    : activeSeries === 'all'
                      ? 'bg-background border-border/70 hover:bg-muted/50 text-foreground'
                      : 'opacity-40 border-transparent hover:opacity-75 text-muted-foreground'
                )}
                title="Bấm để lọc xem riêng món đã xuất bản"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Xuất bản:</span>
                <strong className="font-semibold font-mono">{totalPub}</strong>
              </button>

              {totalNew > 0 && (
                <span
                  className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
                  title="Tỉ lệ món đã được duyệt xuất bản trên tổng số món mới trích xuất"
                >
                  <CheckCircle2 size={12} />
                  {approvalRate}% duyệt
                </span>
              )}
            </div>

            {/* Time range selector */}
            <Tabs value={String(days)} onValueChange={(val) => onDaysChange(Number(val))}>
              <TabsList className="h-8 p-0.5 bg-muted/70">
                <TabsTrigger value="7" className="text-xs px-2.5 py-1 font-medium">
                  7 ngày
                </TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2.5 py-1 font-medium">
                  30 ngày
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-1 flex-1 flex flex-col justify-end">
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
            <TrendingUp size={28} className="opacity-30" />
            <span>Chưa có dữ liệu tăng trưởng trong khoảng thời gian này</span>
          </div>
        ) : (
          <div className="w-full h-56 pt-2">
            <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  {/* Amber gradient for New Dishes */}
                  <linearGradient id="growthAmberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Emerald gradient for Published Dishes */}
                  <linearGradient id="growthEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-[11px] font-medium"
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  domain={yDomain}
                  allowDecimals={false}
                  className="text-[10px] font-mono"
                />

                <ChartTooltip
                  cursor={{
                    stroke: '#71717A',
                    strokeWidth: 1,
                    strokeDasharray: '3 3',
                  }}
                  content={<ChartCustomTooltip />}
                />

                {/* Series 1: New Dishes (Amber, Dashed line for clarity when overlapping) */}
                {(activeSeries === 'all' || activeSeries === 'newDishes') && (
                  <Area
                    type="monotone"
                    dataKey="newDishes"
                    name="newDishes"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    fill="url(#growthAmberGrad)"
                    dot={{ r: 3.5, fill: '#F59E0B', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    activeDot={{
                      r: 6,
                      fill: '#F59E0B',
                      stroke: '#FFFFFF',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={650}
                  />
                )}

                {/* Series 2: Published Dishes (Emerald, Solid line) */}
                {(activeSeries === 'all' || activeSeries === 'publishedDishes') && (
                  <Area
                    type="monotone"
                    dataKey="publishedDishes"
                    name="publishedDishes"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#growthEmeraldGrad)"
                    dot={{ r: 3.5, fill: '#10B981', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    activeDot={{
                      r: 6,
                      fill: '#10B981',
                      stroke: '#FFFFFF',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={true}
                    animationDuration={750}
                  />
                )}
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Quick Dish Preview Modal ──────────────────────────────────────────────────

function DishQuickModal({
  dish,
  open,
  onOpenChange,
  onNavigateDish,
}: {
  dish: TrendingDishItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigateDish: (dishId: string) => void
}) {
  if (!dish) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" className="text-[11px] font-bold">
              Top #{dish.rank} Thịnh hành
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {dish.categoryName ?? 'Món Việt'}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">{dish.name}</DialogTitle>
          <DialogDescription className="text-xs font-mono text-muted-foreground">
            Slug: {dish.slug}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {dish.imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-border shadow-xs h-48 w-full bg-muted">
              <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground">
              <Utensils size={32} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border p-2.5 bg-muted/20">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                <Eye size={13} />
                <span className="text-[10px] font-semibold uppercase">Lượt xem</span>
              </div>
              <div className="text-base font-extrabold text-foreground">
                {dish.metrics.views.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2.5 bg-muted/20">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                <Bookmark size={13} />
                <span className="text-[10px] font-semibold uppercase">Lưu món</span>
              </div>
              <div className="text-base font-extrabold text-foreground">
                {dish.metrics.saves.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border p-2.5 bg-muted/20">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                <Star size={13} fill="currentColor" />
                <span className="text-[10px] font-semibold uppercase">Đánh giá</span>
              </div>
              <div className="text-base font-extrabold text-foreground">
                {dish.metrics.ratingAvg > 0 ? dish.metrics.ratingAvg.toFixed(1) : 'Chưa có'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Đóng
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false)
              onNavigateDish(dish.dishId)
            }}
            className="text-xs font-bold bg-primary text-primary-foreground flex items-center gap-1.5"
          >
            <span>Chi tiết trong kho món</span>
            <ExternalLink size={14} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const [chartDays, setChartDays] = useState(7)
  const range = chartDays === 30 ? '30d' : '7d'
  const [selectedDish, setSelectedDish] = useState<TrendingDishItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useDashboardSummary(range)

  const {
    data: growth,
    isLoading: growthLoading,
    refetch: refetchGrowth,
  } = useDashboardGrowth(chartDays)

  const {
    data: trending,
    isLoading: trendingLoading,
    refetch: refetchTrending,
  } = useTrendingDishes('7d', 5)

  const {
    data: activities,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useDashboardActivities(10)

  const { data: jobsData, refetch: refetchJobs } = useImportJobs({ limit: 10 })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.allSettled([
      refetchSummary(),
      refetchGrowth(),
      refetchTrending(),
      refetchActivities(),
      refetchJobs(),
    ])
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleSelectDish = (dish: TrendingDishItem) => {
    setSelectedDish(dish)
    setPreviewOpen(true)
  }

  const jobs = jobsData?.data ?? []
  const kpi = summary?.kpi
  const growthPct = kpi?.dishes.publishedGrowthPercent
  const trendLabel =
    growthPct == null ? null : `${growthPct > 0 ? '+' : ''}${growthPct}% tuần này`

  const planGrowthPct = kpi?.weeklyPlans?.growthPercent
  const planTrendLabel =
    planGrowthPct == null ? null : `${planGrowthPct > 0 ? '+' : ''}${planGrowthPct}%`

  const logGrowthPct = kpi?.mealLogs?.growthPercent
  const logTrendLabel =
    logGrowthPct == null ? null : `${logGrowthPct > 0 ? '+' : ''}${logGrowthPct}%`

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* ── Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Tổng quan hệ thống
            </h1>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 gap-1.5 h-6"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sẵn sàng
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Theo dõi thời gian thực tình hình dữ liệu món ăn, tiến trình AI và kiểm duyệt cộng đồng.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="font-semibold text-xs h-9 px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-amber-500' : ''} />
            <span className="hidden md:inline ml-1">Làm mới</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/ingest')}
            className="font-semibold text-xs h-9 px-3 shadow-2xs"
          >
            <Zap size={14} className="text-amber-500 mr-1" />
            <span>Job AI</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/foods/new')}
            className="font-bold text-xs h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            <Plus size={15} className="mr-1" />
            <span>Thêm món mới</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={BookOpen}
          value={(kpi?.dishes.published ?? 0).toLocaleString()}
          label="Món đã xuất bản"
          tone="emerald"
          trend={trendLabel}
          note={kpi ? `Trên tổng ${kpi.dishes.total} món` : undefined}
          loading={summaryLoading}
          onClick={() => navigate('/foods')}
        />
        <StatCard
          icon={FileCheck2}
          value={kpi?.dishes.pendingReview ?? 0}
          label="Chờ kiểm duyệt"
          tone="amber"
          note="Cần xử lý phê duyệt"
          loading={summaryLoading}
          onClick={() => navigate('/review')}
        />
        <StatCard
          icon={Zap}
          value={kpi?.importJobs.active ?? 0}
          label="Job AI đang chạy"
          tone="blue"
          note={kpi ? `${kpi.importJobs.doneLast7d} đã xong tuần này` : 'Tự động trích xuất'}
          loading={summaryLoading}
          onClick={() => navigate('/ingest')}
        />
        <StatCard
          icon={AlertTriangle}
          value={kpi?.moderation.openReports ?? kpi?.dishes.failed ?? 0}
          label="Báo cáo vi phạm"
          tone="rose"
          note="Hàng đợi cộng đồng"
          loading={summaryLoading}
          onClick={() => navigate('/community')}
        />
        <StatCard
          icon={CalendarDays}
          value={kpi?.weeklyPlans?.inRange ?? 0}
          label="Kế hoạch tuần"
          tone="blue"
          trend={planTrendLabel}
          note={kpi?.weeklyPlans ? `Tổng ${kpi.weeklyPlans.total} (lỗi ${kpi.weeklyPlans.failureRatePercent}%)` : 'Tạo mới chu kỳ'}
          loading={summaryLoading}
        />
        <StatCard
          icon={HeartPulse}
          value={(kpi?.mealLogs?.inRange ?? 0).toLocaleString()}
          label="Nhật ký bữa ăn"
          tone="purple"
          trend={logTrendLabel}
          note={kpi?.mealLogs ? `~${kpi.mealLogs.avgPerDay} lượt / ngày` : 'Tổng lượt ghi'}
          loading={summaryLoading}
        />
      </div>

      {/* ── Smart Insight Callout ── */}
      <Card className="border border-amber-300/80 bg-gradient-to-r from-amber-50/80 via-amber-100/30 to-background dark:from-amber-950/30 dark:via-amber-900/15 dark:to-card shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-400">
                Gợi ý vận hành thông minh
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                {summaryLoading
                  ? 'Đang phân tích dữ liệu hệ thống…'
                  : summary?.insight.message ??
                    'Hiện không có cảnh báo bất thường nào trong hệ thống.'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(summary?.insight.ctaRoute ?? '/review')}
            className="shrink-0 font-bold text-xs h-9 px-4 bg-amber-400 text-zinc-950 hover:bg-amber-500 shadow-xs"
          >
            <span>Xử lý ngay</span>
            <ArrowUpRight size={15} className="ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* ── Main Analytics & Tasks Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2">
          <ActivityChart
            series={growth?.series ?? []}
            days={chartDays}
            onDaysChange={setChartDays}
            loading={growthLoading}
          />
        </div>
        <div>
          <TasksWidget
            tasks={summary?.tasks ?? []}
            loading={summaryLoading}
            onNavigate={(route) => navigate(route)}
          />
        </div>
      </div>

      {/* ── Secondary Tri-Widget Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        <PopularFoodsWidget
          items={trending?.items ?? []}
          fallback={trending?.fallback ?? false}
          loading={trendingLoading}
          onSelectDish={handleSelectDish}
          onNavigateAll={() => navigate('/foods')}
        />
        <PipelineWidget jobs={jobs} onNavigate={() => navigate('/ingest')} />
        <ActivityWidget
          items={activities?.items ?? []}
          loading={activitiesLoading}
          onNavigateItem={(route) => navigate(route)}
          onNavigateAll={() => navigate('/ingest')}
        />
      </div>

      {/* ── Dish Quick Preview Modal ── */}
      <DishQuickModal
        dish={selectedDish}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onNavigateDish={(id) => navigate(`/foods?q=${encodeURIComponent(id)}`)}
      />
    </div>
  )
}
