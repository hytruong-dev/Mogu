import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BarChart3,
  CheckCircle2,
  Flame,
  Leaf,
  PieChart,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { exploreAdminApi, type ExploreAnalytics } from '../api/explore'

function StatCard({
  icon: Icon,
  value,
  label,
  tone = 'yellow',
  note,
}: {
  icon: typeof Sparkles
  value: string
  label: string
  tone?: 'yellow' | 'green' | 'blue' | 'purple'
  note?: string
}) {
  const toneStyles = {
    yellow: 'bg-amber-50 text-amber-600 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400',
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-start justify-between">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="text-2xl font-black tracking-tight text-foreground">{value}</div>
          {note && <span className="text-xs text-muted-foreground block">{note}</span>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ${toneStyles[tone]}`}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      </CardContent>
    </Card>
  )
}

function ModernLineChart({ points }: { points: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...points.map((p) => p.count))
  const coords = points.map((p, i) => {
    const x = points.length <= 1 ? 300 : 35 + (i * (540 / Math.max(points.length - 1, 1)))
    const y = 145 - (p.count / max) * 100
    return { x, y, label: p.date.slice(5) || p.date }
  })
  const poly = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const areaPoints = coords.length > 1
    ? `${coords[0].x},160 ${poly} ${coords[coords.length - 1].x},160`
    : ''

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-5 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-500" />
              Lưu lượng bài đăng theo ngày
            </CardTitle>
            <CardDescription className="text-xs">Tần suất xuất bản và tương tác nội dung tuần qua</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Bài đăng mới
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        <svg viewBox="0 0 620 180" className="w-full h-44 overflow-visible" aria-label="Biểu đồ thống kê">
          <defs>
            <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FACC15" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FACC15" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <g className="stroke-muted-foreground/15 stroke-dasharray-2">
            {[25, 65, 105, 145].map((y) => (
              <line key={y} x1="30" y1={y} x2="600" y2={y} strokeWidth="1" strokeDasharray="4 4" />
            ))}
          </g>
          {coords.length > 1 ? (
            <>
              <polygon fill="url(#reportGrad)" points={areaPoints} />
              <polyline
                fill="none"
                stroke="#FACC15"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={poly}
              />
            </>
          ) : null}
          {coords.map((c) => (
            <circle key={`${c.x}-${c.label}`} cx={c.x} cy={c.y} r="4" className="fill-amber-400 stroke-card stroke-2" />
          ))}
        </svg>
        <div className="flex justify-between px-2 pt-2 text-[11px] font-mono text-muted-foreground">
          {coords.map((c) => (
            <span key={c.label}>{c.label}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatNum(n?: number) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('vi-VN')
}

export default function ReportsPage() {
  const [data, setData] = useState<ExploreAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    exploreAdminApi
      .analytics({ from, to })
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((e: any) => {
        if (cancelled) return
        setError(e?.response?.data?.message ?? e?.message ?? 'Không tải được số liệu thống kê')
        setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  const chartPoints = data?.postsPerDay ?? []

  const topList = useMemo(() => {
    if (data?.topArticles?.length) {
      return data.topArticles.map((a) => ({
        name: a.title,
        value: a.viewCount ?? a.likeCount ?? 0,
      }))
    }
    if (data?.topPosts?.length) {
      return data.topPosts.map((p) => ({
        name: (p.content || 'Bài đăng').slice(0, 40),
        value: p.likeCount ?? p.commentCount ?? 0,
      }))
    }
    return []
  }, [data])

  const totalMax = Math.max(1, ...topList.map((x) => x.value))
  const totalContent = (data?.totalArticles ?? 0) + (data?.totalPosts ?? 0)
  const articlesPct = totalContent > 0 ? Math.round(((data?.totalArticles ?? 0) / totalContent) * 100) : 0
  const postsPct = totalContent > 0 ? Math.round(((data?.totalPosts ?? 0) / totalContent) * 100) : 0
  const safetyRate =
    data?.reportRate != null
      ? `${Math.max(0, Math.round((1 - data.reportRate) * 100))}%`
      : '100%'

  const dynamicInsights = useMemo(() => {
    if (!data) return []
    const list: Array<{ icon: any; title: string; desc: string }> = []

    if ((data.totalReports ?? 0) > 0) {
      list.push({
        icon: Zap,
        title: `Có ${data.totalReports} báo cáo đang chờ xử lý`,
        desc: `Cần ưu tiên xử lý các báo cáo vi phạm để duy trì độ an toàn nội dung (hiện đạt ${safetyRate}).`,
      })
    }

    if (data.topArticles && data.topArticles.length > 0) {
      const top = data.topArticles[0]
      list.push({
        icon: TrendingUp,
        title: `Nội dung nổi bật: ${top.title.slice(0, 35)}...`,
        desc: `Bài viết đạt ${(top.viewCount ?? top.likeCount ?? 0).toLocaleString()} tương tác. Nên cân nhắc ghim (pin) bài viết lên đầu Explore feed.`,
      })
    }

    if ((data.impressions ?? 0) > 0) {
      list.push({
        icon: Leaf,
        title: `Quy mô tiếp cận: ${formatNum(data.impressions)} lượt impression`,
        desc: `Ghi nhận ${formatNum(data.engagementDau ?? 0)} người dùng hoạt động tích cực trong chu kỳ ${range === '7d' ? '7 ngày' : range === '30d' ? '30 ngày' : '90 ngày'}.`,
      })
    }

    return list
  }, [data, safetyRate, range])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <BarChart3 size={28} className="text-amber-500" />
            Báo cáo & Phân tích (Analytics)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng quan hiệu suất tương tác, lượt xem và mức độ gắn kết trên hệ sinh thái Mogu.
            {loading && <span className="text-muted-foreground ml-1">· Đang đồng bộ...</span>}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-lg border border-input bg-background p-1">
            <button
              onClick={() => setRange('7d')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                range === '7d' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 ngày
            </button>
            <button
              onClick={() => setRange('30d')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                range === '30d' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 ngày
            </button>
            <button
              onClick={() => setRange('90d')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                range === '90d' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              90 ngày
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Sparkles}
          value={formatNum(data?.impressions ?? 0)}
          label="Lượt impression"
          tone="yellow"
          note="Tổng số lượt hiển thị feed"
        />
        <StatCard
          icon={CheckCircle2}
          value={safetyRate}
          label="Độ an toàn nội dung"
          tone="green"
          note="Tỷ lệ nội dung không vi phạm"
        />
        <StatCard
          icon={Users}
          value={formatNum(data?.engagementDau ?? 0)}
          label="DAU hoạt động"
          tone="blue"
          note="Người dùng tương tác trong kỳ"
        />
        <StatCard
          icon={Archive}
          value={formatNum(data?.openDetails ?? 0)}
          label="Lượt mở chi tiết"
          tone="purple"
          note="Tổng số lượt khám phá bài"
        />
      </div>

      {/* Charts & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {chartPoints.length > 0 ? (
            <ModernLineChart points={chartPoints} />
          ) : (
            <Card className="p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
              <BarChart3 size={32} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">Chưa có bài đăng nào trong khoảng thời gian này.</p>
            </Card>
          )}
        </div>

        {/* Content Summary Card */}
        <Card className="flex flex-col">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart size={18} className="text-purple-500" />
              Tổng quan nội dung
            </CardTitle>
            <CardDescription className="text-xs">Phân bổ dữ liệu hiện diện trong kho</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Bài viết chuyên sâu
                </span>
                <span className="font-bold text-foreground">{formatNum(data?.totalArticles ?? 0)}</span>
              </div>
              <Progress value={articlesPct} className="h-1.5" />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Bài đăng cộng đồng
                </span>
                <span className="font-bold text-foreground">{formatNum(data?.totalPosts ?? 0)}</span>
              </div>
              <Progress value={postsPct} className="h-1.5" />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="flex items-center gap-2 text-muted-foreground font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Báo cáo cần rà soát
                </span>
                <span className="font-bold text-foreground">{formatNum(data?.totalReports ?? 0)}</span>
              </div>
              <Progress value={Math.min(100, (data?.totalReports ?? 0) * 10)} className="h-1.5" />
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border text-center">
              <span className="text-xs text-muted-foreground block">Tổng số nội dung hoạt động</span>
              <span className="text-xl font-black text-foreground">{formatNum(totalContent)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranked Foods & Data Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Content Card */}
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Flame size={18} className="text-rose-500" />
              Nội dung dẫn đầu tương tác
            </CardTitle>
            <CardDescription className="text-xs">Top bài viết và bài đăng được quan tâm cao nhất</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-3.5">
            {topList.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Chưa có dữ liệu bài viết hoặc bài đăng dẫn đầu trong kỳ này.
              </div>
            ) : (
              topList.map((item, i) => {
                const pct = Math.round((item.value / totalMax) * 100)
                return (
                  <div key={`${item.name}-${i}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate max-w-[280px]">
                        {i + 1}. {item.name}
                      </span>
                      <span className="font-mono font-bold text-muted-foreground">{formatNum(item.value)}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Actionable Data Insights */}
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              Khuyến nghị tối ưu dữ liệu
            </CardTitle>
            <CardDescription className="text-xs">Dựa trên mô hình thuật toán Explore và AI Engine</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-3">
            {dynamicInsights.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Chưa có đủ dữ liệu thống kê trong chu kỳ này để đưa ra khuyến nghị.
              </div>
            ) : (
              dynamicInsights.map((insight, idx) => {
                const Icon = insight.icon
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <Icon size={16} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground">{insight.title}</div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.desc}</p>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
