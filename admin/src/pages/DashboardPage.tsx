import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  HeartPulse,
  Lightbulb,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { PageContainer, PageHeader } from '../components/layout'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { Progress } from '../components/ui/progress'
import { ChartContainer, ChartTooltip, type ChartConfig } from '../components/ui/chart'
import { useAuth } from '../providers/AuthProvider'
import { useImportJobs } from '../hooks/useImportJobs'
import {
  useDashboardActivities,
  useDashboardGrowth,
  useDashboardSummary,
  useTrendingDishes,
} from '../hooks/useDashboard'
import type { ActivityItem, GrowthPoint, TrendingDishItem } from '../api/dashboard'
import { cn } from '../lib/utils'

// ─── Building blocks ──────────────────────────────────────────────────────────

function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('surface flex min-w-0 flex-col', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn('min-w-0 flex-1 px-5 pb-5', bodyClassName)}>{children}</div>
    </section>
  )
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
      <ArrowRight size={13} />
    </button>
  )
}

function EmptyBlock({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon size={18} />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

type Tone = 'brand' | 'emerald' | 'sky' | 'rose' | 'violet'

const toneClass: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  growth,
  tone,
  loading,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  hint?: string
  growth?: number | null
  tone: Tone
  loading?: boolean
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'surface group flex min-w-0 flex-col gap-3 p-4 text-left',
        onClick && 'cursor-pointer transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClass[tone])}>
          <Icon size={16} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground">
          {(value ?? 0).toLocaleString('vi-VN')}
        </div>
      )}
      <div className="flex min-h-[18px] items-center gap-1.5 text-xs">
        {!loading && growth != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              growth < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {growth < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {growth > 0 ? '+' : ''}
            {growth}%
          </span>
        )}
        {!loading && hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </Comp>
  )
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

const TASK_META: Record<string, { label: string; icon: LucideIcon }> = {
  PENDING_REVIEW: { label: 'Món chờ duyệt', icon: ShieldCheck },
  LOW_CONFIDENCE: { label: 'Món cần xác minh dữ liệu', icon: AlertTriangle },
  OPEN_REPORTS: { label: 'Báo cáo vi phạm đang mở', icon: AlertTriangle },
  UNLINKED_INGREDIENTS: { label: 'Nguyên liệu chưa liên kết', icon: ClipboardList },
  FAILED_JOBS: { label: 'Job nhập AI bị lỗi', icon: XCircle },
  FOOD_SCAN_MISSING: { label: 'Món quét chưa có trong kho', icon: Sparkles },
}

function TasksPanel({
  tasks,
  loading,
  onNavigate,
}: {
  tasks: Array<{ key: string; count: number; route: string; priority: string }>
  loading?: boolean
  onNavigate: (route: string) => void
}) {
  const visible = tasks.filter((t) => t.count > 0)
  const total = visible.reduce((acc, t) => acc + t.count, 0)

  return (
    <Panel
      title="Việc cần xử lý"
      description={loading ? 'Đang tổng hợp…' : total > 0 ? `${total} mục đang chờ bạn` : 'Mọi thứ đã gọn gàng'}
      bodyClassName="px-2 pb-2"
    >
      {loading ? (
        <div className="space-y-2 px-3 pb-3">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyBlock icon={CheckCircle2} title="Không còn việc tồn đọng" hint="Hệ thống đang ở trạng thái tốt" />
      ) : (
        <ul>
          {visible.map((task) => {
            const meta = TASK_META[task.key] ?? { label: task.key, icon: ClipboardList }
            const Icon = meta.icon
            const high = task.priority === 'high'
            return (
              <li key={task.key}>
                <button
                  type="button"
                  onClick={() => onNavigate(task.route.split('?')[0])}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      high ? toneClass.rose : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{meta.label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 text-xs font-semibold leading-6 tabular-nums',
                      high
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {task.count}
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ─── Growth chart ─────────────────────────────────────────────────────────────

const chartConfig = {
  newDishes: { label: 'Món mới', color: '#F97316' },
  publishedDishes: { label: 'Đã xuất bản', color: '#10B981' },
} satisfies ChartConfig

function GrowthTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, number | string> }> }) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-pop">
      <div className="mb-1.5 font-semibold text-foreground">{row.fullDate}</div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Món mới
        </span>
        <span className="font-semibold tabular-nums text-foreground">{row.newDishes}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Đã xuất bản
        </span>
        <span className="font-semibold tabular-nums text-foreground">{row.publishedDishes}</span>
      </div>
    </div>
  )
}

function GrowthPanel({
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
  const data = useMemo(
    () =>
      series.map((p) => {
        const [y, m, d] = p.date.split('-')
        return { ...p, label: d && m ? `${d}/${m}` : p.date, fullDate: d && m && y ? `${d}/${m}/${y}` : p.date }
      }),
    [series]
  )
  const totalNew = series.reduce((a, p) => a + p.newDishes, 0)
  const totalPub = series.reduce((a, p) => a + p.publishedDishes, 0)

  return (
    <Panel
      className="xl:col-span-2"
      title="Tăng trưởng kho món"
      description="Món mới tạo so với món đã xuất bản"
      action={
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                days === d ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {d} ngày
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Món mới
          </div>
          <div className="text-xl font-bold tabular-nums">{loading ? '—' : totalNew}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Đã xuất bản
          </div>
          <div className="text-xl font-bold tabular-nums">{loading ? '—' : totalPub}</div>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center">
          <EmptyBlock icon={TrendingUp} title="Chưa có dữ liệu trong khoảng này" />
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPub" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} className="text-[11px]" />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} className="text-[11px]" />
            <ChartTooltip cursor={{ stroke: '#A1A1AA', strokeDasharray: '3 3' }} content={<GrowthTooltip />} />
            <Area type="monotone" dataKey="newDishes" stroke="#F97316" strokeWidth={2} fill="url(#gNew)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="publishedDishes" stroke="#10B981" strokeWidth={2} fill="url(#gPub)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ChartContainer>
      )}
    </Panel>
  )
}

// ─── Trending dishes ──────────────────────────────────────────────────────────

function TrendingPanel({
  items,
  loading,
  onOpen,
  onAll,
}: {
  items: TrendingDishItem[]
  loading?: boolean
  onOpen: (d: TrendingDishItem) => void
  onAll: () => void
}) {
  return (
    <Panel
      title="Món được quan tâm"
      description="Top 5 trong 7 ngày qua"
      action={<LinkButton onClick={onAll}>Kho món</LinkButton>}
      bodyClassName="px-2 pb-2"
    >
      {loading ? (
        <div className="space-y-2 px-3 pb-3">
          {[0, 1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock icon={Utensils} title="Chưa có dữ liệu thống kê" />
      ) : (
        <ul>
          {items.map((dish) => (
            <li key={dish.dishId}>
              <button
                type="button"
                onClick={() => onOpen(dish)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                  {dish.rank}
                </span>
                {dish.imageUrl ? (
                  <img
                    src={dish.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Utensils size={16} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{dish.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{dish.categoryName ?? 'Món Việt'}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
                  <span className="flex items-center gap-1" title="Lượt xem">
                    <Eye size={13} />
                    {dish.metrics.views.toLocaleString('vi-VN')}
                  </span>
                  <span className="hidden items-center gap-1 sm:flex" title="Lượt lưu">
                    <Bookmark size={13} />
                    {dish.metrics.saves.toLocaleString('vi-VN')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ─── Activity ─────────────────────────────────────────────────────────────────

function activityIcon(item: ActivityItem) {
  if (item.type === 'IMPORT_JOB') {
    if (item.status === 'DONE') return { icon: CheckCircle2, cls: toneClass.emerald }
    if (item.status === 'FAILED') return { icon: XCircle, cls: toneClass.rose }
    return { icon: Zap, cls: toneClass.sky }
  }
  if (item.type === 'DISH_REVIEW') return { icon: ShieldCheck, cls: toneClass.brand }
  if (item.type === 'MODERATION') return { icon: AlertTriangle, cls: toneClass.rose }
  if (item.type === 'FOOD_SCAN_MISSING') return { icon: Sparkles, cls: toneClass.violet }
  return { icon: Clock3, cls: 'bg-muted text-muted-foreground' }
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

function ActivityPanel({
  items,
  loading,
  onNavigate,
}: {
  items: ActivityItem[]
  loading?: boolean
  onNavigate: (route: string) => void
}) {
  return (
    <Panel title="Hoạt động gần đây" description="Nhật ký hệ thống mới nhất" bodyClassName="px-2 pb-2">
      {loading ? (
        <div className="space-y-2 px-3 pb-3">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock icon={Clock3} title="Chưa có hoạt động nào" />
      ) : (
        <ul>
          {items.map((item) => {
            const { icon: Icon, cls } = activityIcon(item)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => item.route && onNavigate(item.route)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', cls)}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                    {item.description && (
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                  <time className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{timeAgo(item.occurredAt)}</time>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ─── AI pipeline ──────────────────────────────────────────────────────────────

const ACTIVE_STATES = ['PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING', 'DRAFTING']

function PipelinePanel({ onNavigate }: { onNavigate: () => void }) {
  const { data, isLoading } = useImportJobs({ limit: 10 })
  const jobs = data?.data ?? []
  const active = jobs.filter((j) => ACTIVE_STATES.includes(j.status))

  return (
    <Panel
      title="Nhập món bằng AI"
      description={active.length > 0 ? `${active.length} tiến trình đang chạy` : 'Không có tiến trình nào đang chạy'}
      action={<LinkButton onClick={onNavigate}>Mở</LinkButton>}
    >
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : active.length === 0 ? (
        <button
          type="button"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
        >
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClass.brand)}>
            <Zap size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Tạo job nhập món mới</span>
            <span className="block text-xs text-muted-foreground">AI tự thu thập công thức, nguyên liệu, dinh dưỡng</span>
          </span>
        </button>
      ) : (
        <ul className="space-y-3">
          {active.slice(0, 3).map((job) => (
            <li key={job.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-foreground">{job.query}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{job.progress ?? 0}%</span>
              </div>
              <Progress value={job.progress ?? 0} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const [days, setDays] = useState(7)
  const range = days === 30 ? '30d' : '7d'
  const [refreshing, setRefreshing] = useState(false)

  const summary = useDashboardSummary(range)
  const growth = useDashboardGrowth(days)
  const trending = useTrendingDishes('7d', 5)
  const activities = useDashboardActivities(8)

  const kpi = summary.data?.kpi
  const canCreate = hasRole('SUPER_ADMIN', 'CONTENT_ADMIN')
  const insight = summary.data?.insight
  const hasInsight = !!insight?.message && insight.code !== 'ALL_CLEAR'

  const refresh = async () => {
    setRefreshing(true)
    await Promise.allSettled([summary.refetch(), growth.refetch(), trending.refetch(), activities.refetch()])
    setRefreshing(false)
  }

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${user?.displayName ?? 'Admin'}`}
        description="Tình hình kho món, kiểm duyệt và người dùng trong tuần này."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
              Làm mới
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => navigate('/foods/new')}>
                <Plus />
                Thêm món
              </Button>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          icon={Utensils}
          label="Món đã xuất bản"
          value={kpi?.dishes.published}
          growth={kpi?.dishes.publishedGrowthPercent}
          hint={kpi ? `/ ${kpi.dishes.total.toLocaleString('vi-VN')} món` : undefined}
          tone="emerald"
          loading={summary.isLoading}
          onClick={() => navigate('/foods')}
        />
        <Kpi
          icon={ShieldCheck}
          label="Chờ duyệt"
          value={kpi?.dishes.pendingReview}
          hint="món cần xử lý"
          tone="brand"
          loading={summary.isLoading}
          onClick={() => navigate('/review')}
        />
        <Kpi
          icon={AlertTriangle}
          label="Báo cáo vi phạm"
          value={kpi?.moderation.openReports}
          hint="đang mở"
          tone="rose"
          loading={summary.isLoading}
          onClick={hasRole('SUPER_ADMIN', 'CONTENT_ADMIN') ? () => navigate('/community') : undefined}
        />
        <Kpi
          icon={Zap}
          label="Job AI đang chạy"
          value={kpi?.importJobs.active}
          hint={kpi ? `${kpi.importJobs.doneLast7d} xong tuần này` : undefined}
          tone="sky"
          loading={summary.isLoading}
          onClick={hasRole('SUPER_ADMIN', 'CONTENT_ADMIN') ? () => navigate('/ingest') : undefined}
        />
        <Kpi
          icon={CalendarDays}
          label="Kế hoạch tuần"
          value={kpi?.weeklyPlans?.inRange}
          growth={kpi?.weeklyPlans?.growthPercent}
          hint="được tạo"
          tone="violet"
          loading={summary.isLoading}
        />
        <Kpi
          icon={HeartPulse}
          label="Nhật ký bữa ăn"
          value={kpi?.mealLogs?.inRange}
          growth={kpi?.mealLogs?.growthPercent}
          hint={kpi?.mealLogs ? `~${kpi.mealLogs.avgPerDay}/ngày` : undefined}
          tone="brand"
          loading={summary.isLoading}
        />
      </div>

      {/* Insight */}
      {hasInsight && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/[0.06] sm:flex-row sm:items-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Lightbulb size={16} />
          </span>
          <p className="min-w-0 flex-1 text-sm text-brand-900 dark:text-brand-100">{insight!.message}</p>
          <Button size="sm" variant="outline" onClick={() => navigate(insight!.ctaRoute)} className="shrink-0">
            Xử lý ngay
            <ArrowUpRight />
          </Button>
        </div>
      )}

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GrowthPanel
          series={growth.data?.series ?? []}
          days={days}
          onDaysChange={setDays}
          loading={growth.isLoading}
        />
        <TasksPanel
          tasks={summary.data?.tasks ?? []}
          loading={summary.isLoading}
          onNavigate={(route) => navigate(route)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TrendingPanel
          items={trending.data?.items ?? []}
          loading={trending.isLoading}
          onOpen={(d) => navigate(`/foods/${d.dishId}`)}
          onAll={() => navigate('/foods')}
        />
        <ActivityPanel
          items={activities.data?.items ?? []}
          loading={activities.isLoading}
          onNavigate={(route) => navigate(route)}
        />
        {hasRole('SUPER_ADMIN', 'CONTENT_ADMIN') && (
          <PipelinePanel onNavigate={() => navigate('/ingest')} />
        )}
      </div>
    </PageContainer>
  )
}
